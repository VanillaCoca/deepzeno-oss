# Phase 2: Decision System + Extraction Pipeline

> **Audience**: This file is for Codex to execute. Lixian reviews the output.
> Sean validates the complete decision loop by testing real conversations.
>
> **Prerequisite**: Phase 1 is complete and verified. Auth, three-column layout,
> chat streaming, model selector, and database schema are all working.

---

## Context for Codex

Phase 1 created the database schema and a working chat. Phase 2 connects them:
every assistant message triggers decision extraction, candidates appear in the UI,
and confirmed decisions are injected back into future conversations as context.

You will be working with:
- The Supabase tables created in Phase 1 (decisions, candidate_decisions, edges, decision_log, etc.)
- The existing chat API route at `app/api/chat/route.ts`
- The Vercel AI SDK's streaming and tool-calling capabilities

**Key principle**: The extraction pipeline runs asynchronously AFTER the assistant
response is complete. It must never block or delay the chat response.

**UX PRESERVATION RULE (from Phase 1, still applies):**
The app must remain a full-viewport web application. All new UI (candidate pool,
tree panel, detail panel, inline hints) must integrate into the existing layout
without breaking viewport fill, responsive behavior, or streaming UX. When
referencing the old Codex demo for feature behavior, only replicate functional
requirements — do not copy its fixed-size layout approach.

---

## Task 1: Async Decision Extraction Pipeline

### What It Does

After each assistant message is saved to the database, a background process:
1. Reads the recent conversation messages from the current topic.
2. Reads the existing confirmed decisions for the topic (serialized).
3. Sends both to Claude Sonnet 4.6 with an extraction prompt.
4. Parses the structured JSON output.
5. Writes results to `candidate_decisions` table.
6. Supabase Realtime notifies the frontend.

### Steps

1. Create `lib/decision-extraction.ts`:
   - Export `async function extractDecisions(params)`.
   - Params: `{ conversationId, topicId, projectId, messageId }`.
   - Reads last N messages (up to 20) from the conversation.
   - Reads confirmed decisions for the topic via `serializeDecisionGraph()`.
   - Calls Claude Sonnet 4.6 (non-streaming, separate from the chat call) with the extraction prompt.
   - Parses JSON response into candidate objects.
   - Writes to `candidate_decisions` with `content_hash` dedup (skip if same hash exists for same conversation).
   - Logs errors but never throws — extraction failure must not affect the user's chat experience.

2. Create `lib/decision-serializer.ts`:
   - Export `function serializeDecisionGraph(decisions, edges): string`.
   - Input: arrays of decision rows and edge rows for a topic.
   - Output: a compressed text representation under 2000 tokens.
   - Format: one line per decision, showing title, kind, weight, status.
   - Edges shown as `[A] --supersedes--> [B]` notation.
   - Anchor and key decisions listed first, then normal.

3. Create `lib/prompting.ts`:
   - Export the extraction system prompt.
   - The prompt instructs the model to:
     - Read the conversation and identify candidate items.
     - Output a JSON array of candidate objects.
     - Each candidate has: `proposed_title`, `proposed_content`, `proposed_rationale`, `proposed_kind` (see kind list below), `proposed_weight` (anchor|key|normal), `confidence` (0.0-1.0), `suggested_edges` (array of {type, target_decision_id}), `relevant_message_ids` (array of message UUIDs), `pre_selected` (boolean).
     - If no candidates are found, return an empty array.
     - The model must compare against existing decisions to avoid duplicates and to detect supersession.

   The system prompt MUST contain the following three blocks verbatim (English; the model handles bilingual conversations correctly):

   **Block A — Kind taxonomy and discrimination rules**

   ```
   Extract candidates with one of these kinds:

   - goal: a desired outcome the project is trying to achieve.
   - constraint: a hard limit that must not be crossed.
   - plan: a chosen approach the user has decided to take.
   - hypothesis: an explicit assumption that could later be falsified.
   - principle: a durable guideline that applies broadly across the project.
   - open_question: something the user explicitly says is undecided, depends on later info, or "we'll figure out later". This is a first-class signal — it tells future readers what is still unknown.
   - rejection: an option the user explicitly considered AND explicitly chose not to pursue, with a stated or strongly implied reason.

   Discrimination rules:
   1. If the user expresses uncertainty, lack of decision, or "we'll decide later", emit an open_question. Do NOT collapse uncertainty into a plan or hypothesis.
   2. Comparing options or noting downsides is NOT rejection. Only definitive exclusion qualifies.
   3. A casual complaint ("X is annoying") is NOT a rejection.
   4. A constraint describes what cannot be done; a rejection describes a specific option that was considered and dropped. They are different.
   5. When in doubt between rejection and open_question, prefer open_question.
   ```

   **Block B — Rejection examples (concrete discrimination)**

   ```
   EXAMPLES — emit a rejection candidate:
   - "不要做多人协作"
   - "V1 不考虑 BYOK"
   - "先不做 Council"
   - "这个方案排除"
   - "Stripe 这个方向暂时不走，原因是 X"
   - "We've decided not to use Postgres for this; SQLite is enough."

   EXAMPLES — do NOT emit a rejection (skip, or emit a different kind):
   - "Stripe 好像有点麻烦"          → skip, or low-confidence open_question
   - "多人协作可能复杂"              → skip, or open_question if the user is weighing it
   - "BYOK 会影响订阅毛利"           → constraint or open_question, not rejection
   - "Council 成本比较高"            → comparative observation, skip
   - "Postgres has more features but..." → comparison, not rejection
   ```

   **Block C — pre_selected default rules**

   ```
   For every candidate of kind=rejection, set pre_selected: false.
   The user must actively opt in to recording a rejection.

   For all other kinds, default pre_selected: true.

   For any candidate where confidence < 0.5, also set pre_selected: false regardless of kind.
   ```

4. Integrate into the chat flow:
   - In `app/api/chat/route.ts` (or the relevant API handler), after the assistant response is fully streamed and the message is saved to DB:
   - Call `extractDecisions()` using `waitUntil()` or a fire-and-forget pattern (do NOT await in the response stream).
   - Only trigger for non-General topics (`topics.is_general = false`).
   - Pass the assistant model name (e.g. `claude-sonnet-4.6`, `gpt-4.1`) into `extractDecisions()` so it can be recorded.

5. Add an application-level validator in `extractDecisions()`:
   - If the model returns a `proposed_kind` not in the 7 documented values, log a warning and silently drop that candidate.
   - This prevents schema drift from prompt-side errors.

6. Source tracking on internally extracted candidates:
   - When `extractDecisions()` writes a row to `candidate_decisions`, set:
     - `source = 'zeno_extraction'`
     - `source_metadata = { model: <model_name_of_the_assistant_message_that_triggered_extraction> }`
   - This applies to ALL Zeno-internal extraction, including multi-model @mentions (e.g. when the user @-mentions Claude vs GPT vs Gemini in the same topic, each candidate carries the originating model in source_metadata).
   - Rationale: future truth governance and quality analysis (which model produces higher-quality candidates) requires this data. Recording it costs nothing now; backfilling later is impossible.
   - Do NOT use `source = 'mcp_agent'` for internal multi-model — that source value is reserved exclusively for candidates submitted via the MCP `submit_candidate` tool from external clients (Task 7).

### Acceptance

- After each assistant message in a non-General topic, candidates appear in `candidate_decisions` table within 10 seconds.
- Duplicate extraction (same content_hash + conversation_id) is silently skipped.
- Extraction failure does not affect chat — user sees no error.
- Extraction does not run for General topic conversations.
- A conversation containing "V1 不考虑 BYOK" produces exactly 1 rejection candidate with `pre_selected = false`.
- A conversation containing "Stripe 好像有点麻烦" does NOT produce a rejection candidate.
- A conversation containing "先不决定，看实测情况" produces an open_question candidate (NOT a plan or hypothesis).
- All emitted candidates have `proposed_kind` in the 7 documented values; any other value is dropped by the validator.
- Every candidate written by `extractDecisions()` has `source = 'zeno_extraction'` and `source_metadata.model` populated with the originating assistant model name. Candidates from a Claude turn carry `{ model: 'claude-sonnet-4.6' }`; candidates from a GPT turn carry `{ model: 'gpt-4.1' }`. No candidate from internal extraction uses `source = 'mcp_agent'`.

---

## Task 2: Candidate Pool Panel (Tree Panel Top Section)

### What It Does

The right panel (currently showing "Phase 2" placeholder) becomes the Truth Panel.
At the top of the Truth Panel, a Candidate Pool shows pending candidates.

### Steps

1. Create `components/candidate-pool.tsx`:
   - Subscribes to Supabase Realtime on `candidate_decisions` where `topic_id = current topic` and `status = 'pending'`.
   - Renders each candidate as a card:
     - Title (bold)
     - Content (truncated to 2 lines, expandable)
     - Kind badge (color-coded; rejection has a distinct visual treatment — see Task 3)
     - Checkbox (checked by default, matching `pre_selected` field)
     - **Source badge**: when `source !== 'zeno_extraction'`, render a small icon + label, e.g. "via Claude Code" (read from `source_metadata.agent`). When evidence exists (`external_evidence`), render it as a subtle link/snippet under the content.
   - Two action buttons at the bottom of the pool:
     - **"Confirm Selected"**: accepts all checked candidates (batch operation).
     - **"Dismiss All"**: rejects all pending candidates.

2. Implement `confirmCandidates(candidateIds[])` in `lib/candidate-actions.ts`:
   - For each accepted candidate, in a single transaction:
     - INSERT into `decisions` (copy proposed_* fields, set status='active').
     - If `suggested_edges` contains supersedes entries: INSERT edges + UPDATE target decision status to 'superseded'.
     - UPDATE `candidate_decisions` set status='accepted', resolved_decision_id, resolved_at.
     - INSERT `decision_log` entries (action='created', and 'superseded' if applicable).
   - For each rejected candidate (unchecked):
     - UPDATE `candidate_decisions` set status='rejected', resolved_at.
     - INSERT `decision_log` (action='candidate_rejected').

3. Implement `dismissAllCandidates(topicId)` in the same file:
   - Sets all pending candidates for the topic to status='rejected'.
   - Inserts decision_log entries for each.

### Acceptance

- Candidates appear in the right panel within seconds of extraction completing.
- User can uncheck candidates they don't want, then click "Confirm Selected".
- Confirmed candidates appear as decision nodes in the tree (Task 3).
- Dismissed candidates disappear and don't return.

---

## Task 3: Decision Tree Panel (Tree Panel Bottom Section)

### What It Does

Below the candidate pool, the Truth Panel shows confirmed decisions as a tree.

### Steps

1. Create `components/decision-tree.tsx`:
   - Reads confirmed decisions for the current topic from Supabase.
   - Two view modes, toggled by a segmented control at the top:
     - **By Type**: decisions grouped under collapsible headers by `kind`. Within each group, newest first.
       - **Group order (fixed, by recovery priority — what does the user need to see first when resuming work)**:
         1. Open Questions
         2. Goals
         3. Constraints
         4. Plans
         5. Hypotheses
         6. Principles
         7. Rejections (default collapsed)
       - Empty groups MUST be hidden entirely (no "Hypotheses (0)" empty header).
     - **By Relation**: tree structure starting from anchor decisions as roots, with `depends_on` / `supersedes` / `replaces` edges forming parent-child relationships.
   - Each node shows: title, kind badge, status badge (active=green, superseded=gray).
   - **Visual distinctions per kind**:
     - `open_question`: amber/yellow `?` icon prefix; the node should visually pop as "this is unresolved".
     - `rejection`: strikethrough on the title, low opacity; visually communicates "we are NOT doing this".
     - Other kinds: standard badge styling.
   - Superseded nodes are dimmed. A toggle in the toolbar shows/hides them. Default: hidden.
   - Clicking a node opens the Detail Panel (Task 4).

2. The tree panel uses Supabase Realtime to update when new decisions are confirmed (i.e., when Task 2's confirm action writes new rows).

### Acceptance

- After confirming candidates, new decisions appear in the tree without page refresh.
- Both view modes (by-type, by-relation) render correctly.
- The by-type view shows groups in the documented priority order; empty groups are hidden.
- `open_question` nodes are visually distinct (amber `?` prefix); `rejection` nodes are visually distinct (strikethrough/dimmed).
- Superseded nodes appear dimmed and can be toggled hidden (default hidden).
- Clicking a node opens the detail panel.

---

## Task 4: Node Detail Panel

### What It Does

When a tree node is clicked, a detail panel slides open (or expands) showing full information.

### Steps

1. Create `components/decision-detail.tsx`:
   - Slides in from the right or replaces the tree view (pick whichever the existing panel width supports — 360px is tight for both tree + detail side by side, so overlay/replace is likely better).

2. Four sections:

   **Section 1: Top Summary**
   - `title` (large text)
   - `content` (full text, scrollable if long)
   - `kind` badge
   - `status` badge

   **Section 2: Because (Rationale & Source)**
   - `rationale` text
   - "View source message" link — clicking scrolls the chat to the original message (using `created_from_message_id`). If the message is in a previous conversation segment, show "Source conversation archived" instead.
   - Confirmed timestamp (from decision_log where action='created').

   **Section 3: Relations**
   - List of connected decisions:
     - Outgoing: "supersedes [Decision Title]", "depends on [Decision Title]", "replaces [Open Question Title]"
     - Incoming: "superseded by [Decision Title]", "depended on by [Decision Title]", "replaced by [Decision Title]"
   - Each relation is clickable — navigates to that decision's detail panel.

   **Section 4: Actions**
   - **"Bring to sandbox"** button: reads `relevant_message_ids` from the decision, fetches those messages, and prints them into the chat area as a restored conversation context. The chat input becomes active for the user to continue. (This is a context restoration, not a truth mutation.)
   - **"Reference node"** button: inserts a formatted quote block into the current chat input at cursor position. Format: `> [Decision: {title}] {content}`. Does not send — just inserts into the draft.
   - **"Resolve as decision"** button (only shown when `kind = 'open_question'` and `status = 'active'`):
     - Opens a small inline form with fields: new `kind` (select from plan / constraint / principle / hypothesis / goal), new `title`, new `content`, new `rationale` (optional).
     - On submit, perform in a single transaction:
       1. INSERT a new `decisions` row with the form values, status='active'.
       2. INSERT an `edges` row: `source = new decision`, `target = the open_question`, `type = 'replaces'`.
       3. UPDATE the open_question's `status` to `'superseded'`.
       4. INSERT a `decision_log` row with `action = 'open_question_resolved'`, metadata referencing both ids.
     - After submit, the detail panel switches to show the newly created decision.

3. A close button (X) in the top-right returns to the tree view.

### Acceptance

- Clicking a tree node shows all four sections with correct data.
- "View source message" scrolls to the correct message in chat.
- "Bring to sandbox" restores conversation context in the chat area.
- "Reference node" inserts formatted text into the chat input without sending.
- For an `open_question` node, "Resolve as decision" appears; submitting the form creates a new decision, marks the open_question as superseded, and creates a `replaces` edge between them. The decision_log records `open_question_resolved`.
- Close button returns to the tree view.

---

## Task 5: Context Injection

### What It Does

Before each user message is sent to the AI model, Zeno injects relevant confirmed decisions into the system prompt so the model is aware of the project's decision state.

### Steps

1. Create `lib/context-assembly.ts`:
   - Export `async function assembleContext(topicId, projectId): string`.
   - Queries confirmed decisions for the topic (all kinds, including `open_question` and `rejection`).
   - Serializes them using `serializeDecisionGraph()`. The serializer must group by kind in this order so the injected text mirrors the by-type tree priority: open_questions → goals → constraints → plans → hypotheses → principles → rejections.
   - Returns a formatted string block to prepend to the system prompt.
   - Hard budget: the injected context must not exceed 5000 tokens. If the serialized graph exceeds this, apply this priority order when truncating:
     1. Always include all anchor decisions.
     2. Always include all open_questions (they are the highest-signal "what's still unknown").
     3. Always include all active rejections (they prevent the model from re-suggesting closed paths).
     4. Always include decisions in the depends_on chain of anchor decisions.
     5. Include key decisions, newest first.
     6. Include normal decisions, newest first, truncating to fit.
     7. Never include candidates.

2. Modify the chat API route:
   - Before calling the AI model, call `assembleContext()`.
   - Prepend the result to the system prompt as a clearly delimited block:
     ```
     <project_decisions>
     {serialized decision graph}
     </project_decisions>
     ```
   - If the topic is General, do NOT inject any decisions.

### Acceptance

- When chatting in a topic with confirmed decisions, the AI model is aware of them.
- Test: confirm a decision "Use PostgreSQL for the database", then ask "What database are we using?" — the model should reference PostgreSQL.
- Test: confirm a rejection "Do not use Firebase". Then ask "What about using Firebase?" — the model should acknowledge that Firebase was explicitly rejected.
- Test: confirm an open_question "Should we support mobile in V1?". Then ask "What's our stance on mobile?" — the model should treat this as undecided, not invent an answer.
- General topic conversations have no decision injection.
- Context injection stays under 5000 tokens even with 50+ decisions.

---

## Task 6: Inline Candidate Hints (Sandbox)

### What It Does

In the chat area, after an assistant message that triggered extraction, show a subtle hint.

### Steps

1. Create `components/candidate-hint.tsx`:
   - Renders at the bottom of the assistant message that triggered extraction.
   - Text: `+N candidate decisions` in monospace, low contrast.
   - Clicking expands a preview: shows candidate titles + kind badges. No action buttons — perception only. Actions happen in the candidate pool (Task 2).
   - After batch confirm, changes to: `✓ N decisions confirmed` (static, gray, non-interactive).

2. The component listens to Supabase Realtime for candidates linked to the specific message via `message_id`.

### Acceptance

- After assistant responds, within seconds a subtle "+N candidate decisions" hint appears.
- Clicking shows candidate previews inline.
- After confirming in the pool, hint changes to confirmed state.

---

## Task 7: MCP Server (Read-only Truth + Candidate-only Write)

### What It Does

Exposes Zeno as an MCP server so external coding agents (Claude Code, Cursor, etc.)
can read the project's confirmed truth and submit candidate decisions back. This
is what makes Zeno the SSOT that an external coding workflow consumes.

**Critical V1 boundary**: external agents can only WRITE candidates. They CANNOT
mutate any truth state directly. There is no `update_decision_status`, no
INSERT/UPDATE on `decisions`, no edge mutation, no delete. This is enforced at
the server level — the tools simply do not exist in V1.

### Steps

1. **Server setup**:
   - Add the MCP server as a route handler inside the main Next.js app (e.g. `app/api/mcp/route.ts`). Do NOT spin up a separate deployment — V1 traffic is fine on the main app.
   - Use the official Anthropic MCP TypeScript SDK.
   - Server URL exposed to users: `https://<your-zeno-host>/api/mcp`.

2. **Authentication — per-project API keys**:
   - Add a "API Keys for External Tools" section in the Settings page (per project).
   - "Generate Key" button: generate a token in the format `zn_<32 random chars>`.
   - The token is shown ONCE in a modal with a copy button. Show a clear warning: "This key will not be shown again. Copy it now."
   - Server-side: store `sha256(token)` in `api_keys.key_hash`, store the first 8 chars of the token in `api_keys.key_prefix` for UI identification, with the user-supplied label.
   - Each key is bound to exactly one (user_id, project_id) pair. Calls authenticated with this key can only access data within that project.
   - Key revocation: button next to each key in settings sets `revoked_at = now()`. Revoked keys return 401 immediately.
   - Every MCP request must include the key as a Bearer token in the `Authorization` header.

3. **Read-only tools (5)**:

   ```
   list_topics({ project_id })
     → returns Topic[] for the bound project
     // agent calls this first to know what topic_id to use for submit_candidate

   list_decisions({ project_id, topic_id?, kind?, status? })
     → returns Decision[] (filtered)

   get_decision({ decision_id })
     → returns Decision with edges

   list_open_questions({ project_id, topic_id? })
     → returns Decision[] where kind='open_question' AND status='active'
     // coding agent should call this at session start to see what's still unresolved

   list_rejections({ project_id, topic_id? })
     → returns Decision[] where kind='rejection' AND status='active'
     // coding agent should call this before suggesting an approach, to avoid recommending a closed path

   get_project_context({ project_id, topic_id? })
     → returns the same serialized output as the in-app context injection (calls serializeDecisionGraph)
     // for agents that want to inject Zeno truth into their own system prompt
   ```

4. **Write tool (exactly 1)**:

   ```
   submit_candidate({
     project_id,           // required; must match the API key's bound project
     topic_id,             // required; must belong to project_id
     proposed_title,       // required, string
     proposed_content,     // required, string
     proposed_kind,        // required, must be one of the 7 documented values
     proposed_rationale,   // optional
     external_evidence,    // optional; URL / file path / commit hash / short quote
     source_metadata       // optional; e.g. { agent: "claude-code", session_id: "..." }
   })
     → returns { candidate_id }
   ```

   Server-side behavior:
   - Validates `proposed_kind` against the 7-value list; returns 400 if invalid.
   - INSERTs into `candidate_decisions` with `status='pending'`, `source='mcp_agent'`.
   - If `proposed_kind = 'rejection'`, force `pre_selected = false` (same rule as the extraction prompt).
   - The owner sees the new candidate in the candidate pool, with the source badge identifying the agent (Task 2).

5. **Forbidden by design (do NOT implement these in V1)**:
   - Any direct INSERT/UPDATE/DELETE on `decisions`
   - Any creation of `edges`
   - Any tool named `update_decision_status`, `mark_implemented`, or similar
   - Any deletion of any entity
   - Any cross-project access (the API key's project_id is enforced on every call)

   The MCP server code should not even contain handlers for these. If a future contributor adds one, code review must reject it as a V1 boundary violation. Document this in the route file's header comment.

### Acceptance

- User can generate, copy, label, and revoke API keys in the Settings page. Revoked keys return 401.
- An external MCP client connected with a valid key can call all 6 tools (5 read + 1 write) successfully.
- Calling any tool with a key bound to project A but a `project_id` arg pointing to project B returns 403.
- `submit_candidate` with an invalid `proposed_kind` returns 400.
- `submit_candidate` with `proposed_kind='rejection'` results in a candidate row with `pre_selected=false`.
- Candidates submitted via MCP appear in the in-app candidate pool within 2 seconds (Realtime), with a "via {agent}" source badge.
- The MCP server exposes no tool that can mutate `decisions`, `edges`, or `decision_log`.

---

## Phase 2 Definition of Done

The complete decision loop works end-to-end:

1. User sends message → AI responds (streaming) → extraction runs async → candidates appear in pool + inline hint.
2. User reviews candidates in pool → confirms selected → decisions appear in tree.
3. User clicks a tree node → detail panel shows full info → can "bring to sandbox", "reference node", or (for open_questions) "Resolve as decision".
4. On next message, confirmed decisions (including open_questions and rejections) are injected into context → AI is aware of project state, including what's undecided and what's been ruled out.
5. Supersession works: new decision can supersede old one; resolving an open_question creates a `replaces` edge; old/resolved nodes appear dimmed in tree.
6. External agent (Claude Code or test client) can connect via MCP, read truth, and submit candidates that show up in the candidate pool.

**No regressions from Phase 1**: auth, layout, streaming, model selection all still work.

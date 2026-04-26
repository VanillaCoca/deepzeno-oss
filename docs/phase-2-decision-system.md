# Phase 2: Decision System + Extraction Pipeline

> **Audience**: This file is for Codex to execute. Lixian reviews the output.
> Sean validates the complete decision loop by testing real conversations.
>
> **Prerequisite**: Phase 1 is complete and verified. Auth, three-column layout,
> chat streaming, model selector, and database schema are all working.
>
> **Updated**: 2026-04-26 after design review session.

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
without breaking viewport fill, responsive behavior, or streaming UX.

---

## ⚠️ Non-Negotiable Architecture Principle — Read Before Any Task

**Truth tree is read-only from the UI.**

The only path to modify any confirmed judgment is through dialogue:
**拉入对话 → model understands intent → extraction emits new candidate (with `supersedes` edge if replacing an existing decision) → user confirms in candidate pool → old node automatically becomes superseded.**

No task in Phase 2 or later may introduce: an edit button on tree nodes, a manual supersede action, a version restore button, or any other UI affordance that mutates `decisions` rows directly without going through the candidate flow.

Rationale: every change to truth must pass through the model's understanding once, otherwise model-read context drifts from human-write state. This is non-negotiable architecture, not a UX preference.

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
     - Each candidate has: `proposed_title`, `proposed_content`, `proposed_rationale`, `proposed_kind`, `proposed_weight` (anchor|key|normal), `confidence` (0.0–1.0), `suggested_edges` (array of `{type, target_decision_id}`), `relevant_message_ids` (array of message UUIDs), `pre_selected` (boolean).
     - If no candidates are found, return an empty array.
     - Compare against existing decisions to avoid duplicates and to detect supersession.

   The system prompt MUST contain the following four blocks verbatim:

   **Block A — Kind taxonomy and discrimination rules**

   ```
   Extract candidates with one of these kinds:

   - goal: a desired outcome the project is trying to achieve.
   - constraint: a hard limit that must not be crossed.
   - plan: a chosen approach the user has decided to take.
   - hypothesis: an explicit assumption that could later be falsified.
   - principle: a durable guideline that applies broadly across the project.
   - open_question: something the user explicitly says is undecided, depends on
     later info, or "we'll figure out later". First-class signal — tells future
     readers what is still unknown.
   - rejection: an option the user explicitly considered AND explicitly chose not
     to pursue, with a stated or strongly implied reason.

   Discrimination rules:
   1. Uncertainty or "we'll decide later" → open_question. Do NOT collapse into plan or hypothesis.
   2. Comparing options or noting downsides is NOT rejection. Only definitive exclusion qualifies.
   3. A casual complaint ("X is annoying") is NOT a rejection.
   4. constraint = what cannot be done; rejection = specific option explicitly dropped.
   5. When in doubt between rejection and open_question, prefer open_question.
   ```

   **Block B — Rejection examples (concrete discrimination)**

   ```
   EXAMPLES — emit a rejection:
   - "不要做多人协作"
   - "V1 不考虑 BYOK"
   - "先不做 Council"
   - "这个方案排除"
   - "We've decided not to use Postgres; SQLite is enough."

   EXAMPLES — do NOT emit a rejection:
   - "Stripe 好像有点麻烦"       → skip, or low-confidence open_question
   - "多人协作可能复杂"           → skip, or open_question if user is weighing it
   - "BYOK 会影响订阅毛利"       → constraint or open_question, not rejection
   - "Council 成本比较高"         → comparative observation, skip
   ```

   **Block C — pre_selected default rules**

   ```
   For every candidate of kind=rejection, set pre_selected: false.
   The user must actively opt in to recording a rejection.

   For all other kinds, default pre_selected: true.

   For any candidate where confidence < 0.5, set pre_selected: false regardless of kind.
   ```

   **Block D — Supersession detection** *(new — critical for "modification only via dialogue")*

   ```
   When the user's statement modifies, refines, or contradicts an existing confirmed
   decision, extract a new candidate and include a supersedes edge in suggested_edges.

   Trigger signals:
   - Explicit: "Pr-003 应该改成..." / "这条判断不准，新版本是..."
   - Implicit: user re-states an existing judgment with a different core argument

   When suggested_edges contains a supersedes entry:
   - The new candidate's `proposed_rationale` MUST explain why the old version is
     no longer correct. This is required for version chain traceability.

   EXAMPLE:
     User: "confirmation 永远在用户，不只是 trust > recall"
     → proposed_kind: principle
       suggested_edges: [{ type: "supersedes", target_decision_id: "Pr-003" }]
       proposed_rationale: "原版本未显式表达确认权归属，新版本消除歧义"
   ```

4. Integrate into the chat flow:
   - After assistant response is fully streamed and message saved to DB, call `extractDecisions()` via `waitUntil()` or fire-and-forget. Do NOT await in the response stream.
   - Only trigger for non-General topics (`topics.is_general = false`).
   - Pass the assistant model name into `extractDecisions()` so it can be recorded.

5. Add an application-level validator in `extractDecisions()`:
   - If `proposed_kind` is not in the 7 documented values, log a warning and drop that candidate.

6. Source tracking:
   - Set `source = 'zeno_extraction'` and `source_metadata = { model: <model_name> }` on every internally extracted candidate.
   - Do NOT use `source = 'mcp_agent'` for internal extraction — that is reserved exclusively for candidates submitted via MCP `submit_candidate`.

### Acceptance

- After each assistant message in a non-General topic, candidates appear in `candidate_decisions` within 10 seconds.
- Duplicate extraction (same `content_hash` + `conversation_id`) is silently skipped.
- Extraction failure does not affect chat — user sees no error.
- `"V1 不考虑 BYOK"` → exactly 1 rejection candidate with `pre_selected = false`.
- `"Stripe 好像有点麻烦"` → no rejection candidate.
- `"先不决定，看实测情况"` → open_question candidate (NOT plan or hypothesis).
- User modifying an existing decision → candidate with `suggested_edges[type=supersedes]` and non-empty `proposed_rationale`.
- All candidates have `proposed_kind` in the 7 documented values; others dropped.
- Every candidate has `source = 'zeno_extraction'` and `source_metadata.model` populated.

---

## Task 2: Candidate Pool Panel

### What It Does

The right panel becomes the Truth Panel. At the top, a Candidate Pool shows pending candidates.

### Steps

1. Create `components/candidate-pool.tsx`:
   - Subscribes to Supabase Realtime on `candidate_decisions` where `topic_id = current topic` and `status = 'pending'`.
   - Each candidate card:
     - Title (bold)
     - Content (truncated to 2 lines, expandable)
     - Kind badge (color-coded; rejection has distinct visual treatment)
     - Checkbox (checked by default per `pre_selected` field)
     - Source badge: when `source !== 'zeno_extraction'`, show "via Claude Code" etc. (from `source_metadata.agent`)
     - If `external_evidence` exists, render as subtle link/snippet under content
   - Two action buttons at the bottom:
     - **Confirm Selected**: accepts all checked candidates (batch).
     - **Dismiss All**: rejects all pending candidates.

2. Implement `confirmCandidates(candidateIds[])` in `lib/candidate-actions.ts`:
   - For each accepted candidate, in a single transaction:
     - INSERT into `decisions` (copy `proposed_*` fields, `status = 'active'`).
     - If `suggested_edges` contains `supersedes` entries: INSERT edges + UPDATE target decision `status = 'superseded'` + INSERT `decision_log` with `action = 'superseded'`.
     - UPDATE `candidate_decisions`: `status = 'accepted'`, `resolved_decision_id`, `resolved_at`.
     - INSERT `decision_log` entries (`action = 'created'`, and `'superseded'` if applicable).
   - For each rejected candidate (unchecked):
     - UPDATE `candidate_decisions`: `status = 'rejected'`, `resolved_at`.
     - INSERT `decision_log` (`action = 'candidate_rejected'`).

3. Implement `dismissAllCandidates(topicId)`:
   - Sets all pending candidates for the topic to `status = 'rejected'`.
   - Inserts `decision_log` entries for each.

### Acceptance

- Candidates appear in the right panel within seconds of extraction completing.
- User can uncheck candidates, then click Confirm Selected.
- Candidate with `suggested_edges[type=supersedes]` confirmed → old node `status = superseded`, edge created, both logged in `decision_log`.
- Dismissed candidates disappear and don't return.

---

## Task 3: Decision Tree Panel

### What It Does

Below the candidate pool, confirmed decisions rendered as a tree.

### ⚠️ Tree displays active nodes only

Nodes with `status = 'superseded'` **never** appear in any tree view (by-type or by-relation). There is no status toggle. Version history is accessible only via the detail panel of the active version. A judgment occupies exactly one row in the tree — the current active version.

### Steps

1. Create `components/decision-tree.tsx`:
   - Two view modes toggled by a segmented control:

   **By Type**: decisions grouped under collapsible headers by `kind`, active nodes only.
   Fixed group order:
   1. Open Questions
   2. Goals
   3. Constraints
   4. Plans
   5. Hypotheses
   6. Principles
   7. Rejections (default collapsed)

   Empty groups hidden entirely. Show count: `Goals (3)`.

   **By Relation**: tree structure from anchor decisions as roots.
   - `depends_on` edges → indented children
   - `resolved_by` edges (open_question → decision) → distinct visual indicator, e.g. `↳ resolved by`
   - `supersedes` edges (version chain) → **never rendered in tree**; live exclusively in detail panel Section 5
   - Orphan decisions (no edges) → separate "Standalone" section at bottom

   Visual distinctions per kind:
   - `open_question`: amber `?` prefix — communicates "unresolved"
   - `rejection`: strikethrough title, low opacity — communicates "not doing this"
   - Other kinds: standard badge styling
   - No status badge needed — tree only contains active nodes

2. Tree uses Supabase Realtime to update when new decisions are confirmed.

### Acceptance

- After confirming candidates, new decisions appear in tree without page refresh.
- Both view modes render with active nodes only — no superseded nodes visible.
- By-type: correct priority order, empty groups hidden, Rejections collapsed by default.
- By-relation: `resolved_by` edges visually distinct; `supersedes` edges absent entirely.
- No status toggle exists in the toolbar.
- Clicking a node opens the detail panel.

---

## Task 4: Node Detail Panel

### What It Does

When a tree node is clicked, a detail panel slides in showing full information, relationships, version history, and action buttons.

### Steps

1. Create `components/decision-detail.tsx`. Five sections:

   **Section 1: Top Summary**
   - `title` (large text), `kind` badge, `status` badge (always "active" — tree only contains active nodes)
   - `content` (full text, scrollable)

   **Section 2: Because (Rationale)**
   - `rationale` text — left-bordered callout block
   - Confirmed timestamp (from `decision_log` where `action = 'created'`)

   **Section 3: Relations**
   Shows `depends_on` and `resolved_by` edges only. `supersedes` edges (version chain) are excluded — they live in Section 5.
   - Outgoing: "depends on [Title]", "resolves → [Open Question Title]"
   - Incoming: "depended on by [Title]", "resolved by [Title]"
   - Each relation clickable — navigates to that node's detail panel

   **Section 4: Actions**

   > ⚠️ Complete list — V1. No other buttons exist.

   - **拉入对话**: injects this node's structured content (title + content + because) as a contextual message into the current active conversation. The model reads it; the user continues discussing from there. This is the entry point for modifying any judgment.
     - When `kind = 'open_question'`: label changes to "讨论这个问题".
   - **引用**: inserts a formatted quote block into the current chat input at cursor position. Format: `> [ID · kind] title\n> content`. Does not send — user writes their own prompt after the quote.
   - **解决为决策**: shown ONLY when `kind = 'open_question'` AND `status = 'active'`. Opens inline form: new `kind` (select from plan/constraint/principle/hypothesis/goal), `title`, `content`, `rationale` (optional). On submit, in a single transaction:
     1. INSERT new `decisions` row, `status = 'active'`.
     2. INSERT `edges` row: `source = new decision`, `target = open_question`, `type = 'resolved_by'`.
     3. UPDATE open_question `status = 'superseded'`.
     4. INSERT `decision_log` with `action = 'open_question_resolved'`.
     After submit, panel transitions to the newly created decision.
   - **NOT in V1**: edit, manual supersede, version restore, view source.

   **Section 5: Version History**
   Displayed only when current active node has ≥1 superseded predecessor in its `supersedes` chain.
   - Default: collapsed. Header: `历史版本 (N 次变更)`.
   - Expanded: list rows — `vN · date · one-line summary` (first sentence of that version's `rationale`).
   - Clicking a row: inline accordion expands to show that version's full `content` + `rationale` + `confirmed_in`.
   - No "restore to this version" button — restore via 拉入对话 → dialogue → new candidate.

   Data: traverse `superseded_by ← supersedes` chain from current node, collecting all `status = 'superseded'` predecessors chronologically.

2. Close button (X) in top-right returns to tree view.

### Acceptance

- Clicking a tree node shows all five sections with correct data.
- Section 3: only `depends_on` and `resolved_by` edges — no `supersedes` edges.
- Section 4: exactly three buttons: 拉入对话, 引用, and (OQ only) 解决为决策. No other buttons.
- 引用 inserts formatted quote into chat input without sending.
- Section 5 appears only when version history exists; default collapsed; each version inline expandable.
- No edit button, no manual supersede button, no view source button, no version restore.
- After resolving OQ: panel transitions to new decision without close/reopen flash.

---

## Task 5: Context Injection

### What It Does

Before each user message, Zeno injects relevant confirmed decisions into the system prompt.

### Steps

1. Create `lib/context-assembly.ts`:
   - Export `async function assembleContext(topicId, projectId): string`.
   - **Query decisions where `status = 'active'` only.** Superseded nodes are excluded — they represent historical truth and would mislead the model about current project state. Injecting superseded nodes contradicts the "modification only via dialogue" architecture.
   - Serialize using `serializeDecisionGraph()`. Group order: `open_questions → goals → constraints → plans → hypotheses → principles → rejections`.
   - Hard budget: injected context must not exceed 5000 tokens. Truncation priority:
     1. All anchor decisions
     2. All `open_questions`
     3. All active rejections
     4. Decisions in `depends_on` chain of anchors
     5. Key decisions, newest first
     6. Normal decisions, newest first — truncate to fit
     7. Never candidates

2. Modify chat API route:
   - Before calling AI model, call `assembleContext()`.
   - Prepend result to system prompt:
     ```
     <project_decisions>
     {serialized decision graph}
     </project_decisions>
     ```
   - If topic is General, do NOT inject any decisions.

### Acceptance

- Only `status = 'active'` decisions are injected — no superseded nodes.
- Test: confirm "Use PostgreSQL". Ask "What database?" → model references PostgreSQL.
- Test: confirm rejection "Do not use Firebase". Ask "What about Firebase?" → model acknowledges rejected.
- Test: confirm OQ "Should we support mobile in V1?". Ask "What's our stance?" → model treats as undecided.
- General topic: no injection.
- Context stays under 5000 tokens with 50+ decisions.

---

## Task 6: Inline Candidate Hints

### What It Does

After an assistant message that triggered extraction, show a subtle hint in the chat area.

### Steps

1. Create `components/candidate-hint.tsx`:
   - Renders at the bottom of the assistant message that triggered extraction.
   - Text: `+N candidate decisions` — monospace, low contrast.
   - Clicking expands a preview: candidate titles + kind badges. No action buttons — perception only. Actions happen in the candidate pool (Task 2).
   - After batch confirm: changes to `✓ N decisions confirmed` (static, gray, non-interactive).

2. Listens to Supabase Realtime for candidates linked to the specific message via `message_id`.

3. Agent-sourced hints (`source = 'mcp_agent'`):
   - Not anchored to an assistant message — render as separate notification at top of chat area.
   - Format: `+N from {agent_name}` (e.g. `+2 from Claude Code`), from `source_metadata.agent`.
   - Same expand-to-preview behavior. On confirm: `✓ N from {agent_name} confirmed`.

### Acceptance

- After assistant responds, `+N candidate decisions` hint appears within seconds.
- Clicking shows candidate previews inline.
- After confirming in pool, hint changes to confirmed state.
- MCP-sourced hints render as `+N from {agent}` and are not anchored to a chat message.

---

## Task 7: MCP Server

### What It Does

Exposes Zeno as an MCP server so external coding agents can read confirmed truth and submit candidate decisions. External agents can only WRITE candidates — they cannot mutate truth state directly.

### Steps

1. Add MCP server as route handler inside the main Next.js app (`app/api/mcp/route.ts`). Do NOT spin up a separate deployment.

2. Authentication — per-project API keys:
   - "Generate Key" button in Settings: format `zn_<32 random chars>`.
   - Shown ONCE with copy button. Store `sha256(token)` in `api_keys.key_hash`.
   - Each key bound to exactly one `(user_id, project_id)` pair.
   - Key revocation: `revoked_at = now()`. Revoked keys return 401 immediately.

3. Read-only tools (5):
   ```
   list_topics({ project_id })
   list_decisions({ project_id, topic_id?, kind?, status? })
   get_decision({ decision_id })
   list_open_questions({ project_id, topic_id? })
   list_rejections({ project_id, topic_id? })
   get_project_context({ project_id, topic_id? })
   ```

4. Write tool (exactly 1):
   ```
   submit_candidate({
     project_id,           // required
     topic_id,             // required
     proposed_title,       // required
     proposed_content,     // required
     proposed_kind,        // required; must be one of 7 documented values
     proposed_rationale,   // optional
     external_evidence,    // optional
     source_metadata       // optional; e.g. { agent: "claude-code" }
   })
   → returns { candidate_id }
   ```
   - Validates `proposed_kind`; returns 400 if invalid.
   - INSERTs into `candidate_decisions` with `source = 'mcp_agent'`.
   - If `proposed_kind = 'rejection'`, force `pre_selected = false`.

5. Forbidden by design — do NOT implement in V1:
   - Any direct INSERT/UPDATE/DELETE on `decisions`
   - Any creation of `edges`
   - Any tool named `update_decision_status`, `mark_implemented`, or similar
   - Any deletion of any entity
   - Any cross-project access

   Document this in the route file's header comment. If a future contributor adds one, code review must reject it as a V1 boundary violation.

### Acceptance

- User can generate, copy, label, and revoke API keys. Revoked keys return 401.
- External MCP client can call all 6 tools (5 read + 1 write) successfully.
- Calling any tool with a key bound to project A but `project_id` pointing to project B returns 403.
- `submit_candidate` with invalid `proposed_kind` returns 400.
- `submit_candidate` with `kind = 'rejection'` → `pre_selected = false`.
- Candidates submitted via MCP appear in candidate pool within 2 seconds, with "via {agent}" badge.
- MCP server exposes no tool that can mutate `decisions`, `edges`, or `decision_log`.

---

## Phase 2 Definition of Done

1. Message → streaming → extraction async → candidates in pool + inline hint.
2. Review candidates → confirm → active decisions appear in tree.
3. Click tree node → detail panel: top summary / rationale / relations (no supersedes) / actions (拉入对话, 引用, 解决为决策 for OQ) / version history (collapsed if exists).
4. Next message → active decisions injected → AI aware of current project state including what's undecided and what's been ruled out.
5. Supersession: candidate with `supersedes` edge confirmed → old node disappears from tree → version history accessible in new node's detail panel.
6. Resolving OQ: `resolved_by` edge created; OQ disappears from tree.
7. External agent: MCP read/submit works; no truth mutation possible.

**Explicit non-goals confirmed in design review:**
- No edit button on tree nodes
- No manual supersede button
- No version restore button
- No "查看来源" / view source button
- No superseded nodes in any tree view
- No status toggle in tree toolbar
- No parallel model-read memory store

**No regressions from Phase 1**: auth, layout, streaming, model selection all still work.

# Phase 2: Decision System + Extraction Pipeline

*Updated after design review · 2026-04-26*

## Audience & Prerequisites

For Codex to execute. Lixian reviews. Sean validates by testing real conversations.

Prerequisite: Phase 1 complete — auth, three-column layout, chat streaming, model selector, database schema all working.

## Non-Negotiable Architecture Principle — Read Before Any Task

Truth tree is read-only from the UI.

The only path to modify any confirmed judgment is:

> 拉入对话 → model understands intent → extraction emits new candidate (with supersedes edge if replacing existing) → user confirms → old node automatically becomes superseded.

No task in Phase 2 or later may introduce: edit button on tree nodes, manual supersede action, version restore button, or any UI affordance that mutates decisions rows without going through the candidate flow.

Rationale: every change to truth must pass through the model once, otherwise model-read context drifts from human-write state.

---

## Task 1: Async Decision Extraction Pipeline

### What It Does

After each assistant message is saved, a background process extracts decision candidates and writes them to `candidate_decisions`. Supabase Realtime notifies the frontend.

### Steps

#### 1–3. `lib/decision-extraction.ts`, `lib/decision-serializer.ts`, `lib/prompting.ts`

Architecture unchanged from original spec. See extraction prompt blocks below — Block D is new.

#### Block A — Kind taxonomy

```text
goal / constraint / plan / hypothesis / principle / open_question / rejection
```

Rules:

- uncertainty → open_question
- Comparing options ≠ rejection
- Casual complaint ≠ rejection
- constraint = what cannot be done
- rejection = specific option explicitly dropped
- When in doubt between rejection and open_question, prefer open_question

#### Block B — Rejection examples

Emit rejection:

```text
'不要做多人协作' / 'V1 不考虑 BYOK' / '先不做 Council' / '这个方案排除'
```

Do NOT emit:

```text
'Stripe 好像有点麻烦' (skip) / 'BYOK 会影响毛利' (constraint or OQ)
```

#### Block C — `pre_selected` defaults

```text
kind=rejection → pre_selected: false | confidence < 0.5 → pre_selected: false
```

All other kinds → `pre_selected: true`

#### Block D — Supersession detection (NEW — critical)

**Why this matters**

This block is what makes “modification only via dialogue” work end-to-end. Without it, supersede edges never auto-generate, and the version history chain in the detail panel stays empty.

When user's statement modifies/refines/contradicts an existing confirmed decision:

```text
→ extract new candidate with suggested_edges: [{type:'supersedes', target_decision_id: X}]
→ candidate's 'because' MUST explain why the old version is no longer correct
```

Trigger signals:

- Explicit: `Pr-003 应该改成...` / `这条判断不准，新版本是...`
- Implicit: user re-states an existing judgment with different core argument

Example:

```text
User: 'confirmation 永远在用户，不只是 trust > recall'
→ kind=principle, suggested_edges:[{type:'supersedes', target:'Pr-003'}]
  because: '原版未显式表达确认权归属'
```

#### 4–6. Integration, validation, source tracking

Unchanged: fire-and-forget after assistant message saved; General topic excluded; `source=zeno_extraction` with `source_metadata.model`.

### Acceptance

- Candidates appear within 10s after assistant message in non-General topic
- `'V1 不考虑 BYOK'` → exactly 1 rejection candidate, `pre_selected=false`
- `'先不决定，看实测情况'` → open_question (NOT plan/hypothesis)
- User modifying existing decision → candidate with `suggested_edges[supersedes]` and non-empty `because`
- All candidates have `proposed_kind` in 7 documented values; others dropped
- Every candidate has `source=zeno_extraction` and `source_metadata.model` populated

---

## Task 2: Candidate Pool Panel

### Steps

#### 1. `components/candidate-pool.tsx`

- Realtime subscription on `candidate_decisions` for current topic, `status='pending'`
- Each card: title, content (2 lines, expandable), kind badge, checkbox (`pre_selected` default), source badge (`via Claude Code` etc.)
- Actions: `Confirm Selected` (batch) and `Dismiss All`

#### 2. `lib/candidate-actions.ts` — `confirmCandidates(candidateIds[])`

In a single transaction per accepted candidate:

1. INSERT into `decisions` (copy `proposed_*` fields, `status='active'`)
2. If `suggested_edges` contains supersedes entries: INSERT edge + UPDATE target status→`superseded` + INSERT `decision_log action='superseded'`
3. UPDATE `candidate_decisions`: `status='accepted'`, `resolved_decision_id`, `resolved_at`
4. INSERT `decision_log`: `action='created'` (and `superseded` if applicable)

The supersedes handling is the mechanism for “modification via dialogue” producing the version chain. Must be transactional.

### Acceptance

- Confirmed candidates appear in tree (Task 3)
- Candidate with `suggested_edges[supersedes]` confirmed → old node `status=superseded`, edge created, both logged
- Dismissed candidates disappear and don't return

---

## Task 3: Decision Tree Panel

### Tree displays active nodes only

Nodes with `status='superseded'` NEVER appear in any tree view (by-type or by-relation).

No “show superseded” toggle exists. Version history is accessible only via the detail panel of the active version.

A judgment occupies exactly one row in the tree — the current active version.

### By-type view

Fixed group order (what does user need first when resuming work):

1. Open Questions
2. Goals
3. Constraints
4. Plans
5. Hypotheses
6. Principles
7. Rejections (default collapsed)

Empty groups hidden entirely. Show count: `Goals (3)`. Smooth expand/collapse animation.

### By-relation view

- `depends_on` edges → indented children
- `resolved_by` edges (`open_question` → decision) → distinct visual indicator, e.g. `↳ resolved by`
- `supersedes` edges (version chain) → NEVER rendered in tree; live in detail panel Section 5 only
- Orphan decisions (no edges) → separate `Standalone` section at bottom

### Visual distinctions

- `open_question`: amber `?` prefix — communicates `unresolved`
- `rejection`: strikethrough title, low opacity — communicates `not doing this`
- No status badge needed — tree only contains active nodes

### Acceptance

- Both view modes: active nodes only, no superseded nodes visible
- By-type: correct priority order, empty groups hidden, Rejections collapsed by default
- By-relation: `resolved_by` edges visually distinct; `supersedes` edges absent entirely
- No status toggle exists in toolbar

---

## Task 4: Node Detail Panel

### Five sections

#### Section 1: Top Summary

- title, kind badge, status badge (always `active` — only active nodes have a panel)
- content (full, scrollable)

#### Section 2: Because (Rationale)

- rationale text — left-bordered callout block
- Confirmed timestamp from `decision_log` where `action='created'`

#### Section 3: Relations

Shows `depends_on` and `resolved_by` edges only. `supersedes` edges (version chain) are EXCLUDED — they live in Section 5.

- Outgoing: `depends on [Title]`, `resolves [Open Question Title]`
- Incoming: `depended on by [Title]`, `resolved by [Title]`
- Each clickable — navigates to that node's detail panel

#### Section 4: Actions

**Complete action button list — V1. No others.**

- `拉入对话`: injects node's structured content (title + content + because) as a contextual message into the current conversation. Model reads it; user discusses from there. Entry point for modifying any judgment.
  - When `kind='open_question'`: label changes to `讨论这个问题`.
- `查看来源`: loads the conversation segment identified by `created_from_message_id`. Past segments load as read-only view.
- `解决为决策`: shown ONLY for `kind='open_question'` AND `status='active'`. Opens inline form: new kind + title + content + rationale. On submit: creates new decision + `resolved_by` edge + marks OQ as superseded. Rendered as primary action. Panel transitions to new decision after submit.

NOT in V1: edit, manual supersede, version restore, reference node.

#### Section 5: Version History (new)

- Displayed only when current active node has ≥1 superseded predecessor in its supersedes chain
- Default: collapsed. Header: `历史版本 (N 次变更)`
- Expanded: list rows showing vN + date + one-line summary (first sentence of that version's because)
- Clicking a row: inline accordion expands to show that version's content + because + confirmed_in
- No `restore to this version` button — restore via `拉入对话 → dialogue → new candidate`

Data: traverse `superseded_by ← supersedes` chain from current node, collect all superseded predecessors chronologically.

### Acceptance

- Section 3 shows only `depends_on` and `resolved_by` edges — no `supersedes` edges
- Section 4 has exactly: `拉入对话`, `查看来源`, and (OQ only) `解决为决策`. No other buttons.
- Section 5 appears only when version history exists; default collapsed; each version inline expandable
- No edit button, no manual supersede button, no version restore anywhere
- After resolving OQ: panel transitions to new decision without close/reopen flash

---

## Task 5: Context Injection

### Active nodes only

Query decisions where `status='active'` only. Superseded nodes excluded — they represent historical truth and would mislead the model. Injecting superseded nodes directly contradicts “modification only via dialogue”.

Serialize using `serializeDecisionGraph()`.

Group order:

```text
open_questions → goals → constraints → plans → hypotheses → principles → rejections
```

Hard budget: 5000 tokens.

Truncation priority if over budget:

1. All anchor decisions
2. All open_questions
3. All active rejections
4. Decisions in `depends_on` chain of anchors
5. Key decisions, newest first
6. Normal decisions, newest first — truncate to fit
7. Never candidates

### Acceptance

- Only active decisions injected — no superseded nodes in context
- General topic: no injection
- Context stays under 5000 tokens with 50+ decisions

---

## Task 6: Inline Candidate Hints

Unchanged from original spec.

- `+N candidate decisions` hint at bottom of triggering assistant message
- Expands on click to show titles + kind badges (perception only, no actions)
- After batch confirm: `✓ N decisions confirmed` (static, gray)
- Realtime subscription on `message_id`

---

## Task 7: MCP Server

Unchanged from original spec.

5 read-only tools + 1 write tool (`submit_candidate` only). External agents can read truth and submit candidates. Cannot mutate decisions, edges, or status directly. Per-project API keys with sha256 storage.

### Forbidden by design — do NOT implement in V1

- Any INSERT/UPDATE/DELETE on `decisions`
- Any tool named `update_decision_status`, `mark_implemented`, or similar
- Any creation of edges from external tools
- Any cross-project access

Document this in the route file header comment so future contributors don't add them.

---

## Phase 2 Definition of Done

1. Message → streaming → extraction async → candidates in pool + inline hint
2. Review candidates → confirm → active decisions appear in tree
3. Click tree node → detail panel: summary / rationale / relations (no supersedes) / actions (`拉入对话`, `查看来源`, `解决为决策` for OQ) / version history (collapsed if exists)
4. Next message → active decisions injected → AI aware of current project state
5. Supersession: candidate with supersedes edge confirmed → old node disappears from tree → version history accessible in new node's detail panel
6. Resolving OQ: `resolved_by` edge created; OQ disappears from tree
7. External agent: MCP read/submit works; no truth mutation possible

---

## Explicit non-goals confirmed in design review

- No edit button on tree nodes
- No manual supersede button
- No version restore button
- No superseded nodes in any tree view
- No status toggle in tree toolbar
- No parallel model-read memory store (compiler derives context from truth tree on each conversation start)

---

**ZENO · Phase 2 Spec · Updated 2026-04-26**

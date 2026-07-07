# Example Projects Seeding — Design

**Date:** 2026-07-07
**Status:** Approved (domains + structure), implementing

## Goal

Every new Deepzeno user should find their Library already populated with **two
ready-made, interactive example projects** — one English, one Chinese — right
after login. This mirrors Google NotebookLM's example notebooks: a new user
never faces an empty workspace and can immediately see, and click into, what
Deepzeno is for. The examples must be unmistakably **official** and rich enough
to **showcase the truth-graph's value** (structured judgment, candidate → truth
confirmation, rejected options, open questions), not a toy.

## Form: per-user, editable, real rows

The examples are seeded as **real `ir_nodes`/`ir_edges` rows owned by the user**
(not a global read-only sample). The user can open the truth graph, confirm a
candidate into a truth, edit, or delete — the full interaction. Read-only
samples would remove exactly the interaction we want to demonstrate.

## Trigger + idempotency

- **Primary trigger:** `HomepageContent` in `app/page.tsx` (the Library home,
  where login lands). It's already an async component inside `<Suspense>`, so a
  `cookies()`-touching seed call there is safe from the Next 16 blocking-route
  build failure. Before listing summaries, it calls
  `ensureExampleProjectsSeeded({ userId, userEmail })`.
- **Fallback trigger:** the zero-project branch of `bootstrapWorkspace`
  (`lib/workspace/service.ts`) also calls it, so a user who deep-links straight
  into a workspace still gets seeded. If seeding yields zero projects (failure),
  bootstrap falls back to the existing blank `provisionProjectBundle` so the
  workspace never breaks.
- **Idempotent:** seed only when the user has **0 projects**
  (`listProjectsByUserId`). Deleting the examples does not regenerate them.
- **Never blocks login:** `ensureExampleProjectsSeeded` catches and logs any
  error internally; a seed failure degrades to an empty Library, not a crash.

## Structure (per example project)

Driven by two rendering facts verified in the code:

1. The truth graph is **topic-scoped** (`ir-provider.tsx` fetches lists by
   `activeTopicId`); an edge renders only if **both endpoints are in the active
   topic** (`truth-graph/data.ts`). → Concentrate the rich graph in one topic;
   keep every rendering edge intra-topic.
2. Only `depends_on / refines / resolves / implies` draw as flow edges
   (`FLOW_RELATIONS` in `data.ts`). `supersedes` and `contradicts` exist as data
   but **do not render**. → Show judgment via **rejection nodes** and a
   **pending candidate that `resolves` an open question**, not via invisible
   supersedes/contradicts edges. (This is the proven `scripts/seed-zeno-demo.ts`
   recipe.)

Each project therefore has:

- A **`is_general` landing topic** ("Start here" / "从这里开始", position 0 →
  becomes `primaryTopicId`, so the project opens here). It holds **no graph
  nodes** — just an official **welcome message** in its conversation that names
  the project as a Deepzeno example, explains the truth graph, and walks the
  user through confirming a candidate. (General topics don't get truth-graph
  context injection by design, so decision content lives in the topics below.)
- A **primary content topic** (position 1) — the rich, interconnected graph
  (~9 nodes, ~8 edges): goal, constraints, a hypothesis, decisions, a
  principle, a **rejection**, an **open question**, and a **pending candidate
  that resolves that question** (the marquee "confirm a candidate" moment).
- **Two supporting topics** (positions 2–3, ~5–6 nodes each) exercising the
  topic switcher and adding depth, each a valid small graph with its own
  candidate/rejection/question.

~20 nodes and ~17 edges per example (2 pending candidates each); full kind
coverage (goal, constraint, plan:decision/task/milestone, hypothesis,
principle, open_question, rejection).

### The two examples

- **English — business strategy:** `✦ Deepzeno Example · Go-to-Market for a SaaS`.
  A two-person team taking a B2B analytics product to market. Topics:
  *Positioning & Motion* (primary), *Pricing & Packaging*, *Launch Plan*.
- **Chinese — high-stakes personal decision:** `✦ Deepzeno 示例 · 新一线城市定居决策`.
  A family deciding whether to leave a tier-1 city to settle and buy a home in a
  new tier-1 city. Topics: *决策主线* (primary), *职业发展*, *生活与家庭*.

Both languages are always seeded for every user (a Chinese user still gets the
English example and vice-versa) — it also demonstrates Deepzeno handles both.

## Official-example identity

- Distinct project-name prefix visible in the Library grid: `✦ Deepzeno
  Example ·` / `✦ Deepzeno 示例 ·`.
- An official welcome message (in the example's own language) in the landing
  topic's conversation.

## Insert mechanics

- **Skeleton** (project, topics, conversations) via existing tested helpers
  `createProjectForUser` / `createTopicForProject` / `createConversation`.
- **IR nodes/edges** via the service-role admin client (`getSupabaseAdminClient`)
  direct inserts — the only way to seed `status:'active'` truths and `pending`
  candidates directly (the sanctioned `createIRNodeForUser` is pending/idea
  only). INSERTs are exempt from the status-transition trigger.
- **Node ids** continue the global per-prefix sequence via a shared allocator
  that queries the current max per prefix (`getIRPrefix` for the prefix), like
  `seed-demo`. One allocator shared across both projects so ids never collide.
- **`parent_id` is omitted entirely** (not set to null) — the column exists only
  in the Drizzle schema, not the Supabase migrations, so omitting it is safe on
  both DB states. Examples are flat (no sub-nodes).
- Node row: `content = rationale` (matches `seed-demo`); `source_layer` =
  `manual` for truths, `sweep` for candidates; `created_by:'ai'`;
  `confirmed_at` for active, `promoted_to_pending_at` for pending.
- Edge row: `status:'active'`, `is_anchor_hint:false` (active edges render in
  both Truth and All where endpoints are visible).
- **Welcome message** via the `seedKickoffIntake` triad (`saveChat` +
  `saveMessages` + `saveWorkspaceMessages`) into the landing topic's
  conversation.

## Files

- `lib/workspace/example-content.ts` — pure content data (the two example specs).
- `lib/workspace/example-projects.ts` — `ensureExampleProjectsSeeded`,
  `seedExampleProjectsForUser`, the id allocator, node/edge/welcome inserts.
- `app/page.tsx` — call `ensureExampleProjectsSeeded` in `HomepageContent`.
- `lib/workspace/service.ts` — call it in the `bootstrapWorkspace` zero-project
  branch with a blank-project fallback.

## Out of scope

- No re-seed after deletion, no versioning/migration of already-seeded examples,
  no admin UI. A future "reset examples" action can be added if wanted.

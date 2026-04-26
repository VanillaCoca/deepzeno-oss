# Phase 3: Interaction Polish + Sidebar + Sandbox Navigation

> **Audience**: This file is for Codex to execute, but Sean will provide
> frequent feedback during this phase. Expect multiple iteration rounds.
> Each sub-task may go through 2–3 revision cycles based on Sean's testing.
>
> **Prerequisite**: Phase 2 is complete. The full decision loop
> (chat → extract → confirm → tree → context injection) works end-to-end.
>
> **Updated**: 2026-04-26 after design review session.

---

## Context for Codex

Phase 3 is about making the product feel right. The core loop works, but the
interactions need refinement. Sean will test each feature and provide specific
feedback. Expect to receive follow-up instructions like "the animation is too
slow" or "the panel transition feels janky" — these are normal iteration, not bugs.

**UX PRESERVATION RULE (from Phase 1, still applies):**
Full-viewport layout, responsive behavior, and streaming UX quality from the
vercel/chatbot template must never degrade. Polish means making things better
than the template baseline, never worse.

---

## Task 1: Project Sidebar — Full Implementation

### What It Does

Replace the Phase 1 placeholder sidebar with a functional project + topic navigation system.

### Steps

1. Modify `components/project-sidebar.tsx`:

   **Top section: Project selector**
   - Dropdown showing the user's projects.
   - "New Project" button below the dropdown.
   - Creating a project: modal with name input. On create, auto-provision a General topic.

   **Middle section: Topics list**
   - Shows all non-archived topics for the selected project.
   - Each topic item shows: label, unread candidate count badge (if any pending candidates).
   - Clicking a topic switches the sandbox and truth panel to that topic's context.
   - "New Topic" button at the bottom of the list. On create: modal with label input, inserts with next position value.
   - The General topic is always first and cannot be archived.
   - Drag-to-reorder topics (optional — skip if complex, just use position field ordering).

   **Bottom section: Archived topics**
   - Collapsible section labeled "Archived".
   - Shows topics with `archived_at` set.
   - Clicking an archived topic shows it read-only (chat history viewable, no new messages, tree viewable).
   - No unarchive action in V1.

2. Implement topic archiving:
   - Right-click or three-dot menu on a non-General topic → "Archive".
   - Sets `archived_at = now()` on the topic.
   - Topic moves to the Archived section.

3. When switching topics:
   - Sandbox loads the most recent conversation segment for that topic.
   - Truth panel (tree + candidate pool) loads that topic's decisions and candidates.
   - If no conversation exists for the topic, create one automatically.

### Acceptance

- User can create projects and topics.
- Switching topics updates both the chat and the truth panel.
- General topic is always first and not archivable.
- Archived topics appear in collapsed section.
- Pending candidate count badge shows on topics with unreviewed candidates.

---

## Task 2: Sandbox Navigation — Conversation Segments

### What It Does

Users can clear the sandbox (start a fresh conversation) and navigate between
previous conversation segments using back/forward.

### Steps

1. Add toolbar buttons above the chat input:
   - **Clear** (eraser icon): closes the current conversation (`ended_at = now()`) and creates a new empty conversation for the same topic. Old messages disappear from view but are preserved in DB.
   - **Back** (left arrow): navigate to the previous conversation segment. Chat input is active — typing resumes that segment.
   - **Forward** (right arrow): navigate to the next conversation segment.

2. Conversation segment state:
   - Track `currentConversationId` in React state (or URL param).
   - When viewing an older segment, forward button is active.
   - When at the latest segment, forward is disabled.
   - Back is disabled when at the oldest segment.
   - Switching to a topic always shows the most recent conversation segment.

### Acceptance

- Clear creates a new conversation and hides old messages.
- Back/forward navigate between conversation segments within the same topic.
- Typing in an old segment appends to that segment (resumes it).
- Experience feels like a sessionless, continuous chat surface.

---

## Task 3: Streaming Scroll Behavior

### What It Does

Fix the most common streaming UX issue: the page auto-scrolling while the user is trying to read.

### Steps

1. Implement scroll-intent detection in the chat message list:
   - If user is scrolled to the bottom (within 100px threshold): auto-scroll as new tokens arrive.
   - If user has scrolled up to read: STOP auto-scrolling. Content continues to arrive but doesn't pull the viewport.
   - When user scrolls back to bottom: resume auto-scroll.

2. Add a "scroll to bottom" floating button that appears when user is scrolled up and new content is arriving below.

3. Verify this works with long streaming responses (1000+ tokens).

### Acceptance

- During streaming, if user is at bottom: page scrolls smoothly with new content.
- If user scrolls up during streaming: scrolling stops, content continues to arrive without pulling viewport.
- "Scroll to bottom" button appears and works correctly.
- No jank or flicker during streaming.

---

## Task 4: Tree Panel View Mode Polish

### What It Does

Refine the two tree view modes from Phase 2.

> **Changes from original spec:**
> 1. Status toggle removed — tree shows active nodes only; no toggle exists.
> 2. `supersedes` edges removed from by-relation rendering — version chains live in the detail panel's version history section, not in the tree.
> 3. `replaces` renamed to `resolved_by` throughout — consistency with Phase 2 schema.

### Steps

1. **By-type view** improvements:
   - Collapsible section headers for each kind, in fixed priority order:
     1. Open Questions
     2. Goals
     3. Constraints
     4. Plans
     5. Hypotheses
     6. Principles
     7. Rejections (default collapsed; all others default expanded)
   - Show count next to header: `Goals (3)`.
   - Empty sections hidden entirely — no `Hypotheses (0)` empty header.
   - Smooth expand/collapse animation (200–250ms ease).

2. **By-relation view** improvements:
   - Anchor decisions render as root nodes.
   - `depends_on` edges render as indented children.
   - `resolved_by` edges (open_question → decision) render with a distinct visual indicator (e.g. `↳ resolved by` label).
   - `supersedes` edges (version chain) are **not rendered in the tree** — they live exclusively in the detail panel's version history section.
   - Orphan decisions (no edges) appear in a separate "Standalone" section at the bottom.

3. **Status toggle — removed:**
   The original spec included a 2-state toggle ("Active only" / "Show all"). This is removed. The tree always shows active nodes only. There is no toggle, no "Show all" mode, no dimmed superseded nodes. Version history is accessible via the detail panel.

### Acceptance

- Both view modes render cleanly with real data (10+ decisions, 5+ edges).
- By-type: groups in priority order, empty groups hidden, counts shown, Rejections collapsed by default.
- By-relation: `depends_on` as indented children; `resolved_by` edges with distinct visual treatment; orphans in Standalone section.
- No `supersedes` edges visible anywhere in the tree.
- No status toggle in the tree toolbar.
- Sections collapse/expand smoothly with no layout jumps (200–250ms ease).

---

## Task 5: Detail Panel Transition & Polish

### What It Does

Make the detail panel feel smooth and professional, with kind-specific affordances
for `open_question`, version history transitions, and correct action button behavior.

> **Changes from original spec:**
> 1. "Bring to sandbox" semantics updated → now called "拉入对话" with new behavior (inject node content into current conversation, not restore old conversation).
> 2. "Reference node" removed from original spec and replaced by "引用" with clearer semantics.
> 3. "View source" / "查看来源" button removed entirely.
> 4. Version history accordion animation added as new sub-task (Step 7).

### Steps

1. Panel opens with a slide-in animation from the right (200ms ease-out).
2. Panel closes with reverse slide-out animation.
3. When switching between two nodes (clicking one while another is open): crossfade the content rather than close-then-open.
4. The close button (X) is always visible at top-right, even when content is scrolled.

5. **"拉入对话" button behavior:**
   - Injects the node's structured content (title + content + because) as a contextual message into the current active conversation.
   - The model reads it; the user continues discussing from there.
   - This is the entry point for modifying any judgment.
   - Visual feedback: button briefly turns green + checkmark for 1s after successful injection, then returns to default state.
   - Chat input receives focus after injection.
   - When `kind = 'open_question'`: button label changes to "讨论这个问题".

6. **"引用" button behavior:**
   - Inserts a formatted quote block into the current chat input at cursor position:
     ```
     > [ID · kind] title
     > content
     ```
   - Does not send — cursor lands below the quote so user can write their own prompt.
   - Brief highlight on the chat input to draw attention to where the quote was inserted.

7. **Version history accordion animation (new):**
   - When the version history section (Section 5) is expanded/collapsed: smooth accordion animation (150–200ms ease), consistent with group collapse in the tree panel.
   - When a single version row is expanded inline: same smooth accordion, content fades in (100ms).
   - No layout jump when expanding — use `max-height` transition or equivalent.

8. **Open question polish** (kind-specific UI):
   - Top of the detail panel shows an amber banner: "This is an open question — no decision yet."
   - "拉入对话" label changes to "讨论这个问题".
   - "解决为决策" button is rendered as the primary action — visually weightier than other buttons.
   - When the form is submitted and the open_question becomes superseded, the panel smoothly transitions to show the newly created decision (no flash to the tree).

### Acceptance

- Panel transitions feel smooth, not janky. Switching between nodes doesn't cause layout jumps.
- "拉入对话" injects node content into the current conversation (not old message restore); provides 1s visual feedback; chat input receives focus.
- "引用" inserts formatted quote into chat input without sending; input is highlighted briefly.
- No "查看来源" / "View source" button exists.
- For `open_question`: amber banner appears; "讨论这个问题" replaces "拉入对话"; "解决为决策" is visually primary.
- After resolving open_question: panel transitions to new decision without close/reopen flash.
- Version history accordion and row expansion animate smoothly (150–200ms), no layout jump.

---

## Task 6: Candidate Inline Hint Animation

### What It Does

Polish the inline candidate hints from Phase 2.

### Steps

1. When a new hint appears after extraction completes:
   - Fade in over 0.5s.
   - Brief subtle glow/highlight for 1s, then settle to resting style.
2. Resting style: monospace, 80% opacity, small font.
3. Click to expand: smooth accordion animation showing candidate previews.
4. After batch confirm: transition hint text from `+N candidates` to `✓ N confirmed` with brief color change (default → green → settle to gray).
5. **Agent-sourced hints** (`source = 'mcp_agent'`):
   - Not tied to a specific assistant message — can arrive at any time from external tools.
   - Render as a separate notification at the top of the chat area, not anchored to an assistant message.
   - Format: `+N from {agent_name}` (e.g. `+2 from Claude Code`), from `source_metadata.agent`.
   - Same fade-in + glow animation. Same expand-to-preview behavior.
   - On confirm: transitions to `✓ N from {agent_name} confirmed`.

### Acceptance

- Hint appearance is noticeable but not distracting.
- Expand/collapse is smooth.
- Confirmation state transition is visible and satisfying.
- Hints from MCP-submitted candidates render as `+N from {agent}` and are not anchored to a chat message.

---

## Phase 3 Definition of Done

The product feels like a real tool, not a prototype:

1. Full project + topic navigation works.
2. Sandbox clear / back / forward works.
3. Streaming doesn't hijack the user's scroll position.
4. Tree panel views are polished: 7-kind priority ordering, no status toggle, no superseded nodes visible, no `supersedes` edges in tree.
5. Detail panel transitions are smooth; open_question nodes show amber banner and primary "解决为决策" affordance; "拉入对话" injects node content into current conversation; "引用" inserts quote into chat input.
6. Version history accordion animates smoothly (150–200ms).
7. Candidate hints animate appropriately, including distinct rendering for MCP-submitted candidates.

**The complete user story:**

Sean (solo founder) logs in → creates a project → creates topics → chats with AI to think through product/strategy → decisions are extracted → reviews and confirms → decisions appear in tree (active only; open questions and rejections clearly marked) → switches to Claude Code, which reads the project's truth via MCP and starts implementing → during implementation, Claude Code discovers a constraint and submits a candidate back to Zeno → Sean returns to Zeno, sees the new candidate marked "via Claude Code", confirms it → next conversation in either environment reflects the updated truth.

To modify a judgment: Sean clicks a tree node → "拉入对话" → discusses in sandbox → new candidate extracted with `supersedes` edge → confirms → old node disappears from tree, version history accessible in new node's detail panel.

**After Phase 3, the product is ready for Sean to demonstrate to potential users and investors.**

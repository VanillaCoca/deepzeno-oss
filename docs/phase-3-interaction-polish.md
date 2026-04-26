**Phase 3: Interaction Polish + Sidebar + Sandbox Navigation**

*Updated after design review · 2026-04-26*


> **Audience & Prerequisites**

> For Codex to execute. Sean provides frequent feedback — expect 2-3 revision cycles per sub-task.

> Prerequisite: Phase 2 complete. Full decision loop (chat → extract → confirm → tree → context injection) works end-to-end.

> UX Preservation Rule (from Phase 1, still applies): full-viewport layout, responsive behavior, and streaming UX quality must never degrade.



Phase 3 is about making the product feel right. The core loop works; interactions need refinement. Feedback like 'the animation is too slow' or 'the panel transition feels janky' is normal iteration, not bugs.

**Task 1: Project Sidebar — Full Implementation**

**What It Does**

Replace the Phase 1 placeholder sidebar with a functional project + topic navigation system.

**Steps**

**1. Modify components/project-sidebar.tsx**

Top section — Project selector:

- Dropdown showing the user's projects

- 'New Project' button below the dropdown

- Creating a project: modal with name input. On create, auto-provision a General topic.

Middle section — Topics list:

- Shows all non-archived topics for the selected project

- Each topic item shows: label, unread candidate count badge (if any pending candidates)

- Clicking a topic switches the sandbox and truth panel to that topic's context

- 'New Topic' button at bottom. On create: modal with label input, inserts with next position value.

- The General topic is always first and cannot be archived

- Drag-to-reorder topics (optional — skip if complex, use position field ordering)

Bottom section — Archived topics:

- Collapsible section labeled 'Archived'

- Shows topics with archived_at set

- Clicking an archived topic shows it read-only (chat history viewable, no new messages, tree viewable)

- No unarchive action in V1

**2. Implement topic archiving**

- Right-click or three-dot menu on a non-General topic → 'Archive'

- Sets archived_at = now() on the topic

- Topic moves to the Archived section

**3. When switching topics**

- Sandbox loads the most recent conversation segment for that topic

- Truth panel (tree + candidate pool) loads that topic's decisions and candidates

- If no conversation exists for the topic, create one automatically

**Acceptance**

- User can create projects and topics

- Switching topics updates both the chat and the truth panel

- General topic is always first and not archivable

- Archived topics appear in collapsed section

- Pending candidate count badge shows on topics with unreviewed candidates

**Task 2: Sandbox Navigation — Conversation Segments**

**What It Does**

Users can clear the sandbox (start fresh conversation) and navigate between previous conversation segments using back/forward.

**Steps**

**1. Toolbar buttons above chat input**

- Clear (eraser icon): closes current conversation (sets ended_at = now()), creates new empty conversation for same topic. Old messages disappear from view but preserved in DB.

- Back (left arrow): navigate to previous conversation segment. Chat input active — typing resumes that segment.

- Forward (right arrow): navigate to next conversation segment.

**2. Conversation segment state**

- Track currentConversationId in React state (or URL param)

- When viewing an older segment, forward button is active

- When at latest segment, forward is disabled

- Back is disabled when at oldest segment

- Switching to a topic always shows the most recent conversation segment

**Acceptance**

- Clear creates a new conversation and hides old messages

- Back/forward navigate between segments within the same topic

- Typing in an old segment appends to that segment (resumes it)

- Experience feels like a sessionless, continuous chat surface

**Task 3: Streaming Scroll Behavior**

**What It Does**

Fix the most common streaming UX issue: page auto-scrolling while the user is trying to read.

**Steps**

**1. Scroll-intent detection**

- If user is scrolled to bottom (within 100px threshold): auto-scroll as new tokens arrive

- If user has scrolled up to read: STOP auto-scrolling. Content continues to arrive but doesn't pull the viewport.

- When user scrolls back to bottom: resume auto-scroll

**2. 'Scroll to bottom' floating button**

- Appears when user is scrolled up and new content is arriving below

- Clicking returns to bottom and resumes auto-scroll

**3. Verification**

- Verify works with long streaming responses (1000+ tokens)

**Acceptance**

- During streaming, if user is at bottom: page scrolls smoothly with new content

- If user scrolls up during streaming: scrolling stops, content continues to arrive without pulling viewport

- 'Scroll to bottom' button appears and works correctly

- No jank or flicker during streaming

**Task 4: Tree Panel View Mode Polish**

**What It Does**

Refine the two tree view modes from Phase 2.


> **Changes from original spec (design review 2026-04-26)**

> 1. Status toggle removed — tree shows active nodes only; no 'Show all / Active only' toggle exists.

> 2. supersedes edges removed from by-relation rendering — version chains live in the detail panel's version history section, not in the tree.

> 3. 'replaces' renamed to 'resolved_by' throughout — this is the open_question → decision edge type. Ensure consistency with Phase 2 schema.



**Steps**

**1. By-type view improvements**

- Collapsible section headers for each kind, in priority order:

  - Open Questions

  - Goals

  - Constraints

  - Plans

  - Hypotheses

  - Principles

  - Rejections (default collapsed)

- Show count next to header: 'Goals (3)'

- Empty sections hidden entirely — no 'Hypotheses (0)' empty header

- Smooth expand/collapse animation (200-250ms ease)

**2. By-relation view improvements**

- Anchor decisions render as root nodes

- depends_on edges render as indented children

- resolved_by edges (open_question → decision) render with distinct visual indicator, e.g. '↳ resolved by' label

- Orphan decisions (no edges) appear in a separate 'Standalone' section at the bottom


> **Not in tree (removed from original spec)**

> supersedes edges (version chain) are NOT rendered in any tree view. They appear only in the detail panel's version history section (Section 5).

> No strikethrough on 'superseded nodes' because superseded nodes don't appear in the tree at all.



**3. Status toggle — removed**


> **Deleted from spec**

> The original spec included a 2-state toggle ('Active only' / 'Show all'). This is removed.

> The tree always shows active nodes only. There is no toggle, no 'Show all' mode, no dimmed superseded nodes.

> Version history is accessible via the detail panel. The tree is always a clean view of current truth.



**Acceptance**

- By-type view: groups in priority order, empty groups hidden, counts shown, Rejections collapsed by default

- By-relation view: depends_on as indented children; resolved_by edges with distinct visual treatment; orphans in Standalone section

- No supersedes edges visible anywhere in the tree

- No status toggle exists in the tree toolbar

- Both view modes render cleanly with real data (10+ decisions, 5+ edges)

- Sections collapse/expand smoothly with no layout jumps (200-250ms ease)

**Task 5: Detail Panel Transition & Polish**

**What It Does**

Make the detail panel feel smooth and professional, with kind-specific affordances for open_question and version history transitions.


> **Changes from original spec (design review 2026-04-26)**

> 1. 'Bring to sandbox' button semantics updated — see Step 5 below.

> 2. 'Reference node' button removed — merged into '拉入对话'.

> 3. Version history accordion animation added as new sub-task (Step 7).



**Steps**

**1. Panel open/close animation**

- Opens with slide-in from right (200ms ease-out)

- Closes with reverse slide-out animation

**2. Node switching**

- When switching between two nodes (clicking one while another is open): crossfade content rather than close-then-open

**3. Close button**

- Always visible at top-right, even when content is scrolled

**4. Open question polish (kind-specific UI)**

- Top of panel: amber banner — 'This is an open question — no decision yet.'

- '拉入对话' label changes to '讨论这个问题' when node is open_question

- '解决为决策' button is visually primary (heavier weight than other buttons)

- After resolving: panel smoothly transitions to newly created decision (no flash to tree)

**5. '拉入对话' button feedback (updated semantics)**


> **Updated from original 'Bring to sandbox'**

> Original spec: 'Bring to sandbox' fetched relevant_message_ids and restored old conversation context.

> Updated: '拉入对话' injects the node's structured content (title + content + because) as a contextual message into the CURRENT active conversation. This is the entry point for modifying any judgment.

> Visual feedback: button briefly shows checkmark + green for 1s after successful injection, then returns to default state.

> The chat area receives focus after injection so the user can immediately type a response.



**6. '查看来源' button feedback**

- Loads the conversation segment identified by created_from_message_id

- If segment is in a past conversation: loads it as a read-only view (no new messages)

- No brief highlight needed — navigation is feedback enough

**7. Version history accordion animation (new)**

- When the version history section (Section 5 from Phase 2 Task 4) is expanded/collapsed: smooth accordion (150-200ms ease), consistent with group collapse animation in the tree panel

- When a single version row is expanded inline: same smooth accordion, content fades in (100ms)

- No layout jump when expanding — reserve height or use transition on max-height

**Acceptance**

- Panel open/close and node-switch transitions feel smooth, not janky

- Switching between nodes doesn't cause layout jumps

- For open_question: amber banner appears; '讨论这个问题' replaces '拉入对话'; '解决为决策' is visually primary

- After resolving open_question: panel transitions to new decision without close/reopen flash

- '拉入对话' injects node content into current conversation (not old message restore); provides 1s visual feedback

- Version history accordion and row expansion animate smoothly at 150-200ms, no layout jump

- No 'Reference node' button exists — removed

**Task 6: Candidate Inline Hint Animation**

**What It Does**

Polish the inline candidate hints from Phase 2.

**Steps**

**1. New hint appearance**

- Fade in over 0.5s

- Brief subtle glow/highlight for 1s, then settle to resting style

**2. Resting style**

- Monospace, 80% opacity, small font

**3. Click to expand**

- Smooth accordion animation showing candidate previews

**4. After batch confirm**

- Transition hint text from '+N candidates' to '✓ N confirmed'

- Brief color change: default → green → settle to gray

**5. Agent-sourced hints (source = 'mcp_agent')**

- Not tied to a specific assistant message — can arrive any time from external tools

- Render as separate notification at top of chat area (not anchored to an assistant message)

- Hint text: '+N from {agent_name}' (e.g. '+2 from Claude Code'), pulled from source_metadata.agent

- Same fade-in + glow animation; same expand-to-preview behavior

- On confirm: transitions to '✓ N from {agent_name} confirmed'

**Acceptance**

- Hint appearance is noticeable but not distracting

- Expand/collapse is smooth

- Confirmation state transition is visible and satisfying

- Hints from MCP-submitted candidates render distinctly ('+N from Claude Code') and are not anchored to a chat message

**Phase 3 Definition of Done**

The product feels like a real tool, not a prototype:

- Full project + topic navigation works

- Sandbox clear / back / forward works

- Streaming doesn't hijack the user's scroll position

- Tree panel views are polished: 7-kind priority ordering, no status toggle, no superseded nodes, no supersedes edges in tree

- Detail panel transitions are smooth; open_question nodes show amber banner and primary '解决为决策' affordance; '拉入对话' injects node content into current conversation

- Version history accordion animates smoothly (150-200ms)

- Candidate hints animate appropriately, including distinct rendering for MCP-submitted candidates


> **Complete user story**

> Sean (solo founder) logs in → creates a project → creates topics → chats with AI to think through product/strategy → decisions extracted → reviews and confirms → decisions appear in tree (active only; open questions and rejections clearly marked) → switches to Claude Code, which reads the project's truth via MCP and starts implementing → during implementation, Claude Code discovers a constraint and submits a candidate back to Zeno → Sean returns to Zeno, sees the new candidate marked 'via Claude Code', confirms it → next conversation in either environment reflects the updated truth.

> To modify a judgment: Sean clicks a tree node → '拉入对话' → discusses in sandbox → new candidate extracted with supersedes edge → confirms → old node disappears from tree, version history accessible in new node's detail panel.



After Phase 3, the product is ready for Sean to demonstrate to potential users and investors.

*ZENO · Phase 3 Spec · Updated 2026-04-26*

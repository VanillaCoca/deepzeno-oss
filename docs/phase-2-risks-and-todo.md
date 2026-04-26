# Phase 2/3 Current Risks and TODO

This note summarizes the current follow-up items after the Phase 2 workspace bridge and Phase 3 interaction polish work.

## Current State

- Workspace state, topic/project navigation, truth panel, candidate confirm/dismiss, decision context injection, and conversation segment navigation are now wired into the existing chat runtime.
- The chat stack still keeps `Chat` / `Message_v2` as the rich-message store, while workspace `messages` are double-written for extraction and source linking.
- Core UX remains intact: full viewport chat, streaming, artifact/tool rendering, model selection, responsive shell, and Supabase auth.

## Known Risks

### 1. Remote Supabase schema may still lag behind repo migrations

- The connected Supabase project did not consistently expose the newest `candidate_decisions` columns during testing.
- The app now falls back to a legacy-safe insert path when `source`, `source_metadata`, or `external_evidence` are missing in the remote schema cache.
- Result: extraction keeps working, but those newer fields may not persist until the remote database is fully migrated.

### 2. Multi-store writes are server-side but not fully transactional

- User/assistant messages are written to both `Message_v2` and workspace `messages`.
- Candidate confirmation writes to `decisions`, `edges`, `candidate_decisions`, and `decision_log`.
- These writes now go through server-only helpers, but they still do not run inside a single database transaction across all touched stores.
- Result: partial-write edge cases are still possible if a request fails mid-flight.

### 3. Extraction quality depends on provider availability

- The intended extraction path uses Claude Sonnet 4.6 structured output.
- If `ANTHROPIC_API_KEY` is unavailable, the implementation falls back to a lightweight heuristic extractor so the product still functions locally.
- Result: extraction reliability is lower in fallback mode than in the intended Claude-backed mode.

### 4. Realtime updates still need hardening

- The truth panel uses Supabase Realtime, but polling fallback is also enabled because realtime behavior was not fully reliable in the current environment.
- A selection-snapshot guard was added to prevent delayed realtime events from reverting topic selection.
- Result: the app behaves correctly in current smoke tests, but the update path is more defensive than final-form.

### 5. Build-time database verification is still partial

- `pnpm build` passes, but local build skipped DB migrations because `POSTGRES_URL` was not configured in this environment.
- Result: code-level validation is good, but fresh-database execution still needs a direct Postgres-backed validation pass.

## TODO

### Highest Priority

- Fully migrate the target Supabase project so `candidate_decisions` matches repo schema and the compatibility fallback can be removed.
- Move critical multi-table operations to explicit SQL transactions or RPCs:
  - candidate confirm
  - dismiss all candidates
  - project + General topic provisioning
  - clear conversation / create next segment
  - dual-write message persistence if we want stronger guarantees
- Run extraction with Claude Sonnet 4.6 in the intended environment and verify structured output quality against real topic transcripts.

### Product Hardening

- Revisit truth-panel refresh strategy after remote schema/realtime are stable; reduce reliance on polling if possible.
- Add explicit operator visibility for extraction failures or skipped extractions instead of only logging them.
- Consider idempotency guards for confirm/dismiss flows if users double-click or reconnect during mutations.
- Review whether topic switching should cancel or debounce any in-flight workspace refreshes more aggressively.

### Test Coverage

- Add automated coverage for archived-topic readonly behavior.
- Add coverage for `dismiss all candidates`.
- Add coverage for `Reference node` draft insertion.
- Add coverage for `Bring to sandbox` context restoration and source-message scrolling.
- Add coverage for fallback extraction behavior when Anthropic is unavailable.

## Recommended Next Step

If we want the safest Phase 2/3 follow-up, the best next slice is:

1. Align the real Supabase schema with repo migrations.
2. Convert confirm/dismiss/clear/provision into transactional SQL or RPC paths.
3. Re-test realtime after removing the schema mismatch variable.

# Frontend / Backend Subagent Handoff Template

Use this template when a task is large enough to benefit from parallel work, but still has a stable boundary between frontend and backend responsibilities.

Do not use this split by default. First decide whether the work is actually separated by interface boundaries, or whether it is better split by feature module.

## When To Use This Split

Use a frontend/backend split when most of these are true:

- The frontend can move forward against an existing or frozen contract.
- The backend can change implementation details without requiring UI restructuring.
- The write sets are mostly disjoint.
- The coordinator can own final integration and verification.

Do not use a frontend/backend split when most of these are true:

- The feature is concentrated in one file or one narrow module.
- The API contract is still fluid.
- Both sides need to co-design the same state shape in real time.
- The same person would spend more time coordinating than implementing.

## Pre-Dispatch Checklist

Before spawning subagents, the coordinator should confirm:

- The desired outcome is written down in one paragraph.
- The ownership boundary is explicit.
- Shared contracts are frozen for this pass.
- Each worker has a disjoint write scope.
- The coordinator owns integration, verification, and any cross-cutting fixes.

## Ownership Model

### Frontend Worker

The frontend worker owns:

- `src/**`
- Frontend tests under `src/**`
- Frontend styles directly tied to the task

The frontend worker should:

- Treat API shapes as fixed unless the coordinator explicitly says otherwise.
- Prefer UI-state and interaction tests before behavior changes.
- Avoid refactoring unrelated visual or state-management code.

The frontend worker must not:

- Edit backend routes, backend payload builders, or API docs.
- Redefine response contracts on its own.
- Revert concurrent backend changes.

### Backend Worker

The backend worker owns:

- `server/**`
- `api/**`
- API contract docs under `docs/**` when explicitly assigned
- Backend tests covering routes, payload builders, and handlers

The backend worker should:

- Keep the contract stable unless a contract update is the task.
- Update docs when the served contract changes.
- Add or adjust route tests before changing route behavior.

The backend worker must not:

- Edit frontend views or interaction tests.
- Change frontend expectations indirectly without flagging it.
- Revert concurrent frontend changes.

### Coordinator

The coordinator owns:

- Task framing
- Contract freezing
- Integration decisions
- Conflict resolution
- Final verification

The coordinator should:

- Write narrow prompts with explicit file ownership.
- Keep workers out of each other's files when possible.
- Run the final test and build commands locally after worker output is in.

## Recommended Prompt Template

Copy and adapt the following.

### Frontend Worker Prompt

```md
You are the frontend worker for <workspace>.
You are not alone in the codebase. Another worker may be editing backend files at the same time.
Do not revert anyone else's changes, and adjust to concurrent changes if needed.

Ownership: ONLY edit <frontend file list>.

Goal: <frontend goal>.

Context:
- Backend/API contract for this pass is frozen as: <contract summary>
- Main frontend risk areas: <risk list>

Your task:
1. Inspect the owned frontend files.
2. Use TDD for any behavioral change.
3. Implement the minimum change needed.
4. Run the relevant frontend tests you changed.

Constraints:
- Do not edit backend files or docs.
- Keep changes focused.
- Do not commit.

Return format:
- Status: DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED
- Summary of changes
- Tests run and results
- Files changed
```

### Backend Worker Prompt

```md
You are the backend worker for <workspace>.
You are not alone in the codebase. Another worker may be editing frontend files at the same time.
Do not revert anyone else's changes, and adjust to concurrent changes if needed.

Ownership: ONLY edit <backend file list>.

Goal: <backend goal>.

Context:
- Contract/source of truth for this pass: <contract summary>
- Main backend risk areas: <risk list>

Your task:
1. Inspect the owned backend files.
2. Use TDD for any route or payload behavior change.
3. Implement the minimum change needed.
4. Run the relevant backend tests you changed.

Constraints:
- Do not edit frontend files.
- Keep the contract stable unless contract changes are explicitly requested.
- Do not commit.

Return format:
- Status: DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED
- Summary of changes
- Tests run and results
- Files changed
```

## Integration Rules

After workers return, the coordinator should review in this order:

1. Did each worker stay inside its ownership boundary?
2. Did either worker silently change the shared contract?
3. Do the changed tests actually cover the intended behavior?
4. Is there any overlap or hidden coupling left to resolve?

If there is a contract mismatch:

- Prefer fixing it in one place only.
- Decide whether the source of truth is code or docs for this pass.
- Re-run verification after the mismatch is resolved.

## Final Verification Checklist

Run the smallest relevant checks first, then the full project checks.

Suggested sequence:

1. Focused frontend tests
2. Focused backend tests
3. Full test suite
4. Production build
5. Any manual smoke check that matters for the user-facing flow

Record:

- Exact commands run
- Pass/fail result
- Any residual risk not covered by automation

## Example For This Project

This repository worked well with the following split:

- Frontend worker ownership:
  - `src/App.tsx`
  - `src/App.test.tsx`
  - `src/styles/tokens.scss`
  - `src/features/guidance/**`

- Backend worker ownership:
  - `server/app.js`
  - `server/gameApi.js`
  - `server/app.test.js`
  - `api/**`
  - `docs/game-line-apis.md`

- Coordinator ownership:
  - Freeze the game-line contract
  - Review worker outputs
  - Run `npm test`
  - Run `npm run build`

## Practical Notes

- If a worker stalls, narrow the task further instead of repeating the same prompt.
- If only one explicit failure remains, stop parallelizing and let the coordinator finish it directly.
- If a worker asks whether to change behavior or only docs, default to the conservative scope unless the user asked for behavior change.

---
name: commit-audit
description: "Perform reviewer-owned Track 1 working-tree verification or audit a committed work-unit commit or explicit range from Git evidence, tracing requirements, architecture, state ownership, lifecycle paths, regressions, test-oracle drift, commit scope, recurrence prevention, and verified closeout commits. Use for $commit-audit, code reviews, root-cause review, delta rework verification, or reviewer commit closeout."
---

# Commit Audit

Use this skill as the reviewer for a working tree or committed work unit. An
implementer's test run or completion report is evidence for review, not by itself
a reason to commit. Do not edit, stage, commit, reset, restore, checkout, stash,
rebase, merge, or export files during the first verification pass. After that
pass, directly commit only an unchanged, verified implementation scope when no
actionable finding remains and the user has authorized reviewer closeout commits.

## Authority and scope

Audit is workflow-based: establish a Git target, trace requirements through the
runtime, test abnormal paths, and finish with a contradiction pass.

- Select one of two reviewer modes before making claims:
  - **Reviewer working-tree verification**: use the named baseline and current working-tree diff as direct evidence. Keep the first pass read-only; then judge whether to request rework or directly create one or more verified focused commits.
  - **Committed commit/range audit**: use the named commit or range and its Git objects as direct evidence. The current dirty working tree is context only, never evidence for the audited commit; use `git show <commit>:<path>` when current files differ.
- Record the target mode, baseline, parent or reviewed `HEAD`, and dirty-worktree status before making claims.
- Follow this project's authority order: latest user decision, `docs/DECISIONS.md`, `docs/GAME_DESIGN_TRACK1.md`, `docs/ROADMAP.md`, `docs/EXECUTION_PLAN.md`, then playtest/review/collaboration logs and history.
- The current M2A dirty gameplay worktree is not an audit target unless the request names a commit containing it. Keep the temporary camera unresolved; do not infer a final camera direction.
- The first pass is read-only. Do not edit, stage, commit, reset, restore, checkout, stash, rebase, merge, or export during that pass.

## Audit workflow

1. Establish the reviewer mode, target commit or range or working-tree baseline, its parent or reviewed `HEAD`, and dirty-worktree status.
2. Read governing requirements and relevant architecture before implementation details.
3. In reviewer working-tree verification mode, inspect the complete working-tree diff, changed-file snapshots, and nearby baseline code. In committed mode, inspect commit metadata, complete diff, changed-file snapshots, and nearby baseline code from Git objects.
4. Trace requirements through state ownership, input handling, data transitions, and Three.js/UI presentation.
5. Walk the normal path end to end, then inspect repeated input, duplicate input, cancellation, interruption, re-entry, refresh, tab switching, invalid input, and error paths.
6. Check sibling flows and regressions, including movement, material transport, production-block transport, reservation, absorption, processing, output observation, submission, and camera framing.
7. Check whether implementation and tests share the same mistake or incomplete oracle. A passing test proves only what it independently asserts.
8. For every important claim, write a falsification path: the smallest test, trace, browser action, or Git comparison that could prove the claim wrong.
9. Run a contradiction pass against governing documents, changed code, tests, and logs before issuing the conclusion.
10. If delta rework is requested, re-check the new working tree or commit in the same audit context rather than creating an unbounded review scope. Any working-tree change after verification invalidates the closeout decision and requires re-verification before a commit or exception request.

## Track 1 invariants

- Pure game state is authoritative and testable without Three.js; `src/main.ts` owns rendering and UI projection rather than hidden gameplay rules.
- One input event causes at most one intended state transition. Material transport and production-block transport cannot be active at the same time.
- A player carries at most one material or one production block, and a token cannot be reserved, absorbed, processed, or submitted twice.
- Only compatible tokens enter a production block or submission target; each production buffer remains at or below 10.
- Observation delay cannot be bypassed by the same simulation step, and large `deltaSeconds` values produce the same result as deterministic smaller splits.
- The initial state cannot auto-clear without the required player placement and interaction path.
- Automated tests, browser checks, human playtest evidence, and public deployment evidence are separate claims.
- Documentation status matches the audited commit. Temporary camera behavior is not described as a final view decision.

## Severity and recurrence prevention

- **Blocker**: the requested flow cannot complete, data can be lost or duplicated, a governing invariant is violated, or the build/demo path is unusable.
- **Major**: a required path is materially unreliable or a regression is likely, but a narrow workaround exists.
- **Minor**: a localized correctness, clarity, or maintainability issue that does not block the required path.

Every actionable finding, including a Minor finding when recurrence is plausible, must be considered for an appropriately sized recurrence-prevention layer. Every Blocker or Major finding must include an actionable delta request and at least one layer: a state guard, focused regression test, independent oracle, documentation gate, verification checklist, or staged-diff scope check. Do not inflate severity without evidence.

## Commit judgment and closeout gate

- If actionable modifications remain in the verified scope, do not commit it. Issue a delta request and re-verify the result.
- If no actionable modification remains, the working tree has not changed since verification, and the change has independent history value, stage only the exact verified files or hunks, inspect the staged diff, run the required pre-commit checks, and create the focused commit directly.
- In the same PASS response, choose exactly one closeout: **commit now**, **no commit needed**, or **coordinator decision needed**. Do not leave a PASS without a closeout choice.
- Treat mixed dirty as context, not an automatic blocker. If verified files or hunks can be separated directly, commit them. If they cannot, inspect the exact overlap once and ask the coordinator to choose a verified coherent superset, one small boundary correction, or no commit for this unit.
- Do not build repeated alternate indexes, temporary worktrees, or synthetic candidates merely to prove a split. Use at most one such check when a concrete dependency risk requires it. If it fails, report the exact dependency and escalate the closeout decision instead of expanding the audit harness.
- When the coordinator orders a commit for an unchanged PASS scope, execute that exact closeout after staged-diff and standard verification. Do not re-open the commit-worthiness decision unless new code or a new actionable finding appears.
- If the change is only a review log or status record, or has no independent commit value, do not commit it.
- Use a copy-ready `커밋 요청문` only when the reviewer cannot execute Git in the current environment or the user explicitly assigns a separate commit executor. Include the verified baseline, `HEAD`, working-tree state, purpose, exact included and excluded files or hunks, split order, message, checks, completion conditions, and report fields.
- An already committed range receives no new commit. A reviewer may judge a future delta only after its working tree or new commit is verified.
- A closeout commit or commit request is not push approval; push requires separate user approval.

## Verification
Run only checks relevant to the audited change, then the repository's focused checks and `npm.cmd run check` / `npm.cmd run build` when the change can affect them. For closeout, prefer the real working tree plus staged diff; do not require a synthetic committed-checkout oracle unless the audited change specifically modifies packaging or deployment boundaries.

Use `git diff --check` for the reviewed commit where applicable. Browser functional checks, human playtests, and public deployment checks must be named separately and never inferred from automated results.

Do not add OpenAI API, prompt, tool-schema, cost, or rate-limit findings unless the audited commit actually introduces those systems. A successful modification is not a successful audit; after a delta commit, repeat the affected audit paths in the same context.

## Output format
Use concise, evidence-based prose with these headings:

### Audit scope

Target commit/range, parent, reviewed `HEAD`, dirty-worktree treatment, and evidence sources.

### Overall judgment

Pass, conditional pass, or fail, with the reason and unverified gates.

### Findings

For each finding: severity, file/line or Git evidence, violated requirement/invariant, impact, reproduction/falsification path, root cause, and recurrence-prevention layer.

### Areas checked without findings

List inspected paths that passed, without implying broader human or deployment validation.

### Verification gaps and residual risks

Separate automated, browser, human-playtest, deployment, and documentation gaps.

### 수정 요청문

When findings exist, write a copy-ready request containing objective, scope, required changes, constraints, verification commands, and completion conditions. If there are no actionable findings, write `수정 요청 없음`. Keep the request separate from any actual implementation.

### 커밋 판단

State exactly one of `지금 커밋`, `커밋 불필요`, or `총괄 결정 필요`. Include whether one or multiple focused commits are required, the evidence, independent history value, and any exact mixed-file overlap. `총괄 결정 필요` must contain a short choice between coherent superset, one small boundary correction, or no commit; it must not start an unbounded candidate-building loop.

### 커밋 결과 또는 예외 요청문

When a reviewer closeout commit was created, report its hash, message, included scope, verification, and remaining dirty files. If the reviewer cannot commit or the user assigned a separate executor, issue a copy-ready exception request with the exact baseline, `HEAD`, dirty-worktree state, purpose, included and excluded files or hunks, split order, message, checks, completion conditions, report fields, and push prohibition. Otherwise write `커밋 없음`.

If there are no actionable findings, end with: `Implementation-context delta request: no change request - no issue found`.

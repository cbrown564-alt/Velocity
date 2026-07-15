# Audit 10 — Engine boot and CI truth incident

**Status:** Open — stabilization blocker  
**Date:** July 14, 2026  
**Severity:** Major release-control and first-run failure  
**Scope:** Fresh-session boot, intent-based engine warm-up, browser worker initialization, product E2E, Journey Gate, merge controls, and completion claims  
**Role:** Active incident record and remediation owner until the completion criteria in §15 pass  
**Precursor:** [`audit_09_opfs_persistence_rca_2026-07-05.md`](audit_09_opfs_persistence_rca_2026-07-05.md)

## 1. Executive finding

This is not one OPFS regression or one stale selector. It is a compound incident with defects in the product, browser-runtime boundary, test harness, CI controls, and project-status discipline.

Two product/runtime failures are confirmed:

1. **A fresh session has a circular first-run dependency.** `SplashScreen` renders the actionable `WorkspaceView` only after `isDbReady` becomes true. Plan 06 Phase 4 simultaneously changed fresh sessions to defer engine startup until an upload, example, drop, or similar user intent. The controls that express that intent are therefore hidden until the engine has already started. A normal fresh user and E2E tests that wait for the visible Upload button remain on “Initializing Analysis Engine...” without initiating startup.
2. **The journey harness bypasses that deadlock through the always-mounted hidden file input, but Linux CI still does not reach the dashboard.** Local Chromium can complete the same path. The CI failure is somewhere after the upload event starts the warm-up path and before a usable dashboard is produced. Current telemetry cannot identify whether it is the analysis worker, DuckDB bundle selection or instantiation, service-worker cache interaction, OPFS setup, or another transition in that chain.

These failures were allowed to persist because the evidence system is not enforcing its own contract:

- Every completed Journey Gate run since the workflow was introduced has failed: **28 failures, 7 cancellations, 0 successes across 35 runs** from July 5 through July 14.
- The required product E2E job failed on both PR 47 and PR 48. On PR 48, 13 of 21 tests failed, two were flaky, and only six passed after 17.4 minutes.
- Both PRs were merged while Journey Gate was failed and product E2E was still running; product E2E later failed on both.
- GitHub reports that `main` has **no branch protection** and the repository has **no rulesets**. The documented rule that all required jobs must pass is not a repository control.
- Plan 06 says phases 0–5 were executed and that “CI stays green throughout,” while its journey gate has never recorded a successful run.

The immediate decision should be to treat engine boot and CI truth as one stabilization incident. Pilot recruiting, further persistence promotion, and new engine-facing work should not rely on the current completion claims until the containment and verification gates in this report pass.

## 2. Impact

### 2.1 User impact

- A new user can receive an indefinite initialization screen before the UI exposes an upload or example action.
- The failure has no usable recovery action on the fresh-session path.
- CI demonstrates that the real upload-to-dashboard journey is not reliable in the environment used to gate the product.
- Returning-session, corruption-recovery, workspace-switch, export, and pilot-workflow tests cannot provide reliable evidence while their shared engine boot prerequisite is broken.

### 2.2 Engineering impact

- Thirteen product tests can fail from one shared boot defect, obscuring which downstream behaviors are healthy.
- A failed journey produces almost no causal evidence, so investigations repeat the same selector, timeout, and persistence hypotheses.
- Local success is being treated as broader verification even though the Linux CI runtime follows a different result.
- Documentation and tracker states can reach “Executed” or “Done” without a green promotion boundary.

### 2.3 Governance impact

- The repository permits merges with failed and pending checks.
- The legacy commit-status API can show overall `success` from Vercel while GitHub check runs include a failed Journey Gate and a pending or failed product E2E job.
- The documented six-job merge contract does not include Journey Gate, while Plan 06 describes Journey Gate as the journey budget gate. The canonical documents therefore disagree about what blocks a merge.

## 3. What happened

### July 5: the gate was introduced already red

- PR-run [28725482125](https://github.com/cbrown564-alt/Velocity/actions/runs/28725482125), titled “Plan 06 Phase 0: journey telemetry + CI journey gate,” failed because the dashboard did not become ready.
- Later Plan 06 commits on `main` repeated the same failure, including runs [28734939049](https://github.com/cbrown564-alt/Velocity/actions/runs/28734939049), [28735073448](https://github.com/cbrown564-alt/Velocity/actions/runs/28735073448), [28736001175](https://github.com/cbrown564-alt/Velocity/actions/runs/28736001175), and [28751469478](https://github.com/cbrown564-alt/Velocity/actions/runs/28751469478).
- Despite this, `plan_06_backend_reset.md` was marked “Executed — Phases 0–5 merged to `main`.”

### July 14: persistence repair exposed broader failures

- PR 48 repaired real OPFS ownership and reopen defects and fixed branch-local typecheck/format failures.
- The journey sentinel was updated to recognize the current dashboard and to print the URL, sentinel counts, and body text on timeout.
- Local Chromium completed the five-minute path twice after that diagnostic change.
- CI still failed. The new evidence showed the app remained at:

  > Initializing Analysis Engine... Booting worker runtime and preparing the analysis engine.

- PR 48’s product E2E run [29370739611](https://github.com/cbrown564-alt/Velocity/actions/runs/29370739611) later failed: 13 failed, 2 flaky, 6 passed.
- PR 47’s product E2E run [29370756809](https://github.com/cbrown564-alt/Velocity/actions/runs/29370756809) failed in the same way.
- PR 48 merged as `e42e06b` while Journey Gate was failed and E2E was pending.
- PR 47 then merged as `68a17a9` while Journey Gate was failed and E2E was pending.
- On the resulting `main`, Journey Gate run [29371060812](https://github.com/cbrown564-alt/Velocity/actions/runs/29371060812) failed with the same initialization screen.
- The resulting `main` product E2E run [29371060792](https://github.com/cbrown564-alt/Velocity/actions/runs/29371060792) also failed: 13 failed, 2 flaky, and 6 passed in 17.1 minutes.

## 4. Minimal reproductions

### 4.1 Fresh-session UI deadlock

Precondition: clear localStorage/OPFS or use a new browser context.

1. Open the application at `/`.
2. Observe `phase === 'splash'`, `isDbReady === false`, and no stored dataset.
3. `usePersistenceManager` does not call `warmUpEngineOnIntent('boot-resume')` because `shouldWarmEngineOnBoot()` is false.
4. `SplashScreen` does not render `WorkspaceView` because it requires `isDbReady && !initError`.
5. The Upload, example, drop, open-dataset, and session-import controls in `WorkspaceView` are therefore unavailable.
6. The application remains on the engine initialization bar even though no engine-init request has necessarily started.

**Expected:** the fresh workspace is interactive immediately; selecting an upload/example may start the engine in the background and show bounded progress.  
**Actual:** the UI presents an initialization state while withholding the actions that trigger initialization.

This explains the E2E failures that wait for a visible Upload button or first-run copy. Their error artifacts contain only the initialization bar because the test never reaches an action that starts the engine.

### 4.2 Hidden-input journey failure in Linux CI

Run:

```bash
node scripts/plan-06-journey-gate.mjs
```

The five-minute script uses `data-testid="dataset-upload-input"`, which is mounted outside `SplashScreen`, and calls `setInputFiles()` directly. This bypasses the unavailable visible controls and invokes `handleDatasetFileUpload()`, which awaits `warmUpEngineOnIntent('file-upload')` before processing the file.

**Expected:** engine ready, file ingested, dashboard sentinel visible, first crosstab rendered.  
**Actual in Linux CI:** no dashboard, Table view, or Metadata Loaded sentinel appears within the harness timeout.  
**Actual locally on July 14:** the same script completed twice in Chromium.

The failing layer is bounded to the upload/warm-up/boot chain, but the exact worker subphase is not yet known.

### 4.3 Merge-control failure

Repository API results on July 14:

```text
GET /repos/cbrown564-alt/Velocity/branches/main/protection -> 404 Branch not protected
GET /repos/cbrown564-alt/Velocity/rulesets -> []
```

Open a PR with Journey Gate failed and product E2E pending. GitHub permits an immediate merge. Both PR 47 and PR 48 demonstrated this behavior.

**Expected:** documented required gates are enforced by GitHub before merge.  
**Actual:** they are conventions that a human or agent may bypass inadvertently.

## 5. Failure boundary

The intended fresh upload sequence is:

```text
fresh splash
  -> user chooses upload/example/drop
  -> warmUpEngineOnIntent(source)
  -> service-worker registration and WASM prefetch started
  -> store.initWorker()
  -> initializeEngineWorker()
  -> create analysis Worker
  -> EngineProxy sends engine.init
  -> worker selects DuckDB bundle
  -> nested DuckDB worker created
  -> WASM instantiated
  -> OPFS support/lock/open/fallback resolved
  -> engine.ready returned
  -> file load starts
  -> dashboard becomes interactive
```

There are currently two breakpoints:

- **Before the sequence:** normal fresh-session UI does not expose the action needed to enter it.
- **Inside the sequence on Linux CI:** the hidden-input path enters the sequence but does not produce an interactive dashboard.

The runtime code emits no structured phase record for worker creation, bundle selection, nested-worker creation, WASM fetch/instantiate, lock acquisition, database open, or ready acknowledgement. Journey Gate therefore cannot narrow the second breakpoint further.

## 6. Confirmed root causes and enabling causes

### RC-1 — UI readiness and engine readiness were made mutually dependent

**Confirmed.** Plan 06’s intent warm-up requires fresh users to act before engine boot. `SplashScreen` requires engine readiness before it renders the controls used for those actions. The architecture treated “workspace shell ready” and “analysis engine ready” as one boolean even though Phase 4 deliberately separated their timing.

This is a product-state modeling flaw, not only a test problem. The UI needs at least distinct states for shell readiness, engine boot status, dataset load status, and persistence recovery.

### RC-2 — CI promotion is not enforced at the repository boundary

**Confirmed.** `main` has no branch protection and no rulesets. The project’s written policy cannot prevent a merge when a required check is failed, pending, skipped, or absent.

This is the direct cause of failed and unfinished evidence being merged. It also means future agents cannot safely infer that a merge command will queue until checks pass.

### RC-3 — The journey gate was promoted without ever establishing a green baseline

**Confirmed.** Of all 35 workflow runs since introduction, none succeeded. A gate with no known-good run cannot distinguish a regression from a broken baseline, and it cannot support “verified” or “CI stays green” claims.

Phase 0’s required order was inverted: the workflow was installed and later work was marked complete before the representative slice had been proven in its target environment.

### RC-4 — Boot observability stops at the exact boundary under investigation

**Confirmed.** The journey script records only selected coaching/tour/onboarding console messages. It does not preserve general browser console output, page errors, worker errors, service-worker events, network failures, or structured boot phases. The wrapper starts Vite with piped stdout/stderr but does not consume or print those streams.

The workflow uploads only `plan-06-journey-gate.json`; the wrapper writes that report after the five-minute script returns. When the script throws first, no report exists and artifact upload warns that no file was found. Failure is therefore the least observable outcome.

### RC-5 — Shared-precondition failures are reported as many feature failures

**Confirmed.** Product E2E mixes tests that wait for visible first-run controls with tests that directly manipulate the hidden file input. Most failure artifacts show the same initialization bar, but the suite reports failures under OPFS, chaos recovery, workspace switching, export, pilot workflow, session reload, and crosstab virtualization.

The suite lacks a small, explicit boot contract that must pass before dependent journeys run. The resulting failure fan-out creates noise and invites fixes in downstream features that never executed.

### RC-6 — Completion language was detached from promotion evidence

**Confirmed.** The tracker defines `Done` as merged with required evidence, and the testing architecture says all six test jobs must pass. Plan 06 says its phases are executed and that CI remains green. The recorded workflow history contradicts those claims.

The underlying flaw is that status updates rely on implementation intent and selected local checks rather than a durable link to the exact commit and exact required run set used for promotion.

## 7. Unresolved technical cause in Linux CI

The exact cause of the hidden-input boot failure is **not proven**. It must not be described as another OPFS handle leak without new evidence.

Current hypotheses, ordered by the point at which new evidence can distinguish them rather than by confidence, are:

1. Analysis worker starts but the `engine.init` handler does not run or return.
2. DuckDB bundle selection differs under cross-origin isolation or headless Linux.
3. The nested DuckDB worker is created but WASM fetch or instantiation does not complete.
4. Service-worker registration/prefetch races with the worker’s module fetch or leaves a request unresolved.
5. OPFS support detection, Web Lock acquisition, database open, reset, or `dropFiles()` does not complete in this environment.
6. The two-minute `EngineProxy` timeout is reached but the resulting state is overwritten, swallowed, or not captured by the harness before its own timeout.
7. Dev-server behavior differs from the built application; discarded Vite stdout/stderr may contain the only error.
8. A concurrency interaction between multiple Playwright workers, browser contexts, service workers, or OPFS origins affects the full E2E suite. This cannot explain the single-journey job by itself but may amplify it.

The following are specifically **not established**:

- that PR 48 introduced the Journey Gate failure;
- that increasing the readiness timeout would fix it;
- that the dashboard selector is still wrong;
- that OPFS ownership is the remaining failure;
- that local success validates Linux CI or a pilot machine;
- that all 13 named E2E features are independently broken.

## 8. Why the previous fixes were insufficient

### 8.1 OPFS ownership and graceful shutdown fixed real defects, but not first-run state

Audit 09 correctly identified single-owner access, graceful shutdown, bundle compatibility, and returning-session coverage. Those changes concern database ownership and reopen behavior. They do not resolve a fresh UI that withholds its own start action, nor do they identify a Linux-only boot phase.

### 8.2 Unit tests verify mocked transitions, not the browser runtime chain

The engine lifecycle tests verify deduplication, store patches, failure handling, and serialization using controlled promises. They do not instantiate the actual analysis worker, nested DuckDB worker, WASM binary, service worker, OPFS implementation, and Web Locks in the target runner.

### 8.3 The diagnostic sentinel fix removed one false theory

Accepting `dashboard-workspace` and printing body text was useful: it proved the current CI symptom is earlier than dashboard rendering. It was an observability improvement, not the runtime fix itself.

### 8.4 The full E2E artifacts existed, but were not reviewed before merge

Product E2E uploads traces and error contexts on failure. Both PR jobs were still running when merge occurred, so their evidence could not have informed the merge decision. The completed artifacts later exposed the fresh-session circular dependency.

### 8.5 Timeouts are not recovery

`EngineProxy` has a two-minute per-request timeout. That prevents one promise from remaining pending forever, but it does not make boot fast, cancel nested work, terminate a failed worker, select a safe fallback, expose a retry, or emit the phase that timed out.

## 9. Fundamental design flaws exposed

### 9.1 One boolean owns too many meanings

`isDbReady` controls whether the workspace UI exists, although engine readiness, UI readiness, persistence readiness, and dataset readiness are different facts. This made a performance optimization capable of removing the application’s entry point.

### 9.2 The lifecycle is promise-based rather than an observable state machine

The code serializes lifecycle calls, but callers see a long promise and a final success/error. There is no durable state record, deadline per transition, cancellation signal, or recovery decision that spans the main thread, analysis worker, nested DuckDB worker, and persistence layer.

### 9.3 “Single owner” is local, not end-to-end

The OPFS database now has a clearer runtime owner, but boot ownership is distributed among `App`, `usePersistenceManager`, `engineWarmUp`, Zustand actions, `workspaceBoot/engineLifecycle`, `EngineProxy`, worker handlers, DuckDB initialization, service-worker cache code, and persistence helpers. No component owns the whole outcome: interactive shell with either a ready engine or a visible recovery path.

### 9.4 Tests are correlated but interpreted as independent evidence

Journey Gate, OPFS E2E, persistence chaos, pilot workflow, export, and workspace switching all depend on the same boot path and often the same helper. A large count of tests does not add confidence when they share one unproven prerequisite.

### 9.5 The control plane can report a false green

GitHub’s legacy combined status for `68a17a9` was `success` because the only legacy status was Vercel. Check runs separately showed Journey Gate failed and product E2E still running. Any automation that reads only combined commit status can make the wrong decision.

### 9.6 Documentation records declarations, not evidence-bound state

The repository has strong definitions for Implemented, Verified, Validated, and Done, but no mechanism requires a status row to link the commit and successful run that justify the transition. The current contradiction is therefore easy to create and expensive to detect.

## 10. Remediation program

### Phase 0 — Contain the incident

1. Mark engine boot, product E2E, and Journey Gate as open stabilization blockers.
2. Do not promote pilot readiness, persistence reliability, or Plan 06 completion from the current evidence.
3. Protect `main` or add a repository ruleset that requires the canonical checks, requires the branch to be up to date, and disallows bypass for routine merges.
4. Decide one canonical required-check list. Include Journey Gate if it is a release gate; otherwise stop calling it one.
5. Require completed checks before invoking merge; do not rely on merge commands to wait automatically.
6. Add a red-main owner and stop-the-line rule: a failing required main-branch run creates an incident item before feature work continues.

**Exit:** a PR with one required failure cannot merge, and the canonical docs name exactly the enforced checks.

### Phase 1 — Restore a truthful first-run contract

1. Render the workspace shell and fresh-session actions independently of DuckDB readiness.
2. Model at least these states separately: shell ready, engine idle/starting/ready/error, persistence checking/ready/error, dataset idle/loading/ready/error.
3. Let upload/example intent start the engine while keeping progress and cancel/retry visible.
4. Add a direct browser test that opens a clean context and asserts visible, usable first-run controls before engine startup.
5. Add a test that clicks the real visible upload control; the hidden input may remain an implementation detail but must not be the only viable route.

**Exit:** a fresh user can begin the journey without pre-seeded storage or test-only DOM access.

### Phase 2 — Instrument boot before changing it again

Emit a structured boot trace with one correlation ID across the main thread and workers. Minimum events:

- shell rendered;
- warm-up requested and source;
- dynamic store import started/completed;
- analysis worker created/online/error;
- `engine.init` sent/received;
- DuckDB bundle selected with isolation capabilities;
- nested worker created/error;
- WASM fetch started/completed/failed;
- DuckDB instantiate started/completed/failed;
- OPFS support result;
- lock request/acquired/timeout/released;
- database open/reset/drop-files/fallback outcome;
- `engine.ready` sent/received;
- first file-load phase;
- terminal success, error, timeout, cancellation, or fallback.

The trace must be bounded in size, exclude survey data, and survive failure.

Update Journey Gate to always preserve:

- browser console and page errors;
- worker and service-worker errors where the browser exposes them;
- failed network requests;
- Vite stdout/stderr;
- screenshot and DOM snapshot;
- Playwright trace;
- structured boot trace;
- timing report written in `finally`.

**Exit:** the next CI failure identifies the last completed boot phase and the first failed or timed-out phase.

### Phase 3 — Run controlled experiments

Use the trace to run a small matrix, changing one variable at a time:

| Variable | Conditions |
| :--- | :--- |
| Runtime | Linux CI Chromium; local Chromium; pilot-supported browser/machine |
| App server | Vite dev; production build + preview |
| DuckDB bundle | `eh`; `coi` only where supported |
| Persistence | OPFS enabled; forced memory |
| Service worker | enabled; disabled/unregistered |
| Storage | fresh; returning; corrupt cache; valid source/no DB |
| Concurrency | one context; two contexts/tabs; two Playwright workers |
| Start action | visible upload click; example click; file drop; direct hidden input only as control |

Run repetitions, not one-offs. A useful initial standard is 20 consecutive starts per cell for diagnosis and 50 for the final candidate. Record phase durations and failure phase, not only pass rate.

**Exit:** one minimal condition reliably turns failure on/off, or the trace identifies a deterministic failure site.

### Phase 4 — Fix the runtime architecture at the identified boundary

Regardless of the specific environmental trigger, the lifecycle needs these properties:

1. One explicit boot coordinator owns the end-to-end state and recovery decision.
2. Every phase has a deadline and emits its terminal result.
3. Startup is idempotent but does not mistake “proxy object assigned” for “engine ready.”
4. Cancellation terminates abandoned workers and releases locks/resources.
5. OPFS failure can fall back to memory or rebuild when safe, and that fallback is visible in telemetry and UI.
6. A fallback must not silently green CI if the required persistence behavior is under test.
7. User recovery offers retry, safe memory mode, or start fresh according to the failure class.
8. Production and dev-server boot use the same bundle-selection contract.

Do not implement a broad persistence rewrite until Phase 2 evidence locates the failure. The goal is a small causal fix plus the lifecycle changes justified by this incident.

### Phase 5 — Rebuild the verification ladder

Order tests by dependency:

1. clean-context shell and visible first-run action;
2. worker/DuckDB cold boot contract;
3. upload to dataset-ready contract;
4. one representative crosstab journey;
5. returning-session reopen;
6. corruption, lock, quota, and killed-worker recovery;
7. export and full pilot journey;
8. downstream UI and feature E2E.

Fail fast or skip dependents with an explicit “boot prerequisite failed” classification. Do not report 13 feature regressions when the shared boot contract failed.

Run the critical journey against a production build as well as any Vite-based diagnostic path.

**Exit:** failures are localized, artifacts are available, and local/CI commands match the documented gates.

### Phase 6 — Correct project state and promote cautiously

After the fixes are merged and enforced:

1. Correct Plan 06, Audit 09, completed-foundations language, tracker rows, testing architecture, and pre-PR playbook against the exact evidence.
2. Link every reopened/closed tracker item to its commit and successful run.
3. Require at least 10 consecutive green main-branch Journey Gate and product E2E runs across normal change/cancel behavior.
4. Verify on the original affected/pilot machine and a supported browser profile.
5. Run the returning-session and chaos suite against the final candidate.
6. Only then restore `Verified`, `Done`, or pilot-readiness claims.

## 11. Proposed tracker work

| ID | Outcome | Depends on | Evidence required |
| :--- | :--- | :--- | :--- |
| STAB-BOOT-1 | Fresh workspace is interactive before engine readiness | None | Clean-context visible-control E2E using real clicks |
| STAB-BOOT-2 | Cross-thread boot trace and failure artifacts | STAB-BOOT-1 | Failed experiment identifies exact phase; artifacts uploaded in `finally` |
| STAB-BOOT-3 | Linux CI root cause isolated | STAB-BOOT-2 | Repeated controlled experiment with one causal variable |
| STAB-BOOT-4 | Bounded, cancellable boot with visible recovery | STAB-BOOT-3 | Unit protocol tests plus real-browser failure/recovery tests |
| STAB-BOOT-5 | Boot-first verification ladder and soak | STAB-BOOT-4 | Product E2E and Journey Gate green for 10 consecutive `main` runs |
| STAB-CI-25 | Enforced merge rules match canonical docs | None | Deliberately failing required check blocks test PR merge |
| STAB-CI-26 | Evidence-bound status transitions | STAB-CI-25 | Tracker/doc update links exact commit and successful required runs |

## 12. Actions that would conceal rather than fix the incident

Do not:

- increase the three-minute journey timeout without identifying the timed-out phase;
- disable Journey Gate to make `main` look green;
- remove product E2E from required checks;
- make the hidden input the official fresh-session path;
- silently force memory mode in CI while claiming OPFS recovery is verified;
- describe one local pass as validation;
- perform another broad OPFS rewrite before capturing a boot trace;
- mark Plan 06 or persistence complete because code and unit tests exist;
- merge while required jobs are pending on the assumption that they will pass.

## 13. Open questions

1. Does the journey’s analysis worker receive `engine.init` on the failing runner?
2. Which DuckDB bundle is selected, and does the nested worker reach `instantiate()` completion?
3. Does disabling the service worker or WASM prefetch remove the Linux-only failure?
4. Does forced-memory boot pass while OPFS boot fails?
5. Why is the two-minute `EngineProxy` timeout not visible in the final journey DOM or logs?
6. Does the production build reproduce the Vite-dev-server failure?
7. Which checks should be mandatory for every PR versus promotion-only, and what exact GitHub check names are stable enough for a ruleset?
8. How many historical “Done” rows rely on merge state rather than successful required evidence?

## 14. Evidence inventory

### Source evidence

- `src/app/screens/SplashScreen.tsx` — gates `WorkspaceView` on `isDbReady`.
- `src/hooks/usePersistenceManager.ts` — starts engine on boot only for returning sessions.
- `src/services/engineWarmUp.ts` — intent starts service-worker work and `store.initWorker()`.
- `src/app/hooks/useSessionLifecycle.ts` — file upload awaits engine warm-up.
- `src/services/workspaceBoot/engineLifecycle.ts` — serialized lifecycle and final success/error handling.
- `src/services/EngineProxy.ts` — request routing and two-minute timeout.
- `src/services/worker/duckdbInit.ts` — bundle, WASM, OPFS, lock, and database-open chain.
- `scripts/design-reset-five-minute-pass.mjs` — hidden-input journey and limited diagnostics.
- `scripts/plan-06-journey-gate.mjs` — dev-server orchestration and success-path report generation.
- `.github/workflows/journey-gate.yml` — current artifact behavior.
- `docs/arch_08_testing.md` and `docs/playbooks/pre_pr_verification.md` — written all-gates-pass contract.
- `docs/plan_06_backend_reset.md` — executed/green claims and journey budgets.

### Run evidence

- Journey workflow history query, July 14: 35 total, 28 failed, 7 cancelled, 0 successful.
- [First Journey Gate PR run](https://github.com/cbrown564-alt/Velocity/actions/runs/28725482125).
- [PR 48 Journey Gate](https://github.com/cbrown564-alt/Velocity/actions/runs/29370739612).
- [PR 48 product E2E](https://github.com/cbrown564-alt/Velocity/actions/runs/29370739611).
- [PR 47 Journey Gate](https://github.com/cbrown564-alt/Velocity/actions/runs/29370756815).
- [PR 47 product E2E](https://github.com/cbrown564-alt/Velocity/actions/runs/29370756809).
- [`main` Journey Gate after both merges](https://github.com/cbrown564-alt/Velocity/actions/runs/29371060812).
- [`main` product E2E after both merges](https://github.com/cbrown564-alt/Velocity/actions/runs/29371060792).

## 15. Completion criteria for this incident

This incident is not complete when a patch exists or one local run passes. It is complete only when all of the following are true:

- fresh-session controls are usable before engine readiness;
- the Linux CI boot failure has a proven causal explanation;
- boot failure is bounded, observable, and recoverable;
- Journey Gate and product E2E pass on the exact promoted commit;
- required checks are enforced by GitHub;
- dependent E2E failures are classified behind a boot prerequisite;
- failure artifacts are always produced;
- local and CI verification commands match the canonical docs;
- corrected project documents link the successful evidence;
- the final candidate passes repeated main-branch and pilot-machine verification.

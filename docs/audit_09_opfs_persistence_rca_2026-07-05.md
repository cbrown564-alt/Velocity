# Audit 09 — OPFS Persistence: Root-Cause Analysis & Remediation Journey

- **Date:** 2026-07-05
- **Branch:** `fix/opfs-single-owner-handle-release` (4 commits, not yet merged to `main`)
- **Trigger:** App failed to load — console errors on boot, later a hard hang on returning sessions
- **Status:** Runtime fixes merged; verification reopened by Audit 10 until the shared boot prerequisite, returning-session/chaos suite, and promoted-commit CI soak pass
- **Related:** `docs/arch_06_local_first_persistence.md`, `docs/plan_06_backend_reset.md`

---

## 1. Executive summary

The web app failed to boot with an OPFS/DuckDB console error. What began as a
single "access handle" error turned out to be **two stacked defects**:

1. **A concurrency / handle-ownership problem** (fixed in Layers 1–3): the worker
   never released OPFS sync-access handles, and nothing guaranteed a single owner
   of the DuckDB database file across tabs/workers.
2. **A bundle incompatibility** (the true root cause of the returning-session
   hang, found only after the first fix): the **COI (multithreaded) DuckDB-WASM
   bundle cannot _reopen_ an OPFS database file at all.** It `postMessage`s the
   OPFS `FileSystemSyncAccessHandle` to its pthread workers, the handle is not
   structured-cloneable, and the worker wedges — hanging boot forever.

The first fix was correct and necessary, but it **removed the contention error
that was masking the deeper bug**. The definitive fix is to boot the
**single-threaded EH bundle** for OPFS persistence (it owns the handle in one
worker and reopens cleanly), plus boot hardening so init can never hang again.

A candid note is included in §7/§11: the first round was declared "verified" on
the strength of tests that never exercised the actual returning-session path.
The user caught it. The verification was subsequently hardened to cover it.

---

## 2. The trigger (symptom)

Initial report — console on loading the app:

```
🔄 [Persist] State rehydrated from localStorage
[duckdbWasmCache] Service worker registered velocity-duckdb-wasm-v0.1.0-pilot
🦆 [Worker] DuckDB Bundle Selected: coi { … }
🦆 [Worker] DuckDB Version: v1.4.3
🦆 [Worker] OPFS fallback DB open failed: Failed to execute 'createSyncAccessHandle'
   on 'FileSystemFileHandle': Access Handles cannot be created if there is another
   open Access Handle or Writable stream associated with the same file.
🦆 [Worker] OPFS candidate DB open failed: … (same)
```

Second report (after the first fix shipped) — a **different** error and a hard
hang on "Initializing Analysis Engine…":

```
🦆 [Worker] DuckDB Bundle Selected: coi { … }
🦆 [Worker] OPFS fallback DB open failed: Failed to execute 'postMessage' on
   'Worker': FileSystemSyncAccessHandle object could not be cloned.
🦆 [Worker] OPFS candidate DB open failed: … (same)
[stuck on "Initializing Analysis Engine…"]
```

The change in error message between the two reports was the key clue (see §4).

---

## 3. Investigation chronology (the journey)

### Phase 0 — Static review

Read the full OPFS/engine boot path: `duckdbInit.ts`, `opfsPersistence.ts`,
`duckdbPersistence.ts`, `duckdbOpfs.ts`, `workerDbState.ts`, `EngineProxy.ts`,
`BrowserEngine.ts`, `engineLifecycle.ts`, `engineWarmUp.ts`,
`usePersistenceManager.ts`, `engineActions.ts`, `bootOrchestrator.ts`,
`rehydrate.ts`, plus `arch_06` and `plan_06`. Confirmed via the installed
`@duckdb/duckdb-wasm` type defs that `dropFile`/`dropFiles`/`flushFiles` exist
but are **called nowhere** in `src/`.

### Phase 1 — Initial diagnosis: two defects

1. **Handle leak.** The boot probe opened candidate `.db` files with
   `db.open('opfs://…')` and, between attempts, only called `db.reset()`.
   `reset()` does **not** release OPFS sync-access handles; `dropFiles()` does,
   and it was never called. Every opened-but-invalid probe leaked a live handle,
   so the next `open()` collided.
2. **No single owner.** OPFS handles are exclusive per file across the entire
   origin, but the app could spawn multiple analysis workers (warm-up ×6 call
   sites, respawn, rehydrate, StrictMode double-mount), guarded only by two
   in-memory flags that didn't cross tabs. The `RESPAWN_TERMINATION_DELAY_MS =
   100ms` sleep was a tell that termination didn't synchronously free the handle.

`arch_06` had already anticipated this exact failure ("OPFS Sync Access Handle
locking / multi-tab") but the lock and handle-release were never built.

### Phase 2 — Layers 1–2 (commit `9f687f1`)

- **Explicit handle release:** `dropFiles()` before every re-open (incl. the
  validation-fail paths) and on teardown.
- **Single-owner lock:** new `opfsDbLock.ts` acquires an origin-scoped exclusive
  Web Lock (`navigator.locks`, `ifAvailable`) held for the DB session. A second
  tab that can't get it boots cleanly in memory with a new first-class
  `opfs_locked` decision instead of throwing.

Scope was confirmed with the user (chose "Layers 1+2 first").

### Phase 3 — Layer 3 (commit `d90030f`)

At the user's request, the reliability layer:

- **Graceful shutdown handshake** (`engine.shutdown` / `engine.shutdownComplete`):
  the worker drops handles + releases the lock, then acks, *then* is terminated.
  Replaces the 100ms sleep with a real teardown ack (`ENGINE_SHUTDOWN_ACK_TIMEOUT_MS`).
- **One serialized `runExclusive` lifecycle queue** covering init/respawn/shutdown
  so two workers can never be live at once.
- `discardPersistedData` now awaits graceful shutdown before purging OPFS files.

### Phase 4 — The verification gap and the real root cause

Layers 1–3 were verified with two Chromium E2E tests — but both booted **fresh**
(creating a new DB) or as a **contended second tab** (which never opens an
existing DB). **Neither reopened a pre-existing OPFS DB** — the actual
returning-session path. This was declared "verified" prematurely.

The user reloaded their real (returning) session and hit the hang, with the
`postMessage … could not be cloned` error. Reproduced deterministically in
Playwright (`goto → warm-up → persist → reload → warm-up`):

```
DataCloneError: Failed to execute 'postMessage' on 'Worker':
  FileSystemSyncAccessHandle object could not be cloned.
    at registerFileHandle (duckdb-browser-coi.worker.js)
    at prepareDBFileHandle …
🦆 OPFS desired DB open failed: … could not be cloned
🦆 OPFS open timed out (OPFS repair path)   ← worker wedged; even a fresh create times out
[hang]
```

### Phase 5 — EH fix + hardening (commit `549bedf`)

Empirically A/B-tested the bundle: forced EH and re-ran the reopen repro →
`DuckDB opened with OPFS desired DB` with **no clone error and no hang**. COI
cannot reopen; EH can. Chose EH for OPFS persistence (with the user), plus boot
hardening. Then closed the verification gap with a data-bearing reopen test.

---

## 4. Root cause (definitive)

**The COI (cross-origin-isolated, multithreaded) DuckDB-WASM bundle cannot reopen
an OPFS database file.** Opening an existing `opfs://` DB calls
`registerFileHandle`, which `postMessage`s the OPFS `FileSystemSyncAccessHandle`
to the pthread workers. That handle is **not structured-cloneable**, so it throws
`DataCloneError` and leaves the DuckDB worker wedged. COI can *create* an OPFS DB
but never *reopen* one — and once wedged, even the in-memory fallback
(`db.open(':memory:')`) hangs, producing the infinite "Initializing…" spinner.

### Why the error message changed between reports (the masking effect)

- **Before the fix:** multiple uncoordinated workers raced for the same file, so
  the *first* failure was contention — `createSyncAccessHandle … another open
  Access Handle`. This aborted the open before it ever reached
  `registerFileHandle`, hiding the deeper bug.
- **After Layers 1–3:** single-owner + handle release removed the contention, so
  the open proceeded *further* — into `registerFileHandle` — and surfaced the
  underlying COI limitation (`postMessage … could not be cloned`).

So the first fix was a real prerequisite: it was correct, it removed a genuine
class of bugs, and it exposed the true defect underneath.

---

## 5. What changed (architecture)

| Layer | Problem | Change | Key files |
|---|---|---|---|
| 1 | OPFS handles never released | `dropFiles()` before every re-open + on teardown; typed `flushFiles()` | `opfsPersistence.ts`, `worker/duckdbInit.ts`, `worker/duckdbPersistence.ts` |
| 2 | No cross-context single owner | Web-Locks `opfsDbLock`; `opfs_locked` decision → clean memory fallback | `worker/opfsDbLock.ts`, `opfsPersistence.ts`, `pilotOnboarding.ts`, `types/engineWorker.ts` |
| 3 | Uncoordinated worker lifecycle; 100ms sleep | `runExclusive` queue; graceful `engine.shutdown` ack; `shutdownWorker`; discard awaits shutdown | `workspaceBoot/engineLifecycle.ts`, `EngineProxy.ts`, `BrowserEngine.ts`, `worker/engineHandlers.ts`, store slices |
| Root fix | COI can't reopen OPFS DBs | `selectBootBundle()` forces EH when OPFS persistence is on | `duckdbBundles.ts`, `worker/duckdbInit.ts` |
| Hardening | Wedged worker hangs boot | Detect DataClone/postMessage errors → short-circuit to memory (skip repair); time-bound the memory fallback | `opfsPersistence.ts` |

Net trade-off of the root fix: OPFS persistence now runs **single-threaded (EH)**
rather than multithreaded (COI). Fast, reliable reopen — the "workspace comes
back on Monday" priority from `plan_06` — is preserved; per-query compute loses
multithreading (acceptable at pilot dataset sizes, and reversible via the
`ENABLE_DUCKDB_OPFS_PERSISTENCE` flag).

---

## 6. Verification

All in **real Chromium** via Playwright (own dev server with COOP/COEP headers),
booting the engine through the app's dev hooks (`__velocityWarmUpEngine` /
`__velocityStore`) to avoid the stale landing UI.

| Scenario | Test | Result |
|---|---|---|
| Fresh single-tab boot opens OPFS, no handle error | `opfs-single-owner.spec.ts` | ✅ |
| Second tab → `opfs_locked` → memory, no collision | `opfs-single-owner.spec.ts` | ✅ |
| **Reopen existing OPFS DB with data (rowCount intact), no clone error, no hang** | `opfs-reopen.spec.ts` | ✅ (the gap, now closed) |
| Handle-release before re-open; `opfs_locked`; lock lifecycle; bundle short-circuit | `opfsPersistence.test.ts` | ✅ |
| Web-Locks acquire/hold/release/contended/idempotent | `opfsDbLock.test.ts` | ✅ |
| Serialized lifecycle + graceful shutdown; proxy shutdown handshake | `engineLifecycle.test.ts`, `EngineProxy.shutdown.test.ts` | ✅ |
| `selectBootBundle(enabled) → eh` | `duckdbBundles.test.ts` | ✅ |

**Unit suite:** 189 files / 1535 tests pass. Typecheck + lint clean.
(One unrelated perf test — `commandPaletteSearch <100ms` — is flaky under CPU
load; passes in isolation.)

**Not yet verified:** the original machine's live browser (the Claude-in-Chrome
extension would not pair to the working session — a connection-layer issue, tried
repeatedly). The running `:3001` dev server carries this code, so a hard reload
there is the outstanding manual confirmation.

---

## 7. Challenges encountered

1. **Masking.** The reported symptom (contention) was not the root cause; fixing
   it changed the error, which is unusual and initially confusing.
2. **Verification gap (self-inflicted).** The first "verified" claim rested on
   fresh-context and contended-tab tests that never reopened an existing OPFS DB.
   The returning-session path — the one that actually failed — was untested. The
   user caught this. Corrected by adding a data-bearing reopen test.
3. **Chrome extension wouldn't connect.** `list_connected_browsers` returned
   empty and `switch_browser` found nothing across the session, so live
   inspection of the user's page wasn't possible; verification went through
   Playwright/Chromium instead.
4. **Stale E2E scaffolding.** `persistence-chaos.spec.ts`'s
   `reachDashboardWithExample` helper looks for a landing button that no longer
   matches the post-design-reset UI, so that suite can't drive the app — a
   pre-existing E2E-migration debt, unrelated to this work.
5. **Wedged-worker diagnosis.** After the clone error, subsequent DuckDB calls
   (even `open(':memory:')`) hang silently rather than error, so the failure
   presented as an indefinite spinner rather than a stack trace.

---

## 8. Decisions & trade-offs

- **EH over COI for OPFS persistence (user-confirmed).** Reliable reopen beats
  multithreaded compute for this product's stated priority; the loss is
  acceptable at pilot scale and reversible via one flag.
- **Web Locks with `ifAvailable` (non-blocking).** A contended tab degrades to
  memory immediately rather than waiting. The graceful-shutdown ack, not a
  timed lock wait, is what makes same-tab respawn hand off ownership cleanly.
- **Hardening as defense-in-depth.** With EH the wedge path is unreachable, but
  the short-circuit + time-bounded memory fallback guarantee "never hang" even if
  a future change reintroduces an OPFS-on-COI path.
- **Kept COOP/COEP headers.** Harmless with EH and leaves the door open to a
  future hybrid; removing them was out of scope.

---

## 9. Outstanding questions / follow-ups

1. **Confirm on the original machine and promoted candidate.** Hard-reload the supported pilot build; expect
   `Bundle Selected: eh`, `opened with OPFS …`, dashboard reached, no
   `could not be cloned`, no hang.
2. **Leftover OPFS artifacts.** The user's origin has empty/half-written `.db`
   and `_repair_*.db` files from the wedged COI attempts. EH opens → fails
   validation → discards them harmlessly, but a one-time purge would tidy up.
3. **EH performance.** Validate single-threaded query latency on the largest
   real pilot dataset. If unacceptable, revisit the "Hybrid: EH only when
   reopening" option (probe OPFS for a cache before choosing the bundle).
4. **Promotion evidence.** Link the exact final commit and green required Test/Journey runs from Audit 10 before restoring a Verified claim.
5. **Repair the chaos E2E.** Repoint `reachDashboardWithExample` at the current
   landing UI so `persistence-chaos.spec.ts` (and the `@rebuild-path` CI gate)
   run again; the strengthened "second tab" assertion is waiting behind it.
6. **DuckDB-WASM upgrade watch.** Track whether a newer `@duckdb/duckdb-wasm`
   fixes COI OPFS reopen (transferable handles); if so, EH-forcing could be
   relaxed. Current: `1.33.1-dev` / DuckDB engine `v1.4.3`.
7. **`crossOriginIsolated` is now unused for compute.** If COI is never used,
   consider whether the pthread bundle assets still need prefetching/caching.

---

## 10. Commit log & changed surface

```
549bedf fix(opfs): boot EH bundle for OPFS persistence — COI cannot reopen OPFS DBs
1a32152 test(e2e): real-browser regression for OPFS single-owner boot
d90030f refactor(engine): serialized lifecycle coordinator + graceful shutdown ack (Layer 3)
9f687f1 fix(opfs): single-owner lock + explicit handle release to kill DuckDB access-handle collision
```

27 files changed, ~1,154 insertions / ~91 deletions. New modules:
`src/services/worker/opfsDbLock.ts`. New tests: `opfsDbLock.test.ts`,
`EngineProxy.shutdown.test.ts`, `tests/e2e/opfs-single-owner.spec.ts`,
`tests/e2e/opfs-reopen.spec.ts` (plus additions to `opfsPersistence.test.ts`,
`engineLifecycle.test.ts`, `duckdbBundles.test.ts`, `persistenceDisplay.test.ts`,
`persistence-chaos.spec.ts`).

---

## 11. Lessons learned

- **Reproduce the user's exact state before declaring victory.** A green test
  that doesn't exercise the failing path is worse than no test — it manufactures
  false confidence. The returning-session path needed a *returning-session* test
  (persist → reload → reopen), not a fresh boot.
- **A changed error message is a signal, not noise.** Contention →
  clone-failure meant the first fix worked *and* uncovered a deeper layer; both
  facts mattered.
- **Some failures hide behind others.** Fixing the surface bug was the only way
  to see the real one — but the job wasn't done until the real one was fixed.
- **Prefer an empirical A/B over a plausible theory.** Forcing EH and re-running
  the repro turned "COI probably can't reopen" into a demonstrated fact in one
  run, and de-risked a significant architectural decision.

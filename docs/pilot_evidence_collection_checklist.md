# Pilot Evidence Collection Checklist (PILOT-4a + PILOT-6)

**Status:** Active ops playbook (use while both rows remain `In progress`)  
**Depends on:** `pilot_00_brief.md`, `pilot_01_packaging.md`, `pilot_02_trust_pack.md`, `pilot_04a_processing_gap_discovery.md`, `pilot_06_paid_pilot_program.md`  
**Purpose:** Run paid pilots without scope drift and collect decision-grade evidence for `PILOT-4a` and `PILOT-6`.

---

## 1) Pre-flight checklist (before recruiting and before each participant kickoff)

### A. Product + deploy readiness
- [ ] Pilot build passes (`npm run typecheck:all`, `npm run test:run`, `npm run build`)
- [ ] Pilot workflow E2E passes (`npm run test:e2e -- tests/e2e/pilot-workflow.spec.ts`)
- [ ] HTTPS pilot URL is live and tested on target hardware/browser
- [ ] `Pilot Log` export tested once (`pilot-event-log-download`)
- [ ] In-scope/out-of-scope promise reviewed against `pilot_00_brief.md`

### B. Recruiting + qualification readiness
- [ ] Outreach template selected (warm/cold/follow-up) from `pilot_06_paid_pilot_program.md`
- [ ] Qualification screener copied and ready for calls
- [ ] Hard disqualifiers ready to enforce (no exceptions)
- [ ] Paid terms ready (fee, duration, conversion credit, expected run count)

### C. Consent + evidence readiness
- [ ] Consent language prepared for timing capture and session notes
- [ ] Participant confirms sharing run artifacts (event log + exports + notes)
- [ ] Participant confirms 2-4 observed runs in 60-90 days

### D. Artifact folder readiness (create before first session)
- [ ] `pilot_ops/<pilot-org>/00_admin/` (screener, terms, consent notes)
- [ ] `pilot_ops/<pilot-org>/01_sessions/` (one folder per run)
- [ ] `pilot_ops/<pilot-org>/02_reviews/` (P4A-### review records)
- [ ] `pilot_ops/<pilot-org>/03_weekly_synthesis/` (weekly summaries)
- [ ] `pilot_ops/<pilot-org>/04_closeout/` (conversion and decision memo)

---

## 2) Week-by-week operating cadence (combined discovery + commercial execution)

## Week 0 - Setup + kickoff
- Confirm pre-flight checklist complete.
- Run qualification screener and reject out-of-scope prospects.
- Finalize paid terms and target run plan (dates for session 1-2 immediately).
- Create pilot org artifact folders.
- Kickoff call: restate scope boundaries, success metrics, and evidence requirements.

## Week 1 - Session 1 (baseline observed workflow)
- Run first observed project using session run sheet (Section 4).
- Export event log and save first artifact pack.
- Capture one `P4A-###` review from this session (Section 5).
- Record early commercial signal: conversion intent, WTP anchor reaction.

## Week 2 - Session 2 (repeatability check)
- Run second observed project (prefer a different workflow type if available).
- Capture second `P4A-###` review and update blocker score table.
- Compare timing trend versus Session 1 (T2-T0 and T3-T0).
- Confirm participant still aligned on paid continuation.

## Week 3 - Weekly synthesis gate #1
- Publish weekly synthesis for all active participants (Section 7).
- Re-rank blockers across all reviews to date.
- Classify each blocker: build-candidate / monitor / do-not-build-yet.
- Decide whether outreach/promise language needs tightening (no product scope changes yet).

## Week 4 - Session 3 (conditional; required for ambiguous evidence)
- Run third observed project if conversion, retention, or blocker confidence is unclear.
- Capture third `P4A-###` review where possible.
- Validate whether blocker recurrence is true cross-project behavior.
- Refresh commercial evidence (retention intent + WTP conditions).

## Week 5 - Session 4 or closeout prep
- Run fourth session only for high-value accounts or unresolved evidence.
- If evidence is already sufficient, skip to closeout prep.
- Build participant-level closeout draft: convert / extend / stop recommendation.

## Week 6 - Participant closeout
- Final debrief interview with explicit adoption decision.
- Confirm final commercial evidence fields are complete.
- Lock participant artifact set (logs, exports, notes, reviews, decision).

## Week 7 - Program synthesis and gate decision
- Aggregate all participant outcomes into program-level synthesis.
- Confirm `PILOT-4a` and `PILOT-6` definitions of done (Section 8).
- Execute go/no-go decision for escalating to `PILOT-4b` (Section 7).

---

## 3) Per-participant timeline (checklist)

## Kickoff (Day 0)
- [ ] Screener passed, hard disqualifiers checked
- [ ] Paid terms accepted
- [ ] Consent confirmed
- [ ] Session dates scheduled
- [ ] Artifact folders created

## During pilot (Days 1-60/90)
- [ ] 2-4 observed workflow sessions completed
- [ ] Event log exported per session
- [ ] Session evidence record completed per session
- [ ] One `P4A-###` review captured per session
- [ ] Commercial signals updated per session (conversion/retention/WTP)

## Closeout (Final week)
- [ ] Final debrief complete
- [ ] Participant-level recommendation recorded (convert / extend / stop)
- [ ] Blockers mapped to tracker rows (`PILOT-3`, `PILOT-4a`, `PILOT-5`, out-of-scope)
- [ ] All artifacts filed and linked

---

## 4) Per-session run sheet (use every observed run)

## Session setup (5 min)
- [ ] Confirm project is within pilot file profile and scope
- [ ] Reconfirm consent for timing and note capture
- [ ] Start session note template and assign session ID

## Live run capture (30-60 min)
- [ ] Record timing markers:
  - `T0` file selected
  - `T1` canvas ready
  - `T2` first useful crosstab
  - `T3` first PPTX export
- [ ] Record trust checkpoints (bases, weight behavior, significance confidence)
- [ ] Record manual interventions and incumbent-tool fallbacks
- [ ] Capture blocker observations with taxonomy tags

## Session artifact export (5 min)
- [ ] Export Pilot Log JSON
- [ ] Save output artifacts (PPTX/XLSX/screenshots if used)
- [ ] Save session notes to participant folder

## Debrief prompts (10-15 min)
- [ ] What blocked trust, if anything?
- [ ] What remained in incumbent tools, and why?
- [ ] Would you adopt this on next similar project? (yes/no/conditional)
- [ ] Pricing reaction at anchors (monthly/annual/per-project)
- [ ] What conditions are required to convert?

---

## 5) PILOT-4a review capture workflow (session -> `P4A-###`)

1. Create one `P4A-###` review per observed session using the template in `pilot_04a_processing_gap_discovery.md`.
2. Link session artifacts directly in that review:
   - Pilot event log JSON
   - Session/export artifacts
   - Debrief notes
3. Score each blocker candidate (F/S/T/C) and compute weighted score.
4. Update the rolling blocker register (ranked list + do-not-build-yet register).
5. During weekly synthesis, only promote blockers with repeated independent evidence.

**Rule:** No `PILOT-4b` scope recommendation from a single anecdote.

---

## 6) PILOT-6 commercial evidence capture (per participant + program rollup)

## Conversion evidence
- Capture decision state after each session: `convert`, `maybe`, `no`.
- Record explicit conversion conditions (feature, trust, workflow, procurement).

## Retention evidence
- Record retention intent (1-5) after each observed run and at closeout.
- Capture reasons for score movement week-over-week.

## Willingness-to-pay evidence
- Capture accept/reject at all three anchors:
  - Monthly ($99-$149)
  - Annual solo ($1,200-$1,800)
  - Per-project ($300-$600)
- Record objection type: price level, missing capability, trust risk, process risk.

## Workflow outcome evidence
- Track per-run speed outcomes (`T2-T0`, `T3-T0`) against pilot targets.
- Track export acceptability and manual touch-up burden.
- Track trust failures or critical incidents.

---

## 7) Weekly synthesis cadence + `PILOT-4b` go/no-go

## Weekly cadence (same day each week)
1. Consolidate all session records and `P4A-###` reviews completed that week.
2. Publish one synthesis note covering:
   - Coverage (participants, runs, project types)
   - Ranked blocker table with recommendation band
   - Commercial funnel snapshot (active, committed, converting, dropped)
   - Timing/trust trend summary
3. Flag risks requiring immediate scope clarification in outreach or onboarding scripts.

## Go/no-go criteria to escalate to `PILOT-4b`

Escalate to `PILOT-4b` planning only when **all** are true:
- [ ] At least one blocker class scores as build-candidate (`>= 3.8`) with >= 3 independent observations.
- [ ] Blocker is shown to materially threaten paid-pilot conversion or retention.
- [ ] Workaround burden is repeatedly high (time or delivery risk), not isolated.
- [ ] Proposed build slice is minimal and explicitly excludes deferred items.
- [ ] `Do Not Build Yet` register updated with rationale for excluded requests.

If any item fails, stay in `PILOT-4a` discovery and collect more evidence.

---

## 8) Definition of done (explicit)

## `PILOT-4a` done when:
- [ ] 10-15 external project/file reviews are completed and documented as `P4A-###`.
- [ ] Ranked blocker table is evidence-backed with weighted scores.
- [ ] `Do Not Build Yet` register exists and is current.
- [ ] A minimum viable `PILOT-4b` candidate scope is proposed with explicit exclusions.
- [ ] All claims cite observed pilot artifacts (no inferred-only promotions).

## `PILOT-6` done when:
- [ ] 5-8 qualified paid pilots are recruited and run within agreed scope.
- [ ] Each participant has 2-4 observed runs or an explicit early-stop reason.
- [ ] Conversion, retention, and WTP evidence fields are complete for each participant.
- [ ] Program-level synthesis supports a clear decision: continue, narrow, pause, or expand.
- [ ] Tracker evidence links point to artifact-backed synthesis (not just templates).

---

## 9) Minimum weekly output package

Produce these artifacts every week while work is `In progress`:
- [ ] Weekly synthesis note (`03_weekly_synthesis/week-XX.md`)
- [ ] Updated blocker ranking snapshot (`PILOT-4a` evidence)
- [ ] Updated commercial snapshot (`PILOT-6` evidence)
- [ ] Decision log entry: keep recruiting / adjust promise / close participant / prep gate decision


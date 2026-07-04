# DESIGN-CONV-A: Unscripted First-Session Scorecard

**Status:** Template — fill during human pilot sessions  
**Depends on:** `DESIGN-RESET-1`, post-reset screenshot pack in [`docs/assets/design-reset-evidence/`](assets/design-reset-evidence/)  
**Purpose:** Score 3–5 unscripted first sessions on the design-reset UI so Path A evidence can decide whether summon-only variable discovery (⌘K palette) holds for consultant workflows.

**Related:** [`pilot_06_paid_pilot_program.md`](pilot_06_paid_pilot_program.md) §4–5 (observed runs), [`pilot_evidence_collection_checklist.md`](pilot_evidence_collection_checklist.md) §4 (session run sheet), [`before_after_analysis.html`](assets/design-reset-evidence/before_after_analysis.html) (Q1 convergence question).

---

## 1) Session roster (target: 3–5 sessions)

| Session ID | Date | Participant | Role | Dataset / project | Observer | Consent (Y/N) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| U01 | | | | | | |
| U02 | | | | | | |
| U03 | | | | | | |
| U04 | | | | | | |
| U05 | | | | | | |

**Recruitment notes:** Prefer boutique-agency / independent consultant profiles from the PILOT-6 screener. Sessions must be **unscripted** — do not walk participants through ⌘K or the palette grammar unless they are stuck for >2 minutes (log that as an observer intervention).

---

## 2) Per-session scorecard (copy for each session)

Save one filled copy per session under `pilot_ops/<pilot-org>/01_sessions/<session-id>/unscripted_scorecard.md` (or equivalent notes folder).

```md
### Unscripted Session Scorecard — U##

- Session ID:
- Date:
- Participant role:
- Browser + OS:
- Dataset / file:
- Observer:
- Consent for timing + notes (Y/N):

#### Session setup
- Fresh workspace or resumed session?
- Participant brief: "Build a useful crosstab from this file as you normally would."
- Observer interventions (list any hints given — these do not count against the participant):

#### Timing markers
- T0 file selected / example loaded:
- T1 canvas ready (table view visible):
- T2 first useful crosstab rendered:
- **Time to first crosstab (T2 − T0):** ___ min ___ sec

#### DESIGN-CONV-A core metrics

| Metric | Value | Notes |
| :--- | :--- | :--- |
| **Time to first crosstab** | ___ min ___ sec | Target reference: <5 min (PILOT-0) |
| **Palette discovery** | Y / N / Partial | Did participant find ⌘K (or Insert) without observer prompt? How? (empty-state hint, toolbar label, hunt for sidebar, VM drag, never found) |
| **Interruption count** | ___ | Toasts, tours, popovers, blocking modals, coaching chips — count each distinct interruption on hero canvas |

#### Discovery path (check all that apply)
- [ ] Used ⌘K / Ctrl+K without prompt
- [ ] Clicked Insert toolbar button
- [ ] Opened Variable Manager first
- [ ] Looked for resident variable sidebar
- [ ] Used drag-and-drop from palette/VM
- [ ] Needed observer hint for palette
- [ ] Never reached a crosstab in session

#### Qualitative signals (Q1 — summon-only discovery)
- Where did participant look for variables first?
- Did they express confusion about missing sidebar / shelf?
- Did palette keyboard grammar (↵ / ⌥↵) emerge without teaching?
- Trust checkpoints (bases, weights, significance) — any verbalized doubt?

#### Artifacts
- [ ] Pilot event log JSON exported
- [ ] Screenshot or screen recording (if consented)
- [ ] Link to PILOT-6 evidence record (if part of paid pilot run)

#### Observer summary (2–3 sentences)
-
```

---

## 3) Program rollup (complete after ≥3 sessions)

| Metric | U01 | U02 | U03 | U04 | U05 | Median / rate |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Time to first crosstab | | | | | | |
| Found ⌘K without prompt (Y/N) | | | | | | __ / __ (rate) |
| Interruption count | | | | | | |
| Sidebar hunt observed (Y/N) | | | | | | |

### Convergence recommendation (Path A)

After rollup, answer for product review:

1. **Does summon-only insertion hold?** (yes / conditional / no — cite session IDs)
2. **If conditional or no:** prioritize `DESIGN-CONV-C` (recent strip), `DESIGN-CONV-D` (palette onboarding), or both?
3. **Interruption budget:** Is zero-interruption scripted pass representative of real first sessions?
4. **Link to tracker:** Update `DESIGN-CONV-A` evidence row in [`tracker_00_implementation_status.md`](tracker_00_implementation_status.md) §4.3.2 and [`before_after_analysis.html`](assets/design-reset-evidence/before_after_analysis.html) session metrics.

---

## 4) Definition of done (DESIGN-CONV-A evidence loop)

- [ ] Post-reset screenshot pack current in `docs/assets/design-reset-evidence/screenshots/` (see README regenerate commands)
- [ ] 3–5 unscripted first sessions scored with this template
- [ ] Rollup table completed with median/rate columns
- [ ] `before_after_analysis.html` session metrics updated from rollup
- [ ] Convergence recommendation recorded for Q1 (summon-only discovery)

# PILOT-6: Paid Pilot Program Kit

**Status:** In progress (assets ready; recruitment and commitments pending)  
**Depends on:** `PILOT-0`, `PILOT-1`, `PILOT-2`  
**Purpose:** Recruit and run 5-8 qualified paid pilots without over-promising beyond shipped product scope.

---

## 1) Outreach message templates

### A. Warm intro (agency lead / consultant)

Subject: Paid pilot: faster SAV-to-editable-deck workflow

Hi {{name}},

I am running a paid pilot for a local-first survey workflow focused on one job: analysis-ready `.sav` to defensible, editable client slides quickly.

What is already shipped:
- Local-first SAV/CSV ingest (data stays on device)
- Weighted crosstabs (apply existing weights), significance, and variable search/filters
- Editable PPTX/XLSX export and workspace reopen on same machine

What is explicitly not in this pilot:
- Weight creation/raking
- Client template import or wave-refresh automation
- Advanced modeling (e.g., conjoint, mixed effects)

Pilot format:
- 60-90 days, paid ($500-$1,500; credited to annual if converted)
- 2-4 real project walkthroughs
- Shared pilot log export + short debrief interviews

If relevant, I can send a 10-minute qualification screener and a one-page scope + trust pack.

Best,  
{{sender}}

### B. Cold outbound (short)

Subject: Paid pilot for SAV -> client deck turnaround

Hi {{name}}, I am recruiting 5-8 paid pilot partners (boutique agencies / independent consultants) for a focused workflow:
analysis-ready `.sav` -> weighted crosstab -> editable PPTX draft.

This is not a broad SPSS replacement claim; the pilot is scoped to the shipped SAV-to-deck path only. If this is a recurring pain point for your team, I can send the screener and pilot terms.

Thanks,  
{{sender}}

### C. Follow-up after no response (7-10 days)

Subject: Re: Paid pilot for SAV -> client deck turnaround

Quick follow-up in case this was buried. The pilot is intentionally narrow and paid, with explicit boundaries on what is and is not supported today. If timing is not right, no worries; if useful, I can send the 10-minute screener.

---

## 2) Qualification screener (go/no-go)

Use this as an interview form; reject if any hard disqualifier is hit.

### A. Core fit (must pass)

1. Do you deliver editable client PPTX decks from survey projects at least monthly?
2. Do you regularly receive analysis-ready `.sav` files (or can provide them during pilot)?
3. Is turnaround time from file receipt to first client-ready slide currently painful?
4. Can you run the pilot in a supported desktop browser (Chrome/Edge/Safari) with HTTPS access?
5. Can you commit to 2-4 observed real project runs in 60-90 days?
6. Can you share pilot evidence artifacts (event log export + interview feedback)?
7. Are you willing to pay for pilot participation (credited toward annual if converted)?

### B. Commercial + workflow detail (score 1-5)

8. How severe is current license/training friction in your toolchain?
9. How often do analyst hours get consumed by repetitive crosstab/deck refresh work?
10. If pilot outcomes are positive, how likely are you to continue on a paid plan?

### Hard disqualifiers

- Requires weight creation/raking as day-one requirement
- Requires client template import + wave-refresh automation as day-one requirement
- Core workload is advanced modeling outside current scope
- Needs enterprise SSO/procurement before any pilot activity

---

## 3) Paid pilot offer + scope boundaries

Use this as the canonical verbal/written offer summary.

### Offer

- **Duration:** 60-90 days
- **Participants:** 5-8 qualified pilots
- **Fee:** $500-$1,500 per pilot org (creditable toward annual conversion)
- **Cadence:** Kickoff + 2-4 observed workflow sessions + closeout review

### In-scope capabilities (safe to promise)

- Local-first `.sav` / `.csv` ingest in browser
- Variable discovery/search, filters, recoding/bucketing, grids
- Weighted crosstabs and significance (apply existing weight variable only)
- Editable PPTX/XLSX export from Analysis Canvas
- Workspace reopen on same machine; `.velocity` session handoff without respondent rows

### Out-of-scope capabilities (must be explicit)

- Creating weights/raking/RIM
- Client PowerPoint template import, saved slide recipes, wave-in-place deck refresh
- Advanced methods (mixed effects, conjoint, MaxDiff, TURF)
- Enterprise collaboration/cloud governance/direct survey platform imports

### Success criteria to evaluate during pilot

- Useful crosstab produced in under 5 minutes (qualified projects)
- Editable slide draft produced in under 15 minutes
- Export acceptability rating and manual touch-up burden captured
- Conversion, retention intent, and willingness-to-pay documented

---

## 4) Pilot interview + runbook checklist

### A. Pre-session

- Confirm file is in qualified profile (analysis-ready SAV, manageable size/shape)
- Confirm browser + secure context + OPFS availability
- Reconfirm in-scope/out-of-scope boundaries with participant
- Confirm consent for note capture and timing measurements

### B. Observed run (per project)

- Record T0 (file selected), T1 (canvas ready), T2 (first crosstab), T3 (first PPTX export)
- Ask participant to narrate confidence checks (bases, weights, significance)
- Capture where manual intervention was required
- Export pilot event log JSON at end of run

### C. Post-run debrief (10-15 min)

- What, if anything, blocked trust in output?
- What was still done in incumbent tool and why?
- Would this be adopted on next similar project? (yes/no/conditional)
- Price reaction at three anchors (monthly, annual solo, per-project)

### D. Closeout checklist (per participant)

- 2-4 observed runs completed
- Evidence template completed for each run
- Conversion recommendation captured (convert / extend / stop)
- Key blockers tagged to `PILOT-3`, `PILOT-4a`, `PILOT-5`, or out-of-scope

---

## 5) Evidence capture template (copy for each observed run)

Use this block verbatim in notes/docs.

```md
### Pilot Evidence Record

- Pilot org:
- Participant role:
- Date:
- Project ID / file:
- Browser + OS:

#### Qualification + Context
- Qualified against screener (Y/N):
- Incumbent workflow used for comparison:
- Job-to-be-done frequency:

#### Workflow Timing
- T0 file selected:
- T1 canvas ready:
- T2 first crosstab:
- T3 first PPTX export:
- T2-T0 duration:
- T3-T0 duration:

#### Outcome Quality
- Crosstab trusted without rework? (Y/N + notes)
- Export acceptability (1-5):
- Manual touch-up burden (low/med/high + notes)
- Any trust failures or critical errors:

#### Commercial Signals
- Conversion intent (convert / maybe / no):
- Retention intent after pilot (1-5):
- Willingness to pay:
  - Monthly anchor ($99-$149): accept/reject
  - Annual solo anchor ($1,200-$1,800): accept/reject
  - Per-project anchor ($300-$600): accept/reject
- Conditions required to convert:

#### Scope/Gap Notes
- Gap observed:
- Is it in current scope? (Y/N)
- Suggested tracker mapping: PILOT-3 / PILOT-4a / PILOT-5 / other
- Recommended action: keep scope / clarify promise / escalate discovery
```

---

## 6) Evidence handling rules

- Do not claim pilot success from asset creation alone; success requires signed commitments and observed workflow evidence.
- Keep all claims aligned with `pilot_00_brief.md` and `pilot_02_trust_pack.md`.
- If a prospect asks for out-of-scope features as a precondition, log as blocker and do not promise delivery dates.

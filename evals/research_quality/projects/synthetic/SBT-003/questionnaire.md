# SBT-003 questionnaire — frozen v0.1

Population: current UK Northline residential broadband customers.

Profile: tenure, plan tier, administrative legacy-plan flag, region and household type.

Outcomes: Q1 recommendation 0–10 (`nps_0_10`); Q2 overall satisfaction 1–5; Q3 likelihood to stay at agreement end 1–5 (`renewal_intent_5`). Renewal intent is stated intent, not observed churn.

Diagnostics: reliability, value, ease and trust, each 1–5.

Incidents: outage in past 90 days; if outage, severity 1–5. Support contact in past 90 days; if contact, channel, support quality 1–5 and first-contact resolution. Formal complaint past 90 days.

Rules: NPS = weighted promoter% (9–10) minus detractor% (0–6), not mean recommendation. Support measures use contact universe; outage severity uses outage universe. Diagnostic associations are not automatically causal. Tenure/plan/legacy are observational. Small-base rules apply.

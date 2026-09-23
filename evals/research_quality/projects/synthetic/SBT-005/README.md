# SBT-005: campaign assignment

Fictional BasketBridge campaign study, authored in ChatGPT with the visible **GPT-6 Pro** selector. Its exact standalone generator is preserved under `hidden/gpt6_pro_source/`; `hidden/generation_provenance.json` records the source and data fingerprints. Source, data, seed and prospective acceptance intervals were not tuned after local execution.

The 2,800 baseline households remain present after selective follow-up. Random assignment, logged receipt and self-reported recall are separate variables. Three endpoint-specific paired contrasts use the published fixed-weight variance and Holm families. Approved tables preserve eligible/valid bases, missing codes, structural exclusions, full consideration distributions and per-arm suppression. The observed-pair estimand does not recover full-cohort outcomes.

`build_reference.py` derives the reference from public respondents and policy, independently of author calculations. `independent_audit.py` uses CSV and `math.fsum` to recompute all public tables and replay exact source bytes. The private design contains four mandatory, three secondary and three restraint propositions. Numerical checks do not constitute domain validation.

`experiment_plan.json` declares the bounded four-arm pilot before model exposure. The model receives only the frozen public allowlist, with raw data or approved tables according to the arm. No hidden design, generator, reference findings, audit or scores are exposed. Blinded reviewer assessments remain separate from the coordinator's provisional adjudication.

Run both reference scripts before freezing; they refuse or must never be used to overwrite a frozen release. Verify frozen hashes with `freeze_expansion.py --verify SBT-005`. Original inputs and hypotheses remain available to audit every conclusion.

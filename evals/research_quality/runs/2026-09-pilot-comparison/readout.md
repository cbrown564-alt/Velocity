# September 2026 research-quality pilot

**Decision:** improve coverage verification and reviewer feedback before considering fine-tuning. This is a capped, one-model development pilot using existing Codex access. Scores are provisional adjudications by the primary agent; independent researchers have not validated them.

## Observed results

| Study / input / workflow | Runs | Mandatory findings recovered | Model time |
|---|---:|---|---:|
| SBT-002 / analysis / one_pass / r1 | 1 | 3/3 | 89s |
| SBT-002 / analysis / one_pass / r2 | 1 | 2/3 | 92s |
| SBT-002 / analysis / one_pass / r3 | 1 | 3/3 | 86s |
| SBT-002 / analysis / one_pass / r4 | 1 | 3/3 | 94s |
| SBT-002 / analysis / one_pass / r5 | 1 | 3/3 | 89s |
| SBT-002 / analysis / staged / r1 | 1 | 3/3 | 345s |
| SBT-002 / raw / one_pass / r1 | 1 | 2/3 | 240s |
| SBT-002 / raw / staged / r1 | 1 | 2/3 | 852s |
| SBT-003 / analysis / one_pass / r1 | 1 | 3/4 | 66s |
| FSA-CIT-2025-03 / analysis / one_pass / r1 | 1 | 3/3 | 58s |

The five fixed-input one-pass replicates fully recovered all mandatory findings in four runs. Flex’s broad case and Plus’s explorer opportunity were selected in 5/5; Plus’s combined differentiation-and-polarisation finding was complete in 4/5. One staged analysis run recovered 3/3. Both raw-data workflows recovered 2/3: they calculated full distributions but omitted polarisation from the final narrative. One pair does not establish a staging benefit.

Reference topic-cluster Jaccard across the five replicates averaged 1.00. It credits partial topic matches, so it conceals the missing polarisation qualification. Report exact mandatory-finding recovery alongside this metric.

All ten selected-finding precision scores are provisionally 1.0, unsupported rates 0 and inappropriate do-not-elevate promotions 0. These depend on inspectable semantic adjudications, including supported novel claims and joint matches. They are not evidence of error-free autonomous research. Wrong-base and unsupported-claim hard failures were not observed in the reviewed final claims; human correction counts and review time remain null.

Each raw output passed 240 independent direct weighted-sum checks for top-two percentages, ordinal distributions and binary diagnostics (0.011 percentage-point tolerance). These checks do not certify every possible raw analysis or p-value. Public FSA proportions passed 72 counts/base rounding checks. Exposure audits found no forbidden input access in the recorded tool traces; this is not a claim of complete operating-system isolation.

## Interpretation and gaps

- **Agent prompting / finding completeness — meaningful omission:** selection can discard a distributional trade-off despite having computed it. Add a study-neutral coverage check for distribution shape and material counter-evidence; prove its value on a new version or held-out project, not by feeding gold findings into these runs.
- **MCP/workflow — comparison confound:** raw prompts did not pin the reference Kish variance formula or its separate two-contrast interaction Holm family. Raw models used weighted empirical variance and a broader adjustment family. Their p-values differ methodologically. Raw arms also saw likes/dislikes absent from the approved analysis extract. The 2×2 is a workflow pilot, not a clean causal estimate of raw-data access.
- **Semantic layer / benchmark validity — needs researcher judgement:** SBT-003 recovered 3/4 mandatory findings but qualified causal claims elsewhere. Researchers may reasonably reject requiring a standalone correlation finding in the management story. The frozen variable `resolved_first_contact=0` establishes failure to resolve on first contact, not that an issue remains unresolved now; clarify labels/universes in the next study version. Keep v1 bytes and scores intact.
- **Public transfer — bounded evidence:** the FSA run recovered 3/3 mandatory findings from nine published whole-sample tables. It does not test microdata preparation, all report questions, an unseen holdout, or another model family. No time-series inference is licensed by one month.
- **Deliverable / browser convergence — prototype:** the blinded review flow and offline SBT-002 adapter exercise approval and native-chart export. They are not installed in the product, a versioned session feature, or proof of reduced researcher burden.

## Frozen evidence and scorer history

SBT-002 and SBT-003 v1.0.0, reference findings, importance tiers, scoring weights and approved inputs were hashed before valid model exposure. FSA’s selected tables and references were also frozen first. The SBT-002 pre-freeze correction narrowed the intended small significant effect to 2.79pp; a realised nominal-to-adjusted multiplicity reversal is not claimed. SBT-003 weighting produces a 2.26-point NPS shift.

The scorer gained `supported_novel` after the dry pilot so a supported claim outside the finite reference inventory could earn precision without reference recall or coverage. Every completed run was rescored with selection-1.1; that instrumentation correction is explicitly not an untouched pre-registered scoring system. Joint matches name all contributing model findings. No frozen study evidence was changed after exposure. Python runner/score orchestration was subsequently formatted; recorded execution-time runner hashes remain historical, while exact stage prompts and responses are retained.

## Runtime and cost

Ten valid outputs used 772,895 input tokens (324,352 cached) and 63,682 output tokens. Summed stage time was 33.5 minutes; this excludes reviewer time and is not elapsed project duration. Dollar cost is unavailable through existing ChatGPT Codex access and remains null. One initial CLI-version failure is retained separately, not counted as a model-quality failure.

## Independent review and promotion

Share only `../../review/2026-09-pilot/reviewer_pack.zip`. The pack contains ten anonymised outputs across three studies, with preparation, evidence, editable findings/story, review minutes and export. Keep `private_key.json`, this report, gold findings and provisional scores away from reviewers until submissions are locked. Ideally obtain at least two independent researchers, preserve every original export, then reconcile disagreements and calculate preference/correction burden. The baseline is elicited before candidates; writing style and method wording can still reveal an arm.

The user’s reviewers own independent assessments. Product promotion remains gated on those assessments, a corrected and method-matched study version, a new project split, and full product integration checks. Fine-tuning is deferred: this pilot identifies a coverage/workflow hypothesis, not a persistent learning deficit.

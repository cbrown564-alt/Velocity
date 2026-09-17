# Design Iteration 06 — Regeneration and rendered QA

## Regeneration

The 10-slide Category Board deck was regenerated against storyboard-v3 / visual-arguments-v3 and the tightened integration specification.

The regenerated deck implements:

- Slide 1 as a thesis-led synthetic-study cover without repeating Slide 2 evidence;
- Slide 2 Alternative A with metric/population/period attached to each unlike evidence anchor;
- Slide 3 as W5 consideration × W2→W5 percentage-point change with direct labels and a zero-change reference;
- Slide 4 as a five-wave Pulse hero trend with the W3 step-change and campaign period separated analytically;
- Slide 5 as two age-group W2/W3 dumbbells with a dedicated change column and campaign recognition subordinated;
- Slide 6 as four parallel-measure dumbbells rather than funnel geometry;
- Slide 7 as separate current-customer and all-eligible universes with no shared awareness/NPS axis;
- Slide 8 as a two-measure W3/W4/W5 recovery comparison with explicit W5-versus-W3 residual gaps;
- Slide 9 as directly labelled aggregate and 18–34 Harbour consideration trends on a common scale;
- Slide 10 as an operational next-wave question page with watch measures rather than prescriptions.

## Evidence checks

Displayed values were rebound to the deterministic SBT-001 values used in the review:

- Pulse consideration: W1 19.49%, W2 20.29%, W3 27.21%, W4 29.07%, W5 29.59%;
- Slide 5 consideration: 18–34 25.98%→37.12% (+11.14pp), 35+ 18.07%→23.33% (+5.26pp); W3 campaign recognition 40.26% vs 25.71%;
- Slide 6: awareness 57.79%→73.82%, consideration 20.29%→29.59%, preference 15.34%→25.11%, current provider 15.16%→19.79%;
- Northstar: W3/W4/W5 NPS −12.54/−60.71/−33.17 and problems 13.78%/34.09%/21.76%; awareness W3/W4 approximately 93.54%/93.57%;
- Harbour 18–34 consideration W1→W5 22.06%, 19.47%, 17.73%, 14.95%, 15.02%, with the aggregate series plotted on the same scale.

## Render QA

The PPTX was exported to PDF and rendered to per-slide PNGs. A contact-sheet pass found an initial typography problem: several long analytical headlines collided visually with the dek/subtitle at thumbnail scale. The deck was regenerated with analytical-slide headlines reduced to 30pt and title boxes enlarged; Slide 10's longest question was also reduced slightly.

The second render/contact-sheet pass verifies:

- all 10 slides present in the intended sequence;
- no missing/broken line paths;
- no title/dek collisions after the typography correction;
- Slide 3 labels remain separated and axes distinguish percent from percentage-point change;
- Slide 4's five-point line is continuous and the campaign marker is contextual rather than causal;
- Slide 5 endpoints and change column are legible;
- Slide 6 reads as parallel measure change rather than a funnel;
- Slide 7 visibly separates the two universes and does not use a dual/shared axis;
- Slide 8 makes the residual W5-versus-W3 gap visually prominent;
- Slide 9 uses one common scale and direct series labels;
- Slide 10 reads as a deliberately different dark editorial close;
- the deck retains varied page jobs while using consistent typography, margins, semantic colour and footnote treatment.

## Remaining judgement

The rendered deck now conforms materially to the v3 specifications. Further changes should be treated as editorial/art-direction refinement rather than correction of the structural issues identified in the critical review.

The generated PPTX, PDF and contact sheet were produced in the ChatGPT working artifact environment for review. The GitHub connector used here writes text files but does not upload the binary PPTX/PDF artifacts to this PR, so this document records the exact regeneration/QA state on-branch while the binaries are shared alongside the chat response.

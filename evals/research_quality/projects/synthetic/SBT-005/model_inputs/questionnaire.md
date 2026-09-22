# SBT-005: BasketBridge campaign-assignment study

All participants, the service and data are fictional. One enrolled adult per household,
aged 18+, with primary/shared grocery-planning responsibility, eligible for online
recontact and permission for campaign invitations. No claims about real UK prevalence.

## Baseline (day 0, before randomisation)

P1 Age: 1 18-34; 2 35-54; 3 55-64; 4 65+.
P2 Children aged under 18 in household: 0 No; 1 Yes.
P3 Work pattern: 1 Regular fixed hours; 2 Irregular/shift hours; 3 Not in paid work/retired.
P4 Ordered groceries online in last four weeks: 0 No; 1 Yes.
P5 Confidence using apps for household tasks: 1 Not at all; 2 Slightly; 3 Moderately;
4 Very; 5 Extremely confident.
P6 Grocery-budget pressure in last four weeks: 1 None; 2 Slight; 3 Moderate; 4 High;
5 Very high.
P7 Days in last seven days when evening meal was planned by the preceding evening: 0-7.

### Repeated outcomes: identical baseline and follow-up wording

**Q1 Awareness, before showing the neutral description:** Before today's interview,
had you heard of BasketBridge, the household grocery-list and meal-planning service?
0 No; 1 Yes.

Then show everyone the SAME neutral description at BOTH waves:
"BasketBridge is a household grocery-list and meal-planning service. It offers a
shared shopping list and optional meal-planning prompts."

**Q2 Consideration:** How likely would you be to consider BasketBridge for your next
grocery-planning occasion? 1 Definitely would not; 2 Probably would not; 3 Might or
might not; 4 Probably would; 5 Definitely would.
Ask everyone, not only aware respondents. Top-two-box is valid answers 4-5; retain
the full five-category distribution.

**Q3 Usage:** Have you personally used BasketBridge during the past four weeks?
0 No; 1 Yes. Self-report, not verified customer activity or a purchase.

**Q4 Meal stress:** How stressful has deciding what your household will eat been in
the last seven days? 1 Not at all; 2 Slightly; 3 Moderately; 4 Very; 5 Extremely stressful.

## Randomisation and administrative observations

After baseline, randomly allocate exactly half of enrolled respondents to a two-week
campaign invitation sequence (assignment=1), half to usual communications (assignment=0).
The campaign theme is "Plan together, shop with a clearer list" and describes shared
lists and flexible meal prompts. Both arms can encounter organic campaign placements.

Logs over days 1-14 identify any qualifying rendered creative/opened campaign message
(receipt_log 0/1) and qualifying receipt count (0-4). This measures logged receipt,
not randomisation or attention. Logs persist for survey nonreturners. Record follow-up
return status and number of recontact attempts (1-4); nonreturners exhausted four attempts.

## Follow-up (six weeks after baseline)

Repeat Q1-Q4 BEFORE asking campaign recall. The two four-week usage windows do not overlap.

Q5 Searched for more information about BasketBridge in previous four weeks: 0 No; 1 Yes.
Q6 **If recorded usage_post=1:** On how many of the last seven days did you use
BasketBridge? 0-7. Zero is a legitimate answer within the four-week-user route.
Q7 **Same user route:** Overall satisfaction with BasketBridge: 1 Very dissatisfied;
2 Somewhat dissatisfied; 3 Neither; 4 Somewhat satisfied; 5 Very satisfied.

Q8 **Everyone returning:** Do you recall seeing or receiving a BasketBridge campaign
message during the past six weeks? 0 No; 1 Yes. Ask after outcomes to avoid using this
question itself as the awareness prompt. Recall is not verified exposure.

Q9-Q11 **If recorded recall_post=1:** Rate agreement with:
- Q9 The campaign message was clear.
- Q10 The campaign message felt relevant to my household.
- Q11 The campaign message was believable.
For each: 1 Strongly disagree; 2 Somewhat disagree; 3 Neither; 4 Somewhat agree;
5 Strongly agree.

Q12 **Same recall route:** Where do you mainly recall encountering the campaign?
1 Email; 2 Social/online feed; 3 Grocery/planning app placement; 4 Other. Single response.

Q13 **Everyone returning:** How confident are you about managing next week's grocery
and meal plan? 1 Not at all; 2 Slightly; 3 Moderately; 4 Very; 5 Extremely confident.

## Missingness and analysis rules

Optional survey items allow 97 Don't know/cannot remember, 98 Prefer not to answer,
99 Item not answered. These numeric codes are never valid scores, No or zero.
Blank CSV fields are structural: no returned follow-up or a route not established by
a recorded Yes. A routing question with 97/98/99 does not establish a Yes route.
Required enrolment profiles, assignment, logs, return status and weights have no missing codes.

Use each outcome's own valid observed pre/post pairs and preserve original assignment,
including noncompliers. Both pre/post levels for the primary contrast use that SAME
paired base. Report attrition and item-missingness by arm, all valid-case distributions,
paired bases, weighted N and Kish ESS. Do not substitute recall/receipt contrasts for
assignment-based change. PRIMARY_ASSIGNMENT and SECONDARY_CHILDREN_HETEROGENEITY each
contain three publicly specified tests with separate Holm adjustment; see study_materials.json
for estimands, exact variance and limits. All other profile/diagnostic comparisons are descriptive.
Suppress any contrast with a constituent valid cell below 40; warn below 75 or ESS below 50.
No whole-population effect, causal receipt effect, ROI, actual-sales or zero-effect claim
is established by incomplete follow-up, self-report or a non-significant result.

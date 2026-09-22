# SBT-004 — Household grocery and meal planning

All participants and responses are synthetic. This instrument concerns everyday household tasks; no product concept or treatment is randomised.

## Recruitment and profile
Recruit one adult aged 18+ per household who has main or shared responsibility for grocery shopping and evening meals. Age and children status are recruitment quota information and are complete.

**P1 Age band:** 1=18–34; 2=35–49; 3=50–64; 4=65+.

**P2 Children:** Does at least one child under 16 usually live in your household? 0=No; 1=Yes.

**P3 Paid work:** How many hours do you usually work for pay each week? 0=Not currently in paid work; 1=Under 30; 2=30 or more.

## A. Attitudes
How much do you agree or disagree with each statement?

1 Strongly disagree; 2 Tend to disagree; 3 Neither agree nor disagree; 4 Tend to agree; 5 Strongly agree. 97 Don't know; 98 Prefer not to answer. All households answer each item independently.

**A1 — `att_plan_ahead_5`**  
I prefer to decide most of our evening meals several days ahead.

**A2 — `att_spontaneous_5`**  
I prefer to decide what we eat on the day rather than plan ahead.

**A3 — `att_budget_worry_5`**  
Keeping our grocery spending within what we intend is a worry for me.

**A4 — `att_price_tradeoffs_5`**  
I often have to trade off the food I would like against what the household can afford.

**A5 — `att_time_short_5`**  
I struggle to find enough time to organise our household's meals.

**A6 — `att_decision_fatigue_5`**  
Deciding what to cook feels like one decision too many.

**A7 — `att_waste_concern_5`**  
Avoiding wasted food is an important priority in our household.

**A8 — `att_waste_difficult_5`**  
I find it difficult to use up perishable food before it spoils.

**A9 — `att_digital_help_5`**  
I would welcome a digital tool that suggested what our household could cook and buy each week.

**Analyst keying note:** A2 is reverse-keyed ONLY for the planning-orientation index: `(A1 + (6-A2))/2`, using two valid answers. Item-level distributions retain original codes/wording. A missing code must never be reversed.

**Observed need flags (not questions or exclusive segments):** budget = A3>=4 AND A4>=4; effort = A5>=4 AND A6>=4; waste = A7>=4 AND A8>=4. Derive each only when both defining responses are 1..5; otherwise code 99. Overlap is permitted and must be retained.

## B. Recent behaviour
For B1–B3 record the number of DAYS, 0–7. Use 97 if unable to recall and 98 for refusal. Multiple events on one day still count as one day.

**B1 — `meal_plan_days_7d`**  
On how many of the past seven days was your household's main evening meal decided by the previous evening?

**B2 — `unplanned_topups_7d`**  
On how many of the past seven days did your household make an unplanned extra grocery shop or order because something was missing?

**B3 — `waste_days_7d`**  
On how many of the past seven days did your household throw away unused perishable food or an uneaten prepared meal? Exclude unavoidable peelings and bones.

**B4 — `over_budget_4w`**  
In any of the past four weeks, did your household spend more on groceries than you intended? 0=No; 1=Yes; 97=Don't know/cannot judge/no intended spending limit; 98=Prefer not to answer. This is self-report, not bank or receipt data.

## U. Existing tools
**U1 — `planning_tool_28d`**  
Which type of digital tool, if any, have you used most often to plan meals or make a grocery list in the past 28 days? 0=None; 1=Grocery retailer app/site; 2=Free recipe/list app/site; 3=Paid meal-planning app/site; 97=Don't know; 98=Prefer not to answer. Simply buying groceries online is not use of a planning function. Choose the most-used type if several were used.

**U2 — `tool_satisfaction_5` — ask only U1=1,2,3**  
How satisfied are you overall with this tool? 1=Very dissatisfied; 2=Fairly dissatisfied; 3=Neither; 4=Fairly satisfied; 5=Very satisfied; 97=Don't know; 98=Prefer not to answer.

**U3 — `shared_list_use_28d` — ask only U1=1,2,3**  
Have you used this tool to share a shopping list or meal plan with another member of your household in the past 28 days? 0=No; 1=Yes; 97=Don't know; 98=Prefer not to answer. No feature/no other member to share with is No.

**Routing:** U2/U3 are EMPTY for U1=0 or 97/98 because unasked. The route and unknown-screener reasons remain distinguishable through U1. Empty does not mean dissatisfied, No, or Don't know.

## N1. Support tasks — ALL households
Which tasks, if any, would you like more help with? Select all that apply. The choices are not a ranking or a forced allocation.

- `support_budget`: Keep grocery spending within what we intend.

- `support_quick_meals`: Find quick meals and re-plan when plans change.

- `support_use_up`: Use up food and leftovers before they are wasted.

- `support_shared_plan`: Share a meal plan or shopping list with other household members.

None of these is exclusive of the task choices and is stored as all four item codes=0, block status=1. Don't know for the whole question stores status=97 and all four item codes=97; refusal stores 98 throughout. Otherwise selected=1, unselected=0 and status=1.

## N2. Digital barriers — ALL households
What, if anything, would make it difficult to start using a digital grocery/meal-planning helper, or to use one more often? Select all that apply, whether or not you currently use a tool.

- `barrier_setup_time`: Time or effort to set it up and keep it updated.

- `barrier_rigid`: Suggestions or plans being too rigid for our household.

- `barrier_cost`: Another subscription or extra cost.

- `barrier_privacy`: Sharing household or shopping information.

None/DK/refusal coding is identical to N1, with `barriers_block_status`. No partial-block omissions are recorded.

## Reporting conventions
Report weighted valid-case distributions, all relevant eligible/valid bases and Kish effective bases. For N1/N2 use eligible answered RESPONDENTS as the denominator, not mentions; sums can exceed 100%. See study_materials.json for exact weights, inference estimands, fixed Holm families, warning/suppression rules and causal limits.

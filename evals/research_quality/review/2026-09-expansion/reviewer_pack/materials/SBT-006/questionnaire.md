# SBT-006 — PantryPace monthly-price study

## Population and design

One adult aged 18+ with main or shared household grocery/meal-planning responsibility
in a hypothetical UK-address household research frame. All households and service
responses are synthetic. No nationally representative or current-customer claim is made.
Baseline profiling is completed before randomisation. Each household sees ONE of
four prices, assigned at random; nobody rates multiple prices. This is a randomised
monadic stated-intent study, not a purchase task, price auction or longitudinal study.

## Baseline questions (all before price assignment)

B01 Age: 1=18-34; 2=35-54; 3=55-64; 4=65+.
B02 Child under 18 in household: 0=No; 1=Yes.
B03 Grocery-budget position: 1=Often difficult; 2=Managing with trade-offs;
3=Generally comfortable.
B04 Grocery/meal-planning responsibility: 1=Main; 2=Shared.
B05 “I am usually rushed when deciding what to make for weekday meals.”
1=Strongly disagree; 2=Somewhat disagree; 3=Neither; 4=Somewhat agree; 5=Strongly agree.
B06 Main method: 1=Paper/memory/printed recipes; 2=General notes/calendar/spreadsheet;
3=Free dedicated app; 4=Paid dedicated planning service; 5=No regular method.
B07 Confidence with household digital services: 1=Not at all; 2=Slightly;
3=Moderately; 4=Very; 5=Extremely.
B08 How many of the last seven evening meals were planned before that day? 0-7.
B09 Monthly optional digital-subscription spending: 0=None; 1=Under GBP 10;
2=GBP 10-29; 3=GBP 30+ (existing services, NOT PantryPace).
B10 Household size: 1=One; 2=Two; 3=Three; 4=Four or more.

B05/B07/B08/B09 permit 97=Don't know and 98=Prefer not to answer. Required
baseline frame/profile variables have no nonvalid codes in this baseline-complete file.

## Randomised stimulus

Arm 1 shows GBP 4/month; arm 2 GBP 7; arm 3 GBP 10; arm 4 GBP 13.
Only the price changes; feature copy, billing period and cancellation terms are identical.

> PantryPace is an optional digital household meal-planning subscription. It creates
> editable weekly meal suggestions, a shared grocery list, and reminders to use food
> already at home. You can adapt recipes and lists to your household. It does not
> include groceries, deliveries, discounts or human nutrition advice. The price is
> GBP [ASSIGNED PRICE] per household per month, billed monthly; cancel before the
> next billing month. No free trial, annual commitment or promotional discount is shown.

Record assignment for everyone. postprice_responded=0 denotes an exit after price
assignment and before entering evaluation: ALL P01-P11 fields are structural blanks.
Do not remove those rows or label the blanks as “definitely would not”.

## Post-price evaluation (module respondents only)

P01 “At GBP [PRICE] each month, how likely would your household be to start this
subscription in the next four weeks?”
1=Definitely would not; 2=Probably would not; 3=Might or might not;
4=Probably would; 5=Definitely would.

P02 Expected value at this price: 1=Very poor; 2=Poor; 3=Neither; 4=Good; 5=Very good.
P03 Fit with household needs: 1=Not at all relevant; 2=Slightly; 3=Moderately;
4=Very; 5=Extremely relevant.
P04 Price affordability: 1=Very difficult; 2=Difficult; 3=Neither;
4=Easy; 5=Very easy to afford.
P05 Expected ease of use: 1=Very difficult; 2=Difficult; 3=Neither; 4=Easy; 5=Very easy.
P06 Confidence in delivery of the described features: 1=None; 2=Little;
3=Some; 4=Much; 5=Complete confidence.
P07 Difference from known alternatives: 1=Not at all; 2=Slightly; 3=Moderately;
4=Very; 5=Extremely different.
P08 Ask ONLY if P01 is valid 1-5: certainty about that intent answer,
1=Not at all; 2=Slightly; 3=Moderately; 4=Very; 5=Extremely certain.
P09 Most useful role: 0=None; 1=Reduce planning effort; 2=Organise grocery spending;
3=Use existing food; 4=Practical recipe variety.
P10 Ask ONLY if P01 in {3,4,5}: “Supposing you did subscribe, on how many days in a
usual week do you imagine using it?” 0-7. This is NOT measured use or uptake.
P11 Ask ONLY if P01 in {1,2,3}: main reason not to give a positive answer,
1=Monthly price; 2=Free alternatives; 3=Not enough need; 4=Trust/privacy;
5=Effort; 6=Other. P01=3 legitimately receives both P10 and P11.

Every eligible P item permits 97=Don't know/unable to judge, 98=Prefer not to
answer, 99=Question not answered after entering module. Outside a route use an
empty CSV field, never 97/98/99. Items are not reverse-keyed. Preserve all five
intent categories rather than reducing the evidence to the top-two percentage alone.

## Prespecified audience and small-cell rules

Main audience: time_pressed_family, derived solely from B02 and B05 as in the
codebook. It is a baseline audience, not a randomised attribute.
An exploratory premium-niche cut is age_band in {3,4}, budget_band=3, and
current_planning_method=4. It is not an independently powered pricing experiment.
Never publish a cell rate or comparison if any component valid cell has n<40;
warn at 40<=n<75. Print the base and suppression status instead. Kish ESS<40
requires an additional precision warning even if unweighted n is larger.

## Analysis

See study_materials.json for the fixed estimands, all-assigned sensitivity,
variance formula, adjustment families and hypothetical cost assumptions. Baseline
weights do not correct post-price missingness. No payments, transactions, churn,
retention, real sales, variable costs or realised profits were observed.

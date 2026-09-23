# SBT-002 questionnaire — frozen v0.1

## Study context

UK adults aged 18–64 who are open to using a meal-kit delivery service in the next 12 months. Respondents are randomly assigned to one of three fictional concepts: **Flex**, **Plus**, or **Simple**. Concept assignment occurs after pre-concept profiling.

## Screener / profiling

### S1 Age

18–24 / 25–34 / 35–44 / 45–54 / 55–64.

### S2 Gender

Woman / Man / Non-binary or another identity / Prefer not to say.

### S3 Region

London / South East / South West / East of England / Midlands / North of England / Scotland / Wales / Northern Ireland.

### S4 Meal-kit openness

How likely are you to consider using a meal-kit delivery service in the next 12 months?

1 Definitely would not / 2 Probably would not / 3 Might or might not / 4 Probably would / 5 Definitely would.

**Eligibility:** S4 >= 3.

### P1–P3 Food exploration orientation

Please indicate agreement from 1 Strongly disagree to 5 Strongly agree.

- P1 I enjoy trying foods or flavours that are new to me.
- P2 I often look for meals that feel different from my usual choices.
- P3 I am willing to pay a little more for food that feels special or distinctive.

**Derived pre-specified strategic subgroup:** `food_explorer = 1` when mean(P1:P3) >= 4.0. This definition is frozen before concept exposure.

### P4 Current meal-kit usage

Never used / Used previously / Use occasionally / Use regularly.

## Randomisation

### RAND Concept assignment

Randomly assign approximately 1:1:1 to Flex / Plus / Simple. Assignment is independent of respondent characteristics before weighting.

## Concept stimulus

### Flex

**Premium meals that fit around you.** Choose from a broad weekly menu, swap sides and proteins, skip or pause any week, and cook most meals in around 25 minutes. Designed to make a premium meal-kit subscription easy to keep using even when plans change.

### Plus

**Restaurant inspiration at home.** Explore chef-led weekly menus, more unusual flavours and ingredients, and stronger sourcing/provenance cues. Designed for people who want their meal kit to feel more like discovering something new than solving dinner routinely.

### Simple

**Premium dinner without the effort.** A focused menu of familiar dishes, fewer preparation steps and straightforward recipes using upgraded ingredients. Designed to make a premium meal feel dependable and easy on busy evenings.

## Core evaluation

All questions refer to the assigned concept.

### Q1 Overall appeal

How appealing is this concept to you?

1 Not at all appealing / 2 / 3 / 4 / 5 Extremely appealing.

Variable: `appeal_5`.

### Q2 Purchase intent

If this service were available at a reasonable price, how likely would you be to subscribe or try it?

1 Definitely would not / 2 Probably would not / 3 Might or might not / 4 Probably would / 5 Definitely would.

Variable: `purchase_intent_5`.

### Q3 Uniqueness

How different does this concept feel from meal-kit services you already know about?

1 Not at all different / 2 / 3 / 4 / 5 Very different.

Variable: `uniqueness_5`.

### Q4 Relevance

How relevant does this concept feel to your needs?

1 Not at all relevant / 2 / 3 / 4 / 5 Extremely relevant.

Variable: `relevance_5`.

### Q5 Credibility

How believable is it that a meal-kit provider could deliver this proposition consistently?

1 Not at all believable / 2 / 3 / 4 / 5 Extremely believable.

Variable: `credibility_5`.

### Q6 Value for money

Assuming a modest premium over a standard meal-kit subscription, how good or poor would you expect the value for money to be?

1 Very poor / 2 / 3 / 4 / 5 Very good.

Variable: `value_5`.

### Q7 Ease of understanding

How easy is the concept to understand?

1 Very difficult / 2 / 3 / 4 / 5 Very easy.

Variable: `understanding_5`.

### Q8 Premium value — routed

**Ask only if Q7 >= 3.**

Thinking specifically about what makes this concept premium, how convincing is the premium proposition?

1 Not at all convincing / 2 / 3 / 4 / 5 Extremely convincing.

Variable: `premium_value_5`.

**Universe:** respondents with `understanding_5 >= 3`. This must never be silently compared as though it has the unconditional Q1/Q2 denominator.

## Likes / dislikes

### Q9 What appeals?

Which aspects, if any, particularly appeal to you? Select all that apply.

- Flexibility / ability to pause or swap
- Ease / convenience
- Broad menu choice
- Familiar meals
- New or unusual flavours
- Chef-led inspiration
- Ingredient quality
- Provenance / sourcing
- Premium feel
- None of these

Variables: `like_*` binary indicators.

### Q10 What concerns you?

Which aspects, if any, concern you? Select all that apply.

- Too expensive
- Too complicated
- Not different enough
- Too unfamiliar / adventurous
- Limited choice
- Unclear benefit
- Would not use often enough
- None of these

Variables: `dislike_*` binary indicators.

## Analysis conventions

- Primary concept summaries: weighted full 5-point distributions and top-2-box (4–5).
- Bottom-2-box (1–2) is retained where polarisation/negative response matters.
- Means are secondary descriptive summaries only.
- Concept comparisons use the randomised monadic cells.
- Pre-specified pairwise families use Holm-adjusted inference.
- `food_explorer` is the only pre-specified strategic subgroup for confirmatory heterogeneity analysis.
- Other demographic cuts are exploratory and cannot become mandatory headline findings solely because p < .05.
- Statistical significance and commercial materiality are separate fields; default commercial-materiality threshold is 5 percentage points for top-2-box differences.
- Diagnostic associations with appeal/purchase intent are descriptive unless a separately specified model/assumption supports stronger language.

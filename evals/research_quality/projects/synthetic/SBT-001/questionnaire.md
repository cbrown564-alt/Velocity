# SBT-001 Questionnaire

**Synthetic UK Mobile Brand Tracker**  
Five initial waves. Fictional brands: Northstar, Pulse, Mosaic, Lumen, Harbour.

This questionnaire is a generator/evaluation contract. Turn 2 will add exact raw variable names/value labels to `codebook.json` and ensure all routing is executable.

## Screener and profile

**S1. Age** — numeric age, 18+.  
**S2. Gender** — Man / Woman / Non-binary or another identity / Prefer not to say.  
**S3. Region** — London / South East / South West / East / Midlands / North / Wales / Scotland / Northern Ireland.  
**S4. Employment status** — full-time / part-time / self-employed / student / not working / retired / other.  
**S5. Household income** — banded; DK and prefer-not-to-say available.  
**S6. Decision role for personal mobile service** — Sole decision maker / Share decision / Not involved. Terminate if Not involved.  
**S7. Contract type** — SIM-only / handset contract / PAYG / other.  
**S8. Current provider** — Northstar / Pulse / Mosaic / Lumen / Harbour / Other.  
**S9. Provider tenure** — <1 year / 1–2 / 3–4 / 5+ / DK.

## Brand awareness

**A1. Which mobile network brands come to mind?**  
Open multi-response; generator emits coded brand mentions plus optional Other.

**A2. Which of these brands had you heard of before today?**  
Randomised brand grid; Yes / No.

## Funnel

Ask F1/F2 for brands aware at A2.

**F1. How familiar are you with each brand?**  
1 Never heard much about it / 2 / 3 / 4 / 5 Know it very well / DK.

**F2. If choosing a mobile provider today, which would you seriously consider?**  
Yes / No by aware brand.

**F3. Which one brand would you most prefer to use?**  
Single choice among prompted-aware brands + None / DK.

## Brand image

Ask for brands with F1 >= 3. For each eligible brand, ask whether each statement applies. Randomise brands and attributes independently.

- Reliable network
- Good value for money
- Innovative
- A brand I trust
- Good customer service
- Premium
- Environmentally responsible
- For people like me

Response: Applies / Does not apply / Don't know.

## Current-customer experience

Ask about S8 when S8 is one of the five tracked brands.

**E1. Overall satisfaction with current provider** — 0 Extremely dissatisfied to 10 Extremely satisfied.  
**E2. Likelihood to recommend current provider** — 0 Not at all likely to 10 Extremely likely.  
**E3. Experienced a network/service problem in past 3 months?** — Yes / No / DK.  
**E4. Contacted customer service in past 3 months?** — Yes / No / DK.  
**E5. Satisfaction with customer service** — ask only E4=Yes; 0–10.

## Marketing

**M1. Which mobile providers have you seen or heard advertising for recently?**  
Open/coded multi-response.

**M2. Which of these brands have you seen or heard advertising for recently?**  
Prompted brand grid; Yes / No / DK.

From Wave 3 onward:

**M3. Pulse campaign recognition** — synthetic campaign stimulus description; Yes definitely / Yes maybe / No / DK.

If M3 definitely/maybe:

**M4. Where do you remember seeing or hearing it?** — TV/streaming / online video / social / outdoor / audio / other; multi-response.

## Open end

**O1. What is the main reason you prefer [F3 BRAND]?**  
Turn 2 v1 must generate a latent categorical reason. Natural-language rendering is optional and must never be used as hidden evidence for quantitative truth.

## Raw missing-code policy

The export may use:

- `97`: structural/not applicable where a numeric placeholder is needed;
- `98`: don't know;
- `99`: prefer not to say/refused;
- system NULL for selected fields.

These are variable-specific user-missing definitions. `97`, `98` and `99` must not be globally collapsed without consulting the codebook.

## Required derived measures in the analysis-ready reference

- age bands;
- broad region if required for weighting;
- NPS class and NPS score by provider;
- top-box / top-two-box variants only where explicitly defined by processing recipe;
- awareness/consideration funnel summaries;
- familiar-brand denominator flags for image analysis;
- customer-service-contact denominator flag;
- tracked-brand current-customer flag;
- approved analysis weight `wt_final`.

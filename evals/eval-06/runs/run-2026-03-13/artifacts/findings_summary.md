# EVAL-06 Findings Summary

Dataset: `test_data/WVS/WVS_Cross-National_Wave_7_spss_v6_0.sav`
Weight: `W_WEIGHT`
Theme: `Happiness and generalized trust`

## Run Read

WVS Wave 7 completed the real browser metadata gate and then the full chunked load path without falling back to the Trust dataset. The bounded analysis stayed deliberately small: one weighted frequency on happiness and one weighted crosstab of happiness by generalized trust.

## Overall Happiness

- Very happy: 31.2% weighted share
- Quite happy: 54.4% weighted share
- Not very happy: 12.2% weighted share
- Not at all happy: 2.2% weighted share

## Happiness by Generalized Trust

- Most people can be trusted: 90.9% weighted happy/quite happy vs 9.1% weighted not very/not at all happy
- Need to be very careful: 84.0% weighted happy/quite happy vs 16.1% weighted not very/not at all happy

Weighted crosstab signal: chi-square 720.5 (df 3, p 0.00e+0, Cramer's V 0.087).

#!/usr/bin/env Rscript
#
# generate_ground_truth.R
#
# Generates reference JSON fixtures for Velocity's R parity test suite.
# Run this script locally to regenerate fixtures; the outputs are committed
# to tests/golden/expected/ so CI has no R dependency.
#
# Usage:
#   Rscript validation/r/generate_ground_truth.R
#
# Required packages: haven, jsonlite (install via install_packages.R)

suppressPackageStartupMessages({
  library(haven)
  library(jsonlite)
})

# ---------------------------------------------------------------------------
# Helper: population stddev (matches Velocity's DuckDB formula)
# ---------------------------------------------------------------------------
pop_stddev <- function(x) {
  n <- length(x)
  if (n == 0) return(NA_real_)
  m <- mean(x)
  sqrt(sum((x - m)^2) / n)
}

# ---------------------------------------------------------------------------
# Helper: Cramér's V from chi-square result
# ---------------------------------------------------------------------------
cramers_v <- function(chi_result, n, contingency_table) {
  k <- min(dim(contingency_table)) - 1
  if (k == 0 || n == 0) return(0)
  sqrt(unname(chi_result$statistic) / (n * k))
}

# ---------------------------------------------------------------------------
# Helper: write JSON fixture
# ---------------------------------------------------------------------------
EXPECTED_DIR <- file.path(getwd(), "tests", "golden", "expected")

write_fixture <- function(data, filename) {
  path <- file.path(EXPECTED_DIR, filename)
  json <- toJSON(data, auto_unbox = TRUE, digits = 10, pretty = TRUE)
  writeLines(json, path)
  cat("  Wrote:", filename, "\n")
}

# ---------------------------------------------------------------------------
# SAV file paths
# ---------------------------------------------------------------------------
SLEEP_SAV <- file.path(getwd(), "test_data", "sleep.sav")
BSA93_SAV <- file.path(getwd(), "test_data", "British Social Attitudes Survey", "bsa93.sav")
WVS7_SAV  <- file.path(getwd(), "test_data", "WVS", "WVS_Cross-National_Wave_7_spss_v6_0.sav")

# ---------------------------------------------------------------------------
# NOTE: Column names
# jsavvy (used by Velocity) parses SPSS files with UPPERCASE column names.
# haven (used here) returns lowercase column names.
# The fixture values (rowKey_0, colKey) use the SPSS integer codes, which
# are identical regardless of name casing.
# The SPSS variable label "age" (stored by SPSS) becomes rowKey_0 for mean
# tables — jsavvy reads this label as "age" (lowercase).
# ---------------------------------------------------------------------------

cat("=== Generating sleep.sav fixtures ===\n")
d <- zap_missing(read_sav(SLEEP_SAV))

# --- Test 1: Unweighted frequency — SEX (jsavvy col: SEX) ---
cat("Test 1: unweighted freq SEX\n")
sex_vals <- sort(unique(as.integer(d$sex[!is.na(d$sex)])))
freq1 <- lapply(sex_vals, function(v) {
  list(rowKey_0 = v, colKey = "Total", count = sum(as.integer(d$sex) == v, na.rm = TRUE))
})
write_fixture(freq1, "r_sleep_freq_sex.json")

# --- Test 2: Unweighted crosstab — MARITAL x SEX ---
cat("Test 2: unweighted crosstab MARITAL x SEX\n")
mar_vals <- sort(unique(as.integer(d$marital[!is.na(d$marital)])))
sex_vals2 <- sort(unique(as.integer(d$sex[!is.na(d$sex)])))
crosstab2 <- lapply(mar_vals, function(m) {
  lapply(sex_vals2, function(s) {
    mask <- as.integer(d$marital) == m & as.integer(d$sex) == s &
      !is.na(d$marital) & !is.na(d$sex)
    list(rowKey_0 = m, colKey = s, count = sum(mask))
  })
})
# Flatten nested list
flat2 <- do.call(c, crosstab2)
write_fixture(flat2, "r_sleep_crosstab_marital_sex.json")

# --- Test 3: Chi-square — MARITAL x SEX ---
cat("Test 3: chi-square MARITAL x SEX\n")
tab3 <- table(as.integer(d$marital[!is.na(d$marital) & !is.na(d$sex)]),
              as.integer(d$sex[!is.na(d$marital) & !is.na(d$sex)]))
chi3 <- chisq.test(tab3, correct = FALSE)
n3   <- sum(tab3)
chisq3 <- list(
  chiSquare = unname(chi3$statistic),
  df        = unname(chi3$parameter),
  pValue    = chi3$p.value,
  cramersV  = cramers_v(chi3, n3, tab3)
)
write_fixture(chisq3, "r_sleep_chisq_marital_sex.json")

# --- Test 4: Unweighted mean/stddev — AGE by SEX ---
# jsavvy variable label for AGE is "age"; this becomes rowKey_0 in Velocity
cat("Test 4: unweighted mean/stddev AGE by SEX\n")
mean4 <- lapply(sex_vals, function(s) {
  vals <- d$age[as.integer(d$sex) == s & !is.na(d$sex) & !is.na(d$age)]
  list(rowKey_0 = "age", colKey = s, mean = mean(vals), stdDev = pop_stddev(vals))
})
write_fixture(mean4, "r_sleep_mean_age_sex.json")

# --- Test 5: Unweighted mean/stddev — AGE by MARITAL ---
cat("Test 5: unweighted mean/stddev AGE by MARITAL\n")
mean5 <- lapply(mar_vals, function(m) {
  vals <- d$age[as.integer(d$marital) == m & !is.na(d$marital) & !is.na(d$age)]
  list(rowKey_0 = "age", colKey = m, mean = mean(vals), stdDev = pop_stddev(vals))
})
write_fixture(mean5, "r_sleep_mean_age_marital.json")

# ---------------------------------------------------------------------------
cat("\n=== Generating bsa93.sav fixtures ===\n")
b <- zap_missing(read_sav(BSA93_SAV))

# --- Test 6: Unweighted frequency — TAXSPEND ---
cat("Test 6: unweighted freq TAXSPEND\n")
tax_vals <- sort(unique(as.integer(b$taxspend[!is.na(b$taxspend)])))
freq6 <- lapply(tax_vals, function(v) {
  list(rowKey_0 = v, colKey = "Total", count = sum(as.integer(b$taxspend) == v, na.rm = TRUE))
})
write_fixture(freq6, "r_bsa93_freq_taxspend.json")

# --- Test 7: Weighted frequency — TAXSPEND by WTFACTOR ---
cat("Test 7: weighted freq TAXSPEND by WTFACTOR\n")
wfreq7 <- lapply(tax_vals, function(v) {
  mask <- as.integer(b$taxspend) == v & !is.na(b$taxspend) & !is.na(b$wtfactor)
  w <- b$wtfactor[mask]
  list(rowKey_0 = v, colKey = "Total",
       count         = sum(mask),
       weightedCount = sum(w),
       sumSqWeights  = sum(w^2))
})
write_fixture(wfreq7, "r_bsa93_wfreq_taxspend.json")

# --- Test 8: Unweighted crosstab — NHSSAT x VERSION ---
cat("Test 8: unweighted crosstab NHSSAT x VERSION\n")
nhs_vals <- sort(unique(as.integer(b$nhssat[!is.na(b$nhssat)])))
ver_vals  <- sort(unique(as.integer(b$version[!is.na(b$version)])))
crosstab8 <- lapply(nhs_vals, function(nh) {
  lapply(ver_vals, function(v) {
    mask <- as.integer(b$nhssat) == nh & as.integer(b$version) == v &
      !is.na(b$nhssat) & !is.na(b$version)
    list(rowKey_0 = nh, colKey = v, count = sum(mask))
  })
})
flat8 <- do.call(c, crosstab8)
write_fixture(flat8, "r_bsa93_crosstab_nhssat_version.json")

# --- Test 9: Weighted crosstab — NHSSAT x VERSION by WTFACTOR ---
cat("Test 9: weighted crosstab NHSSAT x VERSION by WTFACTOR\n")
wcrosstab9 <- lapply(nhs_vals, function(nh) {
  lapply(ver_vals, function(v) {
    mask <- as.integer(b$nhssat) == nh & as.integer(b$version) == v &
      !is.na(b$nhssat) & !is.na(b$version) & !is.na(b$wtfactor)
    w <- b$wtfactor[mask]
    list(rowKey_0 = nh, colKey = v,
         count         = sum(mask),
         weightedCount = sum(w),
         sumSqWeights  = sum(w^2))
  })
})
flat9 <- do.call(c, wcrosstab9)
write_fixture(flat9, "r_bsa93_wcrosstab_nhssat_version.json")

# --- Test 10: Chi-square — NHSSAT x VERSION ---
cat("Test 10: chi-square NHSSAT x VERSION\n")
clean10 <- b[!is.na(b$nhssat) & !is.na(b$version), ]
tab10   <- table(as.integer(clean10$nhssat), as.integer(clean10$version))
chi10   <- chisq.test(tab10, correct = FALSE)
n10     <- sum(tab10)
chisq10 <- list(
  chiSquare = unname(chi10$statistic),
  df        = unname(chi10$parameter),
  pValue    = chi10$p.value,
  cramersV  = cramers_v(chi10, n10, tab10)
)
write_fixture(chisq10, "r_bsa93_chisq_nhssat_version.json")

# --- Test 11: Weighted frequency — DOLE by WTFACTOR ---
cat("Test 11: weighted freq DOLE by WTFACTOR\n")
dole_vals <- sort(unique(as.integer(b$dole[!is.na(b$dole)])))
wfreq11 <- lapply(dole_vals, function(v) {
  mask <- as.integer(b$dole) == v & !is.na(b$dole) & !is.na(b$wtfactor)
  w <- b$wtfactor[mask]
  list(rowKey_0 = v, colKey = "Total",
       count         = sum(mask),
       weightedCount = sum(w),
       sumSqWeights  = sum(w^2))
})
write_fixture(wfreq11, "r_bsa93_wfreq_dole.json")

# --- Test 12: ESS per group — VERSION with WTFACTOR ---
# Fixture includes weightedCount and sumSqWeights so Vitest can derive
# ESS = weightedCount^2 / sumSqWeights (Kish's approximation)
cat("Test 12: ESS per group VERSION with WTFACTOR\n")
ess12 <- lapply(ver_vals, function(v) {
  mask <- as.integer(b$version) == v & !is.na(b$version) & !is.na(b$wtfactor)
  w <- b$wtfactor[mask]
  list(rowKey_0 = v, colKey = "Total",
       count         = sum(mask),
       weightedCount = sum(w),
       sumSqWeights  = sum(w^2))
})
write_fixture(ess12, "r_bsa93_wfreq_version_ess.json")

# ---------------------------------------------------------------------------
cat("\n=== Generating WVS Wave 7 fixtures (for when jsavvy bug is fixed) ===\n")
if (file.exists(WVS7_SAV)) {
  wvs <- zap_missing(read_sav(WVS7_SAV))

  # --- WVS Test 13: Unweighted frequency — Q46 ---
  cat("WVS Test 13: unweighted freq Q46\n")
  q46_vals <- sort(unique(as.integer(wvs$Q46[!is.na(wvs$Q46)])))
  freq13 <- lapply(q46_vals, function(v) {
    list(rowKey_0 = v, colKey = "Total",
         count = sum(as.integer(wvs$Q46) == v, na.rm = TRUE))
  })
  write_fixture(freq13, "r_wvs7_freq_q46.json")

  # --- WVS Test 14: Weighted frequency — Q46 by W_WEIGHT ---
  cat("WVS Test 14: weighted freq Q46 by W_WEIGHT\n")
  wfreq14 <- lapply(q46_vals, function(v) {
    mask <- as.integer(wvs$Q46) == v & !is.na(wvs$Q46) & !is.na(wvs$W_WEIGHT)
    w <- wvs$W_WEIGHT[mask]
    list(rowKey_0 = v, colKey = "Total",
         count         = sum(mask),
         weightedCount = sum(w),
         sumSqWeights  = sum(w^2))
  })
  write_fixture(wfreq14, "r_wvs7_wfreq_q46.json")

  # --- WVS Test 15: Weighted crosstab — Q1 x Q260 by W_WEIGHT ---
  cat("WVS Test 15: weighted crosstab Q1 x Q260 by W_WEIGHT\n")
  q1_vals   <- sort(unique(as.integer(wvs$Q1[!is.na(wvs$Q1)])))
  q260_vals <- sort(unique(as.integer(wvs$Q260[!is.na(wvs$Q260)])))
  wcrosstab15 <- lapply(q1_vals, function(q1v) {
    lapply(q260_vals, function(q260v) {
      mask <- as.integer(wvs$Q1) == q1v & as.integer(wvs$Q260) == q260v &
        !is.na(wvs$Q1) & !is.na(wvs$Q260) & !is.na(wvs$W_WEIGHT)
      w <- wvs$W_WEIGHT[mask]
      list(rowKey_0 = q1v, colKey = q260v,
           count         = sum(mask),
           weightedCount = sum(w),
           sumSqWeights  = sum(w^2))
    })
  })
  flat15 <- do.call(c, wcrosstab15)
  write_fixture(flat15, "r_wvs7_wcrosstab_q1_q260.json")
} else {
  cat("WVS file not found, skipping WVS fixtures.\n")
}

cat("\nDone. All fixtures written to", EXPECTED_DIR, "\n")

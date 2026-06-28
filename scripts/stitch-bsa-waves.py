#!/usr/bin/env python3
"""Stitch British Social Attitudes waves 2014-2017 into one SPSS .sav.

A realistic harmonization fixture: each wave is an isolated annual cross-section
with overlapping (trend) questions plus wave-specific items. We vertically stack
them on the union of columns, add a `bsa_year` wave identifier, and preserve
variable labels + value labels (first wave that defines a column wins).
"""
import sys
import numpy as np
import pandas as pd
import pyreadstat

BSA_DIR = "test_data/British Social Attitudes Survey"
OUT = f"{BSA_DIR}/bsa_stitched_2014_2017.sav"

FILES = [
    (2014, "bsa14_final.sav"),
    (2015, "bsa15_to_ukds_final.sav"),
    (2016, "bsa16_to_ukda.sav"),
    (2017, "bsa2017_for_ukda.sav"),
]

# Optional: keep only columns shared by >= MIN_WAVES waves (harmonization-relevant).
# 1 = full union; 2 = drop singletons that appear in only one wave.
MIN_WAVES = int(sys.argv[1]) if len(sys.argv) > 1 else 1

dfs = []
var_types = {}       # colname -> set of readstat types ('double'/'string')
wave_count = {}      # colname -> number of waves it appears in
col_labels = {}      # colname -> variable label (first wave wins)
val_labels = {}      # colname -> {value: label} (first wave wins)

for yr, fname in FILES:
    df, meta = pyreadstat.read_sav(f"{BSA_DIR}/{fname}")
    df.insert(0, "bsa_year", yr)
    dfs.append(df)
    for c in meta.column_names:
        var_types.setdefault(c, set()).add(meta.readstat_variable_types.get(c))
        wave_count[c] = wave_count.get(c, 0) + 1
        if c not in col_labels:
            lbl = meta.column_names_to_labels.get(c)
            if lbl:
                col_labels[c] = lbl
        if c not in val_labels:
            vl = meta.variable_value_labels.get(c)
            if vl:
                val_labels[c] = vl

combined = pd.concat(dfs, ignore_index=True, sort=False)

if MIN_WAVES > 1:
    keep = ["bsa_year"] + [c for c in combined.columns
                           if c != "bsa_year" and wave_count.get(c, 0) >= MIN_WAVES]
    combined = combined[keep]

# Coerce each column to a single SPSS-writable type.
numeric_cols = set()
for c in combined.columns:
    if c == "bsa_year":
        numeric_cols.add(c)
        continue
    if "string" in var_types.get(c, set()):
        combined[c] = combined[c].map(
            lambda v: "" if v is None or (isinstance(v, float) and np.isnan(v)) else str(v)
        )
    else:
        combined[c] = pd.to_numeric(combined[c], errors="coerce")
        numeric_cols.add(c)

# Labels in column order; value labels only for numeric columns.
column_labels = [col_labels.get(c, "") for c in combined.columns]
variable_value_labels = {
    c: val_labels[c] for c in combined.columns
    if c in val_labels and c in numeric_cols
}

pyreadstat.write_sav(
    combined, OUT,
    file_label=f"BSA stitched 2014-2017 (MIN_WAVES={MIN_WAVES})",
    column_labels=column_labels,
    variable_value_labels=variable_value_labels,
)

import os
size_mb = os.path.getsize(OUT) / 1048576
print(f"Wrote {OUT}")
print(f"  rows={len(combined)}  cols={combined.shape[1]}  size={size_mb:.1f} MB  MIN_WAVES={MIN_WAVES}")

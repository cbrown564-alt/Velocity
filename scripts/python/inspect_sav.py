
import pandas as pd
import pyreadstat
import json

try:
    df, meta = pyreadstat.read_sav('test_data/sleep.sav')

    variables = []
    # inspect the first 20 variables to avoid overwhelming output, or maybe all if not too huge
    # actually, print summary of all variables
    for col in meta.column_names: 
        val_labels = {}
        # pyreadstat structure for value labels can be tricky, check variable_to_label
        label_name = meta.variable_to_label.get(col)
        if label_name and label_name in meta.value_labels:
             val_labels = meta.value_labels[label_name]

        var_info = {
            "name": col,
            "label": meta.column_names_to_labels.get(col, ""),
            "measure": meta.variable_measure.get(col, ""),
            "value_labels": val_labels,
            # "missing_ranges": meta.missing_ranges.get(col, []) # if available
        }
        variables.append(var_info)

    print(json.dumps(variables, indent=2))
except Exception as e:
    print(f"Error: {e}")

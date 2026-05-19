import os

import numpy as np
import pandas as pd
import pyreadstat

# Settings
rows = 5_000_000  # 5 million rows -> ~200MB
output_file = "test_data/fixtures/test_large.sav"
os.makedirs(os.path.dirname(output_file), exist_ok=True)

print(f"Generating data for {rows} rows...")

# Create data
# Using numpy for speed
ids = np.arange(rows)
ages = np.random.randint(18, 90, size=rows)
scores = np.random.uniform(0, 100, size=rows)
groups = np.random.choice(['Control', 'Treatment_A', 'Treatment_B'], size=rows)

df = pd.DataFrame({
    'id': ids,
    'age': ages,
    'score': scores,
    'group': groups
})

variable_labels = {
    'id': 'Participant ID',
    'age': 'Age in years',
    'score': 'Test Score',
    'group': 'Experimental Group'
}

print(f"Writing to {output_file}...")
pyreadstat.write_sav(df, output_file, column_labels=variable_labels)
print(f"Success! Created {output_file}")

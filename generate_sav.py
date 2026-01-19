import pandas as pd
import pyreadstat

# Create a simple dataframe
df = pd.DataFrame({
    'id': [1, 2, 3, 4, 5],
    'age': [25, 30, 35, 40, 45],
    'score': [85.5, 90.0, 78.5, 92.0, 88.0],
    'group': ['A', 'B', 'A', 'B', 'A']
})

# Define variable labels
variable_labels = {
    'id': 'Participant ID',
    'age': 'Age in years',
    'score': 'Test Score',
    'group': 'Experimental Group'
}

# Define value labels for 'group' (SPSS maps numbers to labels usually, but string variables can represent categories too)
# For simplicity in this test, we'll keep it as strings, but pyreadstat handles it.

print("Generating 'test_small.sav'...")
pyreadstat.write_sav(df, "test_small.sav", variable_value_labels={}, column_labels=variable_labels)
print("Success! Created 'test_small.sav'")

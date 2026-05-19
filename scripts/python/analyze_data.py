import os
from pathlib import Path

import pandas as pd
import pyreadstat

ROOT = Path(__file__).resolve().parents[2]
sav_path = ROOT / "test_data/sleep.sav"
sps_path = ROOT / "test_data/surveysyntax.sps"

# Read metadata from SAV file
df, meta = pyreadstat.read_sav(str(sav_path))

print(f"Variables in {os.path.basename(sav_path)}: {list(df.columns)}")

# Variables mentioned in SPS
# Recoded: Rop2, Rop4, Rop6, Rmast1, Rmast3, Rmast4, Rmast6, Rmast7, Rpss4, Rpss5, Rpss7, Rpss8, Rsest3, Rsest5, Rsest7, Rsest9, Rsest10, Rpc1, Rpc2, Rpc7, Rpc11, Rpc15, Rpc16
# Computed Totals: toptim, tmast, tpcoiss, tslfest, tposaff, tnegaff, tpstress, tlifesat

sps_vars = [
    'Rop2', 'Rop4', 'Rop6', 'Rmast1', 'Rmast3', 'Rmast4', 'Rmast6', 'Rmast7', 
    'Rpss4', 'Rpss5', 'Rpss7', 'Rpss8', 'Rsest3', 'Rsest5', 'Rsest7', 'Rsest9', 'Rsest10', 
    'Rpc1', 'Rpc2', 'Rpc7', 'Rpc11', 'Rpc15', 'Rpc16',
    'toptim', 'tmast', 'tpcoiss', 'tslfest', 'tposaff', 'tnegaff', 'tpstress', 'tlifesat'
]

present = [v for v in sps_vars if v in df.columns]
missing = [v for v in sps_vars if v not in df.columns]

print(f"\nSPS variables PRESENT in SAV: {present}")
print(f"\nSPS variables MISSING in SAV: {missing}")

# Check base variables used in SPS
base_vars = [
    'op1', 'op2', 'op3', 'op4', 'op5', 'op6',
    'mast1', 'mast2', 'mast3', 'mast4', 'mast5', 'mast6', 'mast7',
    'pc1', 'pc2', 'pc3', 'pc4', 'pc5', 'pc6', 'pc7', 'pc8', 'pc9', 'pc10', 'pc11', 'pc12', 'pc13', 'pc14', 'pc15', 'pc16', 'pc17', 'pc18',
    'sest1', 'sest2', 'sest3', 'sest4', 'sest5', 'sest6', 'sest7', 'sest8', 'sest9', 'sest10',
    'pn1', 'pn2', 'pn3', 'pn4', 'pn5', 'pn6', 'pn7', 'pn8', 'pn9', 'pn10', 'pn11', 'pn12', 'pn13', 'pn14', 'pn15', 'pn16', 'pn17', 'pn18', 'pn19', 'pn20',
    'pss1', 'pss2', 'pss3', 'pss4', 'pss5', 'pss6', 'pss7', 'pss8', 'pss9', 'pss10',
    'lifsat1', 'lifsat2', 'lifsat3', 'lifsat4', 'lifsat5'
]

missing_base = [v for v in base_vars if v not in df.columns]
print(f"\nBase variables MISSING in SAV: {missing_base}")

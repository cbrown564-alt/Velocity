import pyreadstat, pandas as pd, numpy as np
P={1:'test_data/fixtures/brand_tracker/brandtracker_w1.sav',2:'test_data/fixtures/brand_tracker/brandtracker_w2.sav',3:'test_data/fixtures/brand_tracker/brandtracker_w3.sav',4:'public/examples/brandtracker_w4.sav',5:'test_data/fixtures/brand_tracker/brandtracker_w5.sav'}
import os
R=os.environ.get('VELOCITY_ROOT','.').rstrip('/')+'/'
def load():
    dfs=[];meta=None
    for w,p in P.items():
        d,m=pyreadstat.read_sav(R+p); dfs.append(d); meta=meta or m
    return pd.concat(dfs,ignore_index=True),meta
BR=['atlas','beacon','meridian','solstice','cardinal']
def wpct(mask,w,base):
    b=w[base].sum(); return 100*w[base & mask].sum()/b if b else np.nan

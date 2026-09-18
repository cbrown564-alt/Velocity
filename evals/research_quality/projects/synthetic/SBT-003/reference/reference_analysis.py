"""SBT-003 deterministic reference analysis."""
from pathlib import Path
import json,numpy as np,pandas as pd
ROOT=Path(__file__).resolve().parents[1];df=pd.read_csv(ROOT/'synthetic_data/respondents.csv')
def wm(x,w):return float(np.average(x,weights=w))
def nps(d):
 w=d.wt_final;p=100*wm((d.nps_0_10>=9).astype(float),w);q=100*wm((d.nps_0_10<=6).astype(float),w);return {'nps':p-q,'promoter_pct':p,'passive_pct':100-p-q,'detractor_pct':q,'n':len(d)}
def t2(d,v):return 100*wm((d[v]>=4).astype(float),d.wt_final)
masks={'unresolved_contact':(df.support_contact_90d==1)&(df.resolved_first_contact==0),'resolved_contact':(df.support_contact_90d==1)&(df.resolved_first_contact==1),'legacy_contact':(df.legacy_plan==1)&(df.support_contact_90d==1),'long_tenure':df.tenure_band.eq('6+y'),'premium_unresolved':(df.plan_tier=='Premium')&(df.support_contact_90d==1)&(df.resolved_first_contact==0)}
res={'company':nps(df),'renewal_top2_pct':t2(df,'renewal_intent_5'),'groups':{},'weighting':{},'diagnostic_correlations':{}}
for k,m in masks.items():
 d=df[m];res['groups'][k]={'prevalence_weighted_pct':100*wm(m.astype(float),df.wt_final),'nps':nps(d),'renewal_top2_pct':t2(d,'renewal_intent_5')}
res['weighting']={'nps_weighted':res['company']['nps'],'nps_unweighted':100*(df.nps_0_10.ge(9).mean()-df.nps_0_10.le(6).mean())}
res['diagnostic_correlations']={v:float(df[[v,'nps_0_10']].corr().iloc[0,1]) for v in ['reliability_5','value_5','ease_5','trust_5']}
(ROOT/'reference/analysis_results.json').write_text(json.dumps(res,indent=2))

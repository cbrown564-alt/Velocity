"""Deterministic reference analysis for SBT-002.

Produces analysis_results.json from synthetic_data/respondents.csv. No model judgement is used.
"""
from __future__ import annotations
import json, math
from pathlib import Path
import numpy as np
import pandas as pd
from scipy.stats import norm

ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/'synthetic_data/respondents.csv'
OUT=ROOT/'reference'
CORE=['appeal_5','purchase_intent_5','uniqueness_5','relevance_5','credibility_5','value_5','understanding_5']
CONCEPTS=['Flex','Plus','Simple']

def wmean(x,w):
    m=x.notna();return float(np.average(x[m],weights=w[m]))
def wpct(mask,w,valid):
    m=valid & mask.notna();return float(100*np.average(mask[m].astype(float),weights=w[m]))
def neff(w): return float(w.sum()**2/(w.pow(2).sum()))
def prop_stats(df,var,concept,sub=None):
    d=df[df.concept.eq(concept)].copy()
    if sub is not None:d=d.query(sub)
    valid=d[var].notna();w=d.loc[valid,'wt_final'];x=d.loc[valid,var]
    p=float(np.average((x>=4).astype(float),weights=w));n=neff(w);se=math.sqrt(max(p*(1-p)/n,1e-12))
    return {'top2_pct':100*p,'bottom2_pct':100*float(np.average((x<=2).astype(float),weights=w)),'mean':wmean(x,w),'n_unweighted':int(valid.sum()),'n_eff':n,'se_prop':se}
def holm(pvals):
    order=np.argsort(pvals);m=len(pvals);adj=[0.0]*m;running=0
    for rank,idx in enumerate(order):
        val=(m-rank)*pvals[idx];running=max(running,val);adj[idx]=min(1.0,running)
    return adj

def main():
    df=pd.read_csv(DATA);res={'project_id':'SBT-002','concept_metrics':{},'pairwise':{},'strategic_subgroup':{},'routing':{},'weighting_audit':{}}
    for var in CORE+['premium_value_5']:
        res['concept_metrics'][var]={c:prop_stats(df,var,c) for c in CONCEPTS}
        pairs=[('Flex','Plus'),('Flex','Simple'),('Plus','Simple')];raw=[];tmp=[]
        for a,b in pairs:
            sa=res['concept_metrics'][var][a];sb=res['concept_metrics'][var][b];diff=sa['top2_pct']-sb['top2_pct'];se=math.sqrt(sa['se_prop']**2+sb['se_prop']**2);z=(diff/100)/se;p=2*norm.sf(abs(z));raw.append(p);tmp.append((a,b,diff,p))
        adj=holm(raw);res['pairwise'][var]=[{'a':a,'b':b,'top2_diff_pp':d,'p_raw':p,'p_holm':adj[i],'significant_holm':adj[i]<.05,'commercially_material':abs(d)>=5} for i,(a,b,d,p) in enumerate(tmp)]
    for group,label in [('food_explorer==1','food_explorer'),('food_explorer==0','non_explorer')]:
        res['strategic_subgroup'][label]={c:{v:prop_stats(df,v,c,group) for v in ['appeal_5','purchase_intent_5','uniqueness_5']} for c in CONCEPTS}
    res['routing']['premium_value_5']={c:{'eligible_n':int(((df.concept==c)&(df.understanding_5>=3)).sum()),'cell_n':int((df.concept==c).sum()),'routing_rate_pct':100*float(df.loc[df.concept==c,'premium_value_5'].notna().mean())} for c in CONCEPTS}
    for c in CONCEPTS:
        d=df[df.concept==c];valid=d.purchase_intent_5.notna();res['weighting_audit'][c]={'purchase_top2_weighted_pct':prop_stats(df,'purchase_intent_5',c)['top2_pct'],'purchase_top2_unweighted_pct':100*float((d.loc[valid,'purchase_intent_5']>=4).mean())}
    (OUT/'analysis_results.json').write_text(json.dumps(res,indent=2));print(json.dumps({'status':'ok','n':len(df)},indent=2))
if __name__=='__main__':main()

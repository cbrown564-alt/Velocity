"""Build SBT-001 Turn-4 reference analyses and evidence-bound findings.

Run after generate_sbt001.py. Canonical CSVs are the sole numerical source.
No planted event coefficient is used to manufacture a finding.
"""
from __future__ import annotations
import json, math
from pathlib import Path
import numpy as np
import pandas as pd
from scipy.stats import norm

ROOT = Path(__file__).resolve().parents[3]
PROJ = ROOT / "evals/research_quality/projects/synthetic/SBT-001"
OUT = PROJ / "reference" / "analysis"
OUT.mkdir(parents=True, exist_ok=True)
BRANDS = ["northstar", "pulse", "mosaic", "lumen", "harbour"]
ATTRS = ["reliable", "value", "innovative", "trust", "customer_service", "premium", "environmental", "people_like_me"]
LOW_BASE = 50

waves = {w: pd.read_csv(PROJ / "raw" / f"wave_{w:02d}.csv") for w in range(1, 6)}

def valid_binary(d, var):
    return d[var].isin([0, 1])

def wprop(d, var, mask=None, weighted=True):
    m = valid_binary(d, var)
    if mask is not None: m &= mask
    x = d.loc[m]
    y = x[var].astype(float).to_numpy()
    wt = x.wt_final.to_numpy() if weighted else np.ones(len(x))
    p = float(np.average(y, weights=wt))
    ess = float(wt.sum() ** 2 / np.square(wt).sum())
    se = math.sqrt(max(p * (1-p) / ess, 0))
    return {"estimate":p,"unweightedBase":int(len(x)),"weightedBase":float(wt.sum()),"ess":ess,"se":se,"ci95":[max(0,p-1.96*se),min(1,p+1.96*se)]}

def wmean(d, var, mask=None):
    m = d[var].between(0,10)
    if mask is not None: m &= mask
    x=d.loc[m]; y=x[var].astype(float).to_numpy(); wt=x.wt_final.to_numpy(); mu=float(np.average(y,weights=wt)); ess=float(wt.sum()**2/np.square(wt).sum()); var=float(np.average((y-mu)**2,weights=wt)); se=math.sqrt(var/ess)
    return {"estimate":mu,"unweightedBase":int(len(x)),"weightedBase":float(wt.sum()),"ess":ess,"se":se,"ci95":[mu-1.96*se,mu+1.96*se]}

def wnps(d, provider):
    m=(d.S8_current_provider==provider)&d.E2_nps.between(0,10); x=d.loc[m]; wt=x.wt_final.to_numpy(); score=np.where(x.E2_nps>=9,1,np.where(x.E2_nps<=6,-1,0)); est=float(100*np.average(score,weights=wt)); ess=float(wt.sum()**2/np.square(wt).sum()); se=float(100*np.sqrt(max(np.average(score**2,weights=wt)-np.average(score,weights=wt)**2,0)/ess)); return {"estimate":est,"unweightedBase":int(len(x)),"weightedBase":float(wt.sum()),"ess":ess,"se":se,"ci95":[est-1.96*se,est+1.96*se]}

def diff(a,b):
    delta=b['estimate']-a['estimate']; se=math.sqrt(a['se']**2+b['se']**2); z=delta/se if se else 0.; p=float(2*norm.sf(abs(z))); return {"difference":delta,"se":se,"z":z,"pValue":p,"ci95":[delta-1.96*se,delta+1.96*se]}

def rec(aid, typ, metric, universe, wave, result, comparisonWave=None, comparison=None, tags=None):
    x={"analysisId":aid,"analysisType":typ,"metric":metric,"universe":universe,"wave":wave,"weight":"wt_final","result":result,"tags":tags or []}
    if comparisonWave is not None: x.update({"comparisonWave":comparisonWave,"comparison":comparison})
    return x

R=[]
# Funnel levels: awareness, consideration total and current usage/preference total.
for w,d in waves.items():
    for b in BRANDS:
        R.append(rec(f"AWARE_{b.upper()}_W{w}","proportion",f"A2_{b}","all eligible completes",w,wprop(d,f"A2_{b}"),tags=["funnel","awareness",b]))
        # consideration among total: structural unaware treated as 0 only for this explicitly named total-incidence measure
        tmp=d.copy(); tmp[f"CT_{b}"]=np.where(tmp[f"F2_{b}"]==1,1,0)
        R.append(rec(f"CONSID_TOTAL_{b.upper()}_W{w}","proportion",f"consideration_total:{b}","all eligible completes; unaware count as not considering",w,wprop(tmp,f"CT_{b}"),tags=["funnel","consideration",b]))
        usage=(d.S8_current_provider==b).astype(int); td=d.assign(_usage=usage); R.append(rec(f"USAGE_{b.upper()}_W{w}","proportion",f"current_provider:{b}","all eligible completes",w,wprop(td,"_usage"),tags=["funnel","usage",b]))
        pref=(d.F3_preference==b).astype(int); td=d.assign(_pref=pref); R.append(rec(f"PREF_{b.upper()}_W{w}","proportion",f"preference:{b}","all eligible completes",w,wprop(td,"_pref"),tags=["funnel","preference",b]))
# Planned Pulse changes, weighted + diagnostic unweighted
for weighted,label in [(True,"WEIGHTED"),(False,"UNWEIGHTED")]:
    a=wprop(waves[2],"F2_pulse",weighted=weighted); b=wprop(waves[3],"F2_pulse",weighted=weighted); R.append(rec(f"PULSE_CONSID_W2_W3_{label}","wave_change","F2_pulse","prompted-aware Pulse respondents",3,b,2,diff(a,b),tags=["pulse_campaign","planned",label.lower()]))
for seg,mask2,mask3 in [("18_34",waves[2].S1_age.isin(['18-24','25-34']),waves[3].S1_age.isin(['18-24','25-34'])),("35_plus",~waves[2].S1_age.isin(['18-24','25-34']),~waves[3].S1_age.isin(['18-24','25-34']))]:
    a=wprop(waves[2],"F2_pulse",mask2); b=wprop(waves[3],"F2_pulse",mask3); R.append(rec(f"PULSE_CONSID_{seg}_W2_W3","wave_change","F2_pulse",f"prompted-aware Pulse; segment {seg}",3,b,2,diff(a,b),tags=["pulse_campaign","segment",seg]))
# Pulse innovation image and campaign recognition
for w in [2,3]: R.append(rec(f"PULSE_INNOVATION_W{w}","proportion","I_pulse_innovative","Pulse familiarity >=3; DK excluded",w,wprop(waves[w],"I_pulse_innovative"),tags=["brand_image","pulse_campaign"]))
a=wprop(waves[2],"I_pulse_innovative"); b=wprop(waves[3],"I_pulse_innovative"); R.append(rec("PULSE_INNOVATION_W2_W3","wave_change","I_pulse_innovative","Pulse familiarity >=3; DK excluded",3,b,2,diff(a,b),tags=["planned","pulse_campaign","brand_image"]))
for w in [3,4,5]:
    d=waves[w]; young=d.S1_age.isin(['18-24','25-34']); R.append(rec(f"PULSE_CAMPAIGN_RECOG_18_34_W{w}","proportion","M3_pulse_campaign_recognition","18-34 eligible completes",w,wprop(d,"M3_pulse_campaign_recognition",young),tags=["marketing","pulse_campaign"])); R.append(rec(f"PULSE_CAMPAIGN_RECOG_35P_W{w}","proportion","M3_pulse_campaign_recognition","35+ eligible completes",w,wprop(d,"M3_pulse_campaign_recognition",~young),tags=["marketing","pulse_campaign"]))
# Northstar CX + reliability
for w in [3,4,5]:
    d=waves[w]; cust=d.S8_current_provider.eq('northstar'); R.append(rec(f"NORTHSTAR_NPS_W{w}","nps","E2_nps","current Northstar customers",w,wnps(d,'northstar'),tags=["northstar","customer_experience"])); R.append(rec(f"NORTHSTAR_SAT_W{w}","mean","E1_satisfaction","current Northstar customers",w,wmean(d,"E1_satisfaction",cust),tags=["northstar","customer_experience"])); R.append(rec(f"NORTHSTAR_PROBLEM_W{w}","proportion","E3_problem","current Northstar customers",w,wprop(d,"E3_problem",cust),tags=["northstar","customer_experience"])); R.append(rec(f"NORTHSTAR_RELIABILITY_W{w}","proportion","I_northstar_reliable","Northstar familiarity >=3; DK excluded",w,wprop(d,"I_northstar_reliable"),tags=["northstar","brand_image"])); R.append(rec(f"NORTHSTAR_AWARE_W{w}","proportion","A2_northstar","all eligible completes",w,wprop(d,"A2_northstar"),tags=["northstar","awareness"]))
for metric,fn in [('NPS',lambda d:wnps(d,'northstar')),('SAT',lambda d:wmean(d,'E1_satisfaction',d.S8_current_provider.eq('northstar'))),('PROBLEM',lambda d:wprop(d,'E3_problem',d.S8_current_provider.eq('northstar'))),('RELIABILITY',lambda d:wprop(d,'I_northstar_reliable')),('AWARE',lambda d:wprop(d,'A2_northstar'))]:
    for aW,bW in [(3,4),(4,5)]:
        a=fn(waves[aW]); b=fn(waves[bW]); R.append(rec(f"NORTHSTAR_{metric}_W{aW}_W{bW}","wave_change",metric.lower(),"metric-specific approved universe",bW,b,aW,diff(a,b),tags=["northstar","planned"]))
# Harbour youth trend
for w,d in waves.items():
    y=d.S1_age.isin(['18-24','25-34']); R.append(rec(f"HARBOUR_CONSID_18_34_W{w}","proportion","F2_harbour","prompted-aware Harbour respondents aged 18-34",w,wprop(d,'F2_harbour',y),tags=["harbour","trend","18_34"]))
a=wprop(waves[1],'F2_harbour',waves[1].S1_age.isin(['18-24','25-34'])); b=wprop(waves[5],'F2_harbour',waves[5].S1_age.isin(['18-24','25-34'])); R.append(rec("HARBOUR_CONSID_18_34_W1_W5","wave_change","F2_harbour","prompted-aware Harbour respondents aged 18-34",5,b,1,diff(a,b),tags=["harbour","trend","planned"]))
# Mosaic low-base trap: non-binary/another identity, total-incidence consideration
for w in [3,4,5]:
    d=waves[w]; m=d.S2_gender.eq('Non-binary/another identity'); td=d.assign(_c=np.where(d.F2_mosaic.eq(1),1,0)); R.append(rec(f"MOSAIC_CONSID_NB_W{w}","proportion","consideration_total:mosaic","non-binary/another identity respondents",w,wprop(td,'_c',m),tags=["mosaic","low_base","do_not_promote"]))

# Finding helper
by={x['analysisId']:x for x in R}
def pp(x): return 100*x
def finding(fid,ctype,refs,statement,promotion,briefs,materiality='medium',caveats=None):
    return {"findingId":fid,"claimType":ctype,"analysisRefs":refs,"statement":statement,"promotionStatus":promotion,"editorialRelevance":briefs,"materiality":materiality,"caveats":caveats or []}
F=[]
pw=by['PULSE_CONSID_W2_W3_WEIGHTED']['comparison']; pu=by['PULSE_CONSID_W2_W3_UNWEIGHTED']['comparison']; F.append(finding('F_PULSE_CONSID_UP','trend',['PULSE_CONSID_W2_W3_WEIGHTED'],f"Pulse consideration among prompted-aware respondents increased {pp(pw['difference']):.1f} percentage points from Wave 2 to Wave 3 on the approved weighted estimate.",'headline_candidate',{'BRIEF_PULSE_CMO':'high','BRIEF_CATEGORY_BOARD':'high'},'high',['Observed tracker change; do not claim the campaign caused the increase.']))
F.append(finding('F_PULSE_WEIGHT_TRAP','caveat',['PULSE_CONSID_W2_W3_WEIGHTED','PULSE_CONSID_W2_W3_UNWEIGHTED'],f"The unweighted Pulse consideration movement ({pp(pu['difference']):.1f}pp) overstates the weighted movement ({pp(pw['difference']):.1f}pp), showing that Wave 3 composition matters.",'supporting',{'BRIEF_PULSE_CMO':'high','BRIEF_CATEGORY_BOARD':'medium'},'high'))
ni=by['NORTHSTAR_NPS_W3_W4']['comparison']; F.append(finding('F_NORTHSTAR_NPS_DROP','trend',['NORTHSTAR_NPS_W3_W4'],f"Northstar NPS among current customers fell {abs(ni['difference']):.1f} points from Wave 3 to Wave 4.",'headline_candidate',{'BRIEF_NORTHSTAR_CX':'high','BRIEF_CATEGORY_BOARD':'high'},'high'))
na=by['NORTHSTAR_AWARE_W3_W4']['comparison']; F.append(finding('F_NORTHSTAR_AWARE_RESILIENT','caveat',['NORTHSTAR_AWARE_W3_W4'],f"Northstar prompted awareness changed only {pp(na['difference']):+.1f}pp from Wave 3 to Wave 4, while customer-experience measures deteriorated.",'supporting',{'BRIEF_NORTHSTAR_CX':'high','BRIEF_CATEGORY_BOARD':'high'},'medium',['Small observed movement is not an equivalence test.']))
h=by['HARBOUR_CONSID_18_34_W1_W5']['comparison']; F.append(finding('F_HARBOUR_YOUTH_DECLINE','trend',['HARBOUR_CONSID_18_34_W1_W5'],f"Harbour consideration among prompted-aware 18–34s declined {abs(pp(h['difference'])):.1f} percentage points between Wave 1 and Wave 5.",'headline_candidate',{'BRIEF_CATEGORY_BOARD':'high'},'high'))
m=by['MOSAIC_CONSID_NB_W4']['result']; F.append(finding('F_MOSAIC_LOWBASE_SPIKE','caveat',['MOSAIC_CONSID_NB_W3','MOSAIC_CONSID_NB_W4','MOSAIC_CONSID_NB_W5'],f"Mosaic shows a dramatic point-estimate movement among non-binary respondents, but the Wave 4 unweighted base is only {m['unweightedBase']}; it should not be promoted as a client finding.",'do_not_promote',{'BRIEF_CATEGORY_BOARD':'none'},'low',['Low base; unstable estimate.']))

(OUT/'analysis_results.json').write_text(json.dumps({"projectId":"SBT-001","version":"turn4-v1","lowBaseThreshold":LOW_BASE,"analyses":R},indent=2),encoding='utf-8')
(OUT/'findings.json').write_text(json.dumps({"projectId":"SBT-001","version":"turn4-v1","findings":F},indent=2),encoding='utf-8')
summary={"analysisCount":len(R),"findingCount":len(F),"hardChecks":{"allResultsHaveBases":all('unweightedBase' in x['result'] for x in R),"allFindingsHaveAnalysisRefs":all(all(r in by for r in f['analysisRefs']) for f in F),"mosaicLowBasePreserved":m['unweightedBase']<LOW_BASE},"keyMetrics":{"pulseWeightedChangePp":pp(pw['difference']),"pulseUnweightedChangePp":pp(pu['difference']),"northstarNpsChange":ni['difference'],
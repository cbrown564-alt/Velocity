from sbt001_model import *

def prop(d,col,mask=None,weighted=True):
 x=d if mask is None else d.loc[mask]; y=(x[col]==1).astype(float); return np.average(y,weights=x.wt_final) if weighted else y.mean()
def nps(d,b):
 x=d[d.S8_current_provider==b].E2_nps; return 100*((x>=9).mean()-(x<=6).mean())
def metrics(ds):
 w1,w2,w3,w4,w5=ds; m={}; a2=w2.F2_pulse!=97; a3=w3.F2_pulse!=97
 m['pulse_w3_weighted_uplift_pp']=100*(prop(w3,'F2_pulse',a3)-prop(w2,'F2_pulse',a2)); m['pulse_w3_unweighted_uplift_pp']=100*(prop(w3,'F2_pulse',a3,False)-prop(w2,'F2_pulse',a2,False)); m['pulse_unweighted_overstatement_pp']=m['pulse_w3_unweighted_uplift_pp']-m['pulse_w3_weighted_uplift_pp']; m['northstar_nps_w3']=nps(w3,'northstar'); m['northstar_nps_w4']=nps(w4,'northstar'); m['northstar_nps_drop']=m['northstar_nps_w4']-m['northstar_nps_w3']; m['northstar_awareness_w3']=100*prop(w3,'A2_northstar'); m['northstar_awareness_w4']=100*prop(w4,'A2_northstar'); m['northstar_awareness_move']=m['northstar_awareness_w4']-m['northstar_awareness_w3']
 y1=w1.S1_age.isin(AGE[:2])&(w1.F2_harbour!=97); y5=w5.S1_age.isin(AGE[:2])&(w5.F2_harbour!=97); m['harbour_youth_consider_w1']=100*prop(w1,'F2_harbour',y1); m['harbour_youth_consider_w5']=100*prop(w5,'F2_harbour',y5); m['harbour_youth_decline']=m['harbour_youth_consider_w5']-m['harbour_youth_consider_w1']; m['pulse_recog_young_w3']=100*prop(w3,'M3_pulse_campaign_recognition',w3.S1_age.isin(AGE[:2])); m['pulse_recog_older_w3']=100*prop(w3,'M3_pulse_campaign_recognition',~w3.S1_age.isin(AGE[:2])); m['min_kish_ess']=min(d.wt_final.sum()**2/(d.wt_final.pow(2).sum()) for d in ds); return m
def gates(m):
 return {'pulse_w3_weighted_uplift':3<=m['pulse_w3_weighted_uplift_pp']<=10,'pulse_w3_unweighted_overstatement':m['pulse_unweighted_overstatement_pp']>=1.2,'northstar_w4_customer_experience_drop':m['northstar_nps_drop']<=-15,'northstar_w4_awareness_resilience':abs(m['northstar_awareness_move'])<2,'harbour_w1_w5_youth_decline':m['harbour_youth_decline']<=-5,'campaign_targeting':m['pulse_recog_young_w3']-m['pulse_recog_older_w3']>=5,'weight_ess':m['min_kish_ess']>=1500}


def image_routing_violations(d):
    """Validate the questionnaire independently of the generator's routing mask."""
    violations = 0
    for brand in B:
        familiar = d[f'F1_{brand}'].isin([3, 4, 5])
        eligible = d[f'A2_{brand}'].eq(1) & familiar
        for attribute in ATTR:
            values = d[f'I_{brand}_{attribute}']
            violations += int((~eligible & values.ne(97)).sum())
            violations += int((eligible & ~values.isin([0, 1, 98, 99])).sum())
    return violations


def verify_canonical(project):
    """Reject stale or modified input before attaching this version's provenance."""
    import hashlib
    report = json.loads((project / 'hidden/validation_report.json').read_text())
    if report.get('generatorVersion') != VERSION or report.get('status') != 'PASS':
        raise ValueError('Regenerate canonical data with the current generator before continuing')
    for wave in range(1, 6):
        source = project / 'raw' / f'wave_{wave:02d}.csv'
        digest = hashlib.sha256(source.read_bytes()).hexdigest()
        if report.get('canonicalSha256', {}).get(str(wave)) != digest:
            raise ValueError(f'Canonical Wave {wave} does not match its generation report')
    return report

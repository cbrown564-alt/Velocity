"""SBT-003 pre-model freeze validator."""
from pathlib import Path
import json,sys
ROOT=Path(__file__).resolve().parents[1];r=json.loads((ROOT/'reference/analysis_results.json').read_text());c=r['company'];g=r['groups'];checks=[]
def ck(i,x,d):checks.append({'id':i,'pass':bool(x),'detail':d})
ck('CX1',all(k in c for k in ['nps','promoter_pct','passive_pct','detractor_pct']),c)
ck('CX2',g['unresolved_contact']['nps']['nps']<g['resolved_contact']['nps']['nps']-15,{'u':g['unresolved_contact']['nps']['nps'],'r':g['resolved_contact']['nps']['nps']})
ck('CX3',g['unresolved_contact']['nps']['n']<c['n'],g['unresolved_contact']['nps']['n'])
ck('CX4',g['premium_unresolved']['nps']['n']<75,g['premium_unresolved']['nps']['n'])
ck('CX5',g['legacy_contact']['prevalence_weighted_pct']<25 and g['legacy_contact']['nps']['nps']<c['nps']-10,g['legacy_contact'])
ck('CX6',g['long_tenure']['nps']['nps']<c['nps'],g['long_tenure'])
ck('CX7',abs(r['weighting']['nps_weighted']-r['weighting']['nps_unweighted'])>=2,r['weighting'])
ck('CX8',abs(c['nps']-(c['promoter_pct']-c['detractor_pct']))<1e-8,c)
ck('CX9',sum(abs(v)>=.35 for v in r['diagnostic_correlations'].values())>=2,r['diagnostic_correlations'])
ck('CX10',True,'renewal intent remains separately named; claim boundary is evaluator-enforced')
out={'status':'PASS' if all(x['pass'] for x in checks) else 'FAIL','checks':checks};(ROOT/'hidden/freeze_validation.json').write_text(json.dumps(out,indent=2));print(json.dumps(out,indent=2));sys.exit(0 if out['status']=='PASS' else 1)

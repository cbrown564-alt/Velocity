import json,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
SCRIPT=ROOT/'scripts/python/research_quality/score_selection.py'

def test_selection_metrics_known_fixture(tmp_path):
    ref={'findings':[
      {'finding_id':'A','tier':'mandatory','topic_cluster':'a'},
      {'finding_id':'B','tier':'mandatory','topic_cluster':'b'},
      {'finding_id':'C','tier':'secondary','topic_cluster':'c'},
      {'finding_id':'D','tier':'do_not_elevate','topic_cluster':'d'}]}
    matches=[
      {'model_finding_id':'m1','reference_finding_id':'A','match_state':'full','model_importance':'primary','topic_cluster':'a'},
      {'model_finding_id':'m2','reference_finding_id':'B','match_state':'partial','model_importance':'primary','topic_cluster':'b'},
      {'model_finding_id':'m3','reference_finding_id':None,'match_state':'unsupported','model_importance':'secondary','topic_cluster':'x'},
      {'model_finding_id':'m4','reference_finding_id':'D','match_state':'full','model_importance':'primary','topic_cluster':'d'}]
    rp=tmp_path/'r.json';mp=tmp_path/'m.json';op=tmp_path/'o.json'
    rp.write_text(json.dumps(ref));mp.write_text(json.dumps(matches))
    subprocess.run([sys.executable,str(SCRIPT),'--reference',str(rp),'--matches',str(mp),'--out',str(op)],check=True)
    o=json.loads(op.read_text())
    assert o['mandatory_recall']==0.5
    assert o['selected_precision']==0.75
    assert o['unsupported_rate']==0.25
    assert o['do_not_elevate_rate']==1.0

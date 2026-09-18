"""Deterministic selection metrics from adjudicated finding matches."""
from __future__ import annotations
import argparse,json
from pathlib import Path
def safe(a,b):return a/b if b else 0.0
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--reference',required=True);ap.add_argument('--matches',required=True);ap.add_argument('--out',required=True);a=ap.parse_args()
 ref=json.loads(Path(a.reference).read_text())['findings'];matches=json.loads(Path(a.matches).read_text())
 mandatory={x['finding_id'] for x in ref if x['tier']=='mandatory'};dne={x['finding_id'] for x in ref if x['tier']=='do_not_elevate'}
 full={x.get('reference_finding_id') for x in matches if x['match_state']=='full'};selected=[x for x in matches if x['match_state']!='duplicate']
 supported=[x for x in selected if x['match_state'] in ('full','partial')];unsupported=[x for x in selected if x['match_state'] in ('unsupported','contradiction')]
 elevated_dne=[x for x in selected if x.get('reference_finding_id') in dne and x.get('model_importance')=='primary']
 clusters={x.get('topic_cluster') for x in supported if x.get('topic_cluster')}
 report={'mandatory_recall':safe(len(mandatory&full),len(mandatory)),'selected_precision':safe(len(supported),len(selected)),'unsupported_rate':safe(len(unsupported),len(selected)),'do_not_elevate_rate':safe(len(elevated_dne),len(dne)),'redundancy_adjusted_coverage':safe(len(clusters),len({x.get('topic_cluster') for x in ref if x.get('topic_cluster') and x['tier'] in ('mandatory','secondary')}))}
 Path(a.out).write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
if __name__=='__main__':main()

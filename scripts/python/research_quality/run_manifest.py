"""Create/validate immutable evaluation run manifests without invoking a model."""
from __future__ import annotations
from pathlib import Path
import argparse,hashlib,json,datetime
FORBIDDEN=('/hidden/','reference_findings','trap_truth','freeze_validation')
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def classify(path):
 s=str(path).replace('\\','/')
 if any(x in s for x in FORBIDDEN):return 'forbidden'
 if 'respondents.csv' in s:return 'raw_data'
 if 'analysis_results' in s:return 'analysis_surface'
 return 'study_material'
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--study',required=True);ap.add_argument('--version',required=True);ap.add_argument('--arm',required=True);ap.add_argument('--provider',required=True);ap.add_argument('--model',required=True);ap.add_argument('--run-id',required=True);ap.add_argument('--input',action='append',default=[]);ap.add_argument('--out',required=True);a=ap.parse_args()
 arts=[]
 for x in a.input:
  c=classify(x)
  if c=='forbidden':raise SystemExit(f'forbidden model exposure: {x}')
  arts.append({'path':x,'sha256':sha(x),'exposure_class':c})
 out={'run_id':a.run_id,'study_id':a.study,'study_version':a.version,'arm':a.arm,'model':{'provider':a.provider,'model_id':a.model},'replicate':1,'input_artifacts':arts,'output_artifacts':[],'stage_runs':[],'status':'planned','invalid_reason':None,'started_at':None,'completed_at':None,'created_at':datetime.datetime.now(datetime.timezone.utc).isoformat()}
 Path(a.out).write_text(json.dumps(out,indent=2))
if __name__=='__main__':main()

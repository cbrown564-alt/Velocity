"""Fail closed on benchmark leakage before a model run."""
from pathlib import Path
import argparse,json
FORBIDDEN_TOKENS=('/hidden/','trap_truth','reference_findings','freeze_validation','scoring_key')
def main():
 ap=argparse.ArgumentParser();ap.add_argument('manifest');a=ap.parse_args();m=json.loads(Path(a.manifest).read_text());bad=[]
 for x in m.get('input_artifacts',[]):
  p=x['path'].replace('\\','/')
  if any(t in p for t in FORBIDDEN_TOKENS):bad.append(p)
 if bad:raise SystemExit('FORBIDDEN EXPOSURE: '+', '.join(bad))
 print(json.dumps({'status':'PASS','run_id':m['run_id'],'inputs':len(m.get('input_artifacts',[]))},indent=2))
if __name__=='__main__':main()

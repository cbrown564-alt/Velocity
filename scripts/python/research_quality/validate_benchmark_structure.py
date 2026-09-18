"""Repository-level pre-presentation benchmark structural validator."""
from pathlib import Path
import json,sys
ROOT=Path(__file__).resolve().parents[3]
errors=[]
def err(x):errors.append(x)
for study in ['SBT-002','SBT-003']:
 p=ROOT/f'evals/research_quality/projects/synthetic/{study}'
 required=['manifest.json','questionnaire.md','hidden/trap_truth.json','hidden/generate_'+study.lower().replace('-','')+'.py','hidden/validate_freeze.py','reference/reference_analysis.py','reference/reference_findings.json']
 for r in required:
  if not (p/r).exists():err(f'{study}: missing {r}')
 if (p/'manifest.json').exists():
  m=json.loads((p/'manifest.json').read_text())
  if m.get('presentation_in_scope') is not False:err(f'{study}: presentation must be out of scope')
 if (p/'reference/reference_findings.json').exists():
  fs=json.loads((p/'reference/reference_findings.json').read_text()).get('findings',[])
  if not any(x.get('tier')=='mandatory' for x in fs):err(f'{study}: no mandatory findings')
  if not any(x.get('tier')=='do_not_elevate' for x in fs):err(f'{study}: no restraint findings')
out={'status':'PASS' if not errors else 'FAIL','errors':errors}
print(json.dumps(out,indent=2));sys.exit(0 if not errors else 1)

"""Extract a bounded real-table transfer case; retain original cell references.

Use the bundled document runtime (openpyxl, read-only). No microdata or new
significance tests are inferred from published, rounded marginal tables.
"""
import hashlib
import json
from pathlib import Path
import urllib.request
import openpyxl

REPO = Path(__file__).resolve().parents[3]
PROJECT = REPO/'evals/research_quality/projects/public/FSA-CIT-2025-03'
URL = 'https://fsaopendata.blob.core.windows.net/opendatacatalog/FSA-ConsumerInsightsSurvey-March25-Tablesv1.0.xlsx'
CATALOG = 'https://data.food.gov.uk/catalog/datasets/0bfd916a-4e01-4cb8-ba16-763f0b36b50c'
METHOD = 'https://science.food.gov.uk/article/140560-consumer-insights-tracker-technical-report-2025'


def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def write(p, value):
    p.write_text(json.dumps(value,indent=2)+'\n')


def main():
    if (PROJECT/'freeze.json').exists():
        raise SystemExit('Already frozen; retain this version unchanged')
    source=PROJECT/'source/march2025.xlsx'
    source.parent.mkdir(parents=True,exist_ok=True)
    if not source.exists():
        urllib.request.urlretrieve(URL,source)
    workbook=openpyxl.load_workbook(source,read_only=True,data_only=True)
    perc,counts=workbook['Percents'],workbook['Counts']
    selected=[('Q2m',8,27),('Q3m',27,46),('Q12_8',333,352),('Q12_14',428,447),('Q13',447,467),('Q14_1',467,486),('Q14_3',505,524),('Q14a',543,563),('Q16',614,634)]
    tables={}
    checks=[]
    for key,start,end in selected:
        rows=[]
        for row in range(start+3,end):
            label,value=perc.cell(row,1).value,perc.cell(row,2).value
            count=counts.cell(row,2).value
            if not label or not isinstance(value,(int,float)):
                continue
            assert 0<=value<=1
            # Counts and percentages are independently rounded in the publisher's workbook.
            error=abs(100*count/2051-100*value)
            checks.append(dict(cell=f'Percents!B{row}', error_pp=error, passed=error<.006))
            rows.append(dict(response=label, percent=100*value, weighted_count=count, source_cell=f'Percents!B{row}', count_cell=f'Counts!B{row}'))
        tables[key]=dict(question=perc.cell(start,1).value, universe='All respondents', n_unweighted=perc.cell(start+1,2).value, n_weighted=perc.cell(start+2,2).value, weighting='Publisher final weights', rows=rows)
    assert all(c['passed'] for c in checks)
    package=PROJECT/'model_inputs';package.mkdir(exist_ok=True)
    write(package/'analysis_results.json',dict(study_id=PROJECT.name,source_sha256=sha(source),source_url=URL,tables=tables))
    write(package/'study_materials.json',dict(study_id=PROJECT.name,title='Food affordability, concerns and confidence — March 2025',synthetic=False,decision_question='What should an FSA research manager prioritise from this March snapshot, and what does the evidence not establish?',population='Adults aged 16+ in England, Wales and Northern Ireland; Scotland excluded',fieldwork='7–11 March 2025',design='Online YouGov quota sample, n=2051; published weighted aggregate tables',analysis_policy=dict(inference='Descriptive only for this extract. No new significance tests or trend claims: microdata, design variances and comparison waves are not supplied.',bases='Use each table base. Retain net and constituent response definitions. Do not conflate general concern with household experience.',small_base='Do not report percentages for unweighted bases below 50.',causality='Cross-sectional associations and attitudes do not identify effects.'),scope='Nine preselected whole-sample question tables; inference is limited to this slice. This is a published-data transfer check, not an unseen holdout or raw-preparation test.'))
    (package/'questionnaire.md').write_text('# Published question wording\n\n'+'\n\n'.join(f"## {k}\n\n{v['question']}\n\nBase: all respondents; weighted percentages.\n\nResponses: "+'; '.join(r['response'] for r in v['rows']) for k,v in tables.items()))
    write(package/'codebook.json',dict(source='Published labels retained verbatim; no respondent-level codes supplied.',percent_unit='0–100',rounding='Published percentages and counts are independently rounded.',net_rows='Net rows combine constituent categories and must not be added to those categories.'))
    (PROJECT/'reference').mkdir(exist_ok=True)
    refs=[
      ('R_CONCERNS','mandatory','Food prices lead these general concerns at 87.20%, followed by ultra-processed food at 77.84%; concern is not evidence of measured harm.',['Q12_8','Q12_14']),
      ('R_HOUSEHOLD','mandatory','Household affordability worry is 20.89% and availability worry 18.64%; distinguish these from general food-price concern.',['Q3m','Q2m','Q12_8']),
      ('R_CONFIDENCE','mandatory','Overall supply-chain confidence is 63.08%, while confidence in affordable options is 43.77% versus food safety 74.34%. This identifies an affordability weakness without a causal claim.',['Q13','Q14_3','Q14_1']),
      ('R_TRUST','secondary','Whole-sample FSA trust is 52.67%; 54.02% know a lot or a little about FSA. This extract does not provide trust among that knowledgeable subset.',['Q16','Q14a']),
      ('R_TREND','do_not_elevate','One month cannot establish improvement or worsening.',['Q3m']),
      ('R_POPULATION','context','Findings describe the weighted online quota sample in England, Wales and Northern Ireland, not all UK adults or a probability sample.',['Q2m'])]
    write(PROJECT/'reference/reference_findings.json',dict(study_id=PROJECT.name,version='1.0.0',findings=[dict(finding_id=id,tier=tier,proposition=p,evidence_ids=['tables.'+k for k in keys],topic_cluster=id,claim_strength='descriptive',analytical_relationship='published_table_comparison') for id,tier,p,keys in refs]))
    write(PROJECT/'reference/extraction_checks.json',dict(status='PASS',checks=checks,method='Reconcile published weighted count/base to percentage with 0.006pp tolerance for independent rounding.'))
    write(PROJECT/'data_card.json',dict(source=URL,catalog=CATALOG,methodology=METHOD,retrieved='2026-09-21',source_sha256=sha(source),license_catalog='Open Government Licence v3',license_url='https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/',attribution='Food Standards Agency / YouGov, Consumer Insights Tracker, March 2025',allowed_use_in_this_project='Internal evaluation of published aggregate facts; no model training.',redistribution='Original workbook retained locally and excluded from git. The catalogue links OGL v3; workbook background also contains a publisher approval notice. No broader redistribution/training right is asserted.',respondent_data=False,split='transfer evaluation; publicly reported case, contamination cannot be ruled out'))
    (PROJECT/'.gitignore').write_text('source/\n')
    write(PROJECT/'manifest.json',dict(project_id=PROJECT.name,version='1.0.0',status='data_reference_frozen',presentation_in_scope=False,synthetic=False))
    files=list(package.iterdir())+list((PROJECT/'reference').iterdir())+[PROJECT/'manifest.json',PROJECT/'data_card.json',Path(__file__)]
    write(PROJECT/'freeze.json',dict(study_id=PROJECT.name,version='1.0.0',status='FROZEN',artifacts={p.relative_to(REPO).as_posix():sha(p) for p in files},model_allowlist={p.name:sha(p) for p in package.iterdir()}))
    print(json.dumps(dict(study_id=PROJECT.name,tables=len(tables),checks=len(checks),status='FROZEN')))


if __name__=='__main__':main()

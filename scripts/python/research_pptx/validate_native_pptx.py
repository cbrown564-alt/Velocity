"""Validate the E6 native-chart invariant in a generated PPTX."""
from __future__ import annotations
import argparse, json, zipfile
from pathlib import Path
from lxml import etree

NS={
 'p':'http://schemas.openxmlformats.org/presentationml/2006/main',
 'a':'http://schemas.openxmlformats.org/drawingml/2006/main',
 'c':'http://schemas.openxmlformats.org/drawingml/2006/chart',
 'r':'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
 'pr':'http://schemas.openxmlformats.org/package/2006/relationships'
}

def validate(path: Path):
    result={'file':str(path),'slides':[],'nativeChartCount':0,'embeddedWorkbookCount':0,'failures':[]}
    with zipfile.ZipFile(path) as z:
        names=set(z.namelist())
        slides=sorted(n for n in names if n.startswith('ppt/slides/slide') and n.endswith('.xml'))
        embeddings=[n for n in names if n.startswith('ppt/embeddings/')]
        result['embeddedWorkbookCount']=len(embeddings)
        for slide_path in slides:
            root=etree.fromstring(z.read(slide_path)); refs=root.xpath('.//c:chart/@r:id',namespaces=NS)
            idx=int(slide_path.split('slide')[2].split('.xml')[0])
            result['slides'].append({'slide':idx,'nativeCharts':len(refs)})
            result['nativeChartCount']+=len(refs)
        # For each chart, require an externalData relationship to an embedded workbook.
        charts=sorted(n for n in names if n.startswith('ppt/charts/chart') and n.endswith('.xml'))
        for cp in charts:
            root=etree.fromstring(z.read(cp)); ext=root.xpath('.//c:externalData/@r:id',namespaces=NS)
            relp='ppt/charts/_rels/'+Path(cp).name+'.rels'
            if not ext:
                result['failures'].append(f'{cp}: missing externalData embedded-workbook reference')
                continue
            if relp not in names:
                result['failures'].append(f'{cp}: missing relationships file')
                continue
            relroot=etree.fromstring(z.read(relp)); targets={x.get('Id'):x.get('Target') for x in relroot}
            if not any('embeddings/' in (targets.get(rid) or '') for rid in ext):
                result['failures'].append(f'{cp}: externalData does not resolve to ppt/embeddings')
    result['status']='PASS' if not result['failures'] else 'FAIL'
    return result

if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('pptx',type=Path);ap.add_argument('--json-out',type=Path);args=ap.parse_args()
    out=validate(args.pptx);text=json.dumps(out,indent=2);print(text)
    if args.json_out:args.json_out.write_text(text)
    raise SystemExit(0 if out['status']=='PASS' else 1)

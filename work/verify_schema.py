import json,re,collections,hashlib,zipfile,posixpath
import xml.etree.ElementTree as E
from pathlib import Path
ROOT=Path(r'C:\Users\cobei\Desktop\brenda'); audit=json.loads((ROOT/'work/excel-audit.json').read_text(encoding='utf8')); schema=json.loads((ROOT/'public/data/schema.json').read_text(encoding='utf8'))
issues=[]; mapped=collections.defaultdict(set)
for s in schema['sections']:
 for r in s['rows']:
  for fid,m in r['fields'].items():
   if m['outputRef'] in mapped[s['sheet']]: issues.append(f"Duplicate mapping {s['sheet']} {m['outputRef']}")
   mapped[s['sheet']].add(m['outputRef'])
for role in ['input','output']:
 for s in audit[role]['sheets']:
  formulas={c['ref'] for c in s['formulas']}
  overlap=formulas&mapped[s['name']]
  if overlap: issues.append(f'{role} formula capture {s["name"]} {overlap}')
unmapped=[]; captured=collections.defaultdict(int); blanks=collections.defaultdict(int)
for d in audit['outputDemoDifferences']:
 for c in d['changes']:
  if c['to'] in ['',None]: blanks[d['sheet']]+=1; continue
  if c['ref'] not in mapped[d['sheet']]: unmapped.append({'sheet':d['sheet'],**c})
  else: captured[d['sheet']]+=1
report={'issues':issues,'unmappedDemoChanges':unmapped,'capturedDemoCells':dict(captured),'blankDemoChangesIgnored':dict(blanks),'mappedCells':sum(len(c) for c in mapped.values())}
(ROOT/'work/schema-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps(report,ensure_ascii=False,indent=2))
# Source sheets carry all charts in ZIP, some drawing targets are absolute.
for role in ['input','output','demo']:
 p=Path(r'C:\Users\cobei\Downloads')/audit[role]['filename']; z=zipfile.ZipFile(p)
 def resolved(base,target): return target.lstrip('/') if target.startswith('/') else posixpath.normpath(posixpath.join(posixpath.dirname(base),target))
 for s in audit[role]['sheets']:
  sp=s['part']; sr=posixpath.join(posixpath.dirname(sp),'_rels',posixpath.basename(sp)+'.rels'); charts=[]
  if sr in z.namelist():
   for r in E.fromstring(z.read(sr)):
    if not r.attrib.get('Type','').endswith('/drawing'): continue
    dr=resolved(sp,r.attrib['Target']); drrel=posixpath.join(posixpath.dirname(dr),'_rels',posixpath.basename(dr)+'.rels')
    if drrel in z.namelist():
     for cr in E.fromstring(z.read(drrel)):
      if not cr.attrib.get('Type','').endswith('/chart'): continue
      cp=resolved(dr,cr.attrib['Target']); chart=E.fromstring(z.read(cp)); charts.append({'part':cp,'references':[el.text for el in chart.iter() if el.tag.endswith('}f')]})
  s['charts']=charts
  # Keep captured blanks for representative style evidence, not every formatting-only cell.
  sample={m['inputRef'] for sec in schema['sections'] if sec['sheet']==s['name'] for row in sec['rows'][:2] for m in row['fields'].values()}
  s['cells']=[c for c in s['cells'] if c['value'] is not None or c['kind']=='f' or c['ref'] in sample]
  groups=[]
  for dim in s['rowDimensions']:
   row=int(dim['r']); data={k:v for k,v in dim.items() if k!='r'}
   if groups and groups[-1]['end']==row-1 and groups[-1]['properties']==data: groups[-1]['end']=row
   else: groups.append({'start':row,'end':row,'properties':data})
  s['rowDimensionRuns']=groups; del s['rowDimensions']
  if s['dimension'] is None:
   rows=[int(re.search(r'\d+',c['ref']).group()) for c in s['cells']]
   s['observedMaxContentRow']=max(rows,default=0)
 audit[role]['formulaCount']=sum(len(s['formulas']) for s in audit[role]['sheets'])
 audit[role]['chartCount']=sum(len(s['charts']) for s in audit[role]['sheets'])
 audit[role]['sourceHashVerified']=hashlib.sha256(p.read_bytes()).hexdigest()==audit[role]['sha256']
audit['schemaVerification']=report
(ROOT/'work/excel-audit.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2),encoding='utf8')
print('Audit bytes',len((ROOT/'work/excel-audit.json').read_bytes()))

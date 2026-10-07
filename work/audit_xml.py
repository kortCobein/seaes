import json,re,hashlib,zipfile,collections,posixpath
import xml.etree.ElementTree as E
from pathlib import Path
BASE=Path(r'C:\Users\cobei\Downloads'); OUT=Path(r'C:\Users\cobei\Desktop\brenda\work')
FILES={'input':next(BASE.glob('SEAES - CAI 2026*.xlsx')),'output':BASE/'SEAES_UTSJR_PLANTILLA_REAL.xlsx','demo':BASE/'SEAES_UTSJR_FICTICIO_ENTREGABLE.xlsx'}
def textof(elem): return ''.join(elem.itertext()) if elem is not None else ''
def parse(path):
 z=zipfile.ZipFile(path); styles=E.fromstring(z.read('xl/styles.xml')); workbook=E.fromstring(z.read('xl/workbook.xml'))
 strings=[textof(e) for e in E.fromstring(z.read('xl/sharedStrings.xml'))] if 'xl/sharedStrings.xml' in z.namelist() else []
 sstyles=[]
 for i,s in enumerate(styles.find('{*}cellXfs')):
  prot=s.find('{*}protection'); fill=styles.find('{*}fills')[int(s.attrib.get('fillId','0'))]
  sstyles.append({'id':i,**s.attrib,'protection':prot.attrib if prot is not None else {'locked':'1'},'fill':E.tostring(fill,encoding='unicode')})
 rels={r.attrib['Id']:posixpath.normpath('xl/'+r.attrib['Target'].lstrip('/')) if not r.attrib['Target'].startswith('/') else r.attrib['Target'].lstrip('/') for r in E.fromstring(z.read('xl/_rels/workbook.xml.rels'))}
 book={'filename':path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'sheetOrder':[],'styles':sstyles,'sheets':[],'zipEntries':z.namelist(),'definedNames':[]}
 for dn in workbook.findall('{*}definedNames/{*}definedName'): book['definedNames'].append({**dn.attrib,'value':dn.text})
 for sheet in workbook.find('{*}sheets'):
  name=sheet.attrib['name']; rid=sheet.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']; part=rels[rid]; xml=E.fromstring(z.read(part)); cells=[]; formulas=[]; counts=collections.Counter(); unlocked=collections.Counter()
  for c in xml.findall('{*}sheetData/{*}row/{*}c'):
   ref=c.attrib['r']; sid=int(c.attrib.get('s',0)); counts[sid]+=1; kind=c.attrib.get('t','n'); v=c.find('{*}v'); f=c.find('{*}f'); val=None
   if kind=='s' and v is not None: val=strings[int(v.text)]
   elif kind=='inlineStr': val=textof(c.find('{*}is'))
   elif v is not None:
    val=v.text
    if kind=='n':
     try: val=float(val); val=int(val) if val.is_integer() else val
     except (TypeError,ValueError): pass
   locked=sstyles[sid]['protection'].get('locked','1')!='0'
   if not locked: unlocked[sid]+=1
   if f is not None: formulas.append({'ref':ref,'formula':f.text,'formulaAttributes':f.attrib,'cachedValue':val}); kind='f'
   row=int(re.search(r'\d+',ref).group())
   if val is not None or f is not None or row<=100: cells.append({'ref':ref,'value':val,'style':sid,'kind':kind,'locked':locked})
  validations=[{**d.attrib,'formula1':textof(d.find('{*}formula1')),'formula2':textof(d.find('{*}formula2'))} for d in xml.findall('{*}dataValidations/{*}dataValidation')]
  charts=[]; relpart=posixpath.join(posixpath.dirname(part),'_rels',posixpath.basename(part)+'.rels')
  if relpart in z.namelist():
   shrels=E.fromstring(z.read(relpart))
   for r in shrels:
    if r.attrib.get('Type','').endswith('/drawing'):
     drawing=posixpath.normpath(posixpath.join(posixpath.dirname(part),r.attrib['Target'])); drrel=posixpath.join(posixpath.dirname(drawing),'_rels',posixpath.basename(drawing)+'.rels')
     if drrel in z.namelist():
      for cr in E.fromstring(z.read(drrel)):
       if cr.attrib.get('Type','').endswith('/chart'):
        cp=posixpath.normpath(posixpath.join(posixpath.dirname(drawing),cr.attrib['Target'])); chart=E.fromstring(z.read(cp)); charts.append({'part':cp,'references':[el.text for el in chart.iter() if el.tag.endswith('}f')]})
  book['sheetOrder'].append(name)
  book['sheets'].append({'name':name,'state':sheet.attrib.get('state','visible'),'part':part,'dimension':(xml.find('{*}dimension').attrib.get('ref') if xml.find('{*}dimension') is not None else None),'protection':xml.find('{*}sheetProtection').attrib if xml.find('{*}sheetProtection') is not None else None,'merged':[e.attrib['ref'] for e in xml.findall('{*}mergeCells/{*}mergeCell')],'validations':validations,'formulas':formulas,'charts':charts,'cells':cells,'stylesUsed':counts,'unlockedStyles':unlocked,'totalCells':sum(counts.values()),'unlockedCount':sum(unlocked.values()),'rowDimensions':[e.attrib for e in xml.findall('{*}sheetData/{*}row') if e.attrib.get('customHeight')],'columnDimensions':[e.attrib for e in xml.findall('{*}cols/{*}col')],'autoFilter':xml.find('{*}autoFilter').attrib if xml.find('{*}autoFilter') is not None else None,'pageSetup':xml.find('{*}pageSetup').attrib if xml.find('{*}pageSetup') is not None else None})
 return book
result={}
for role,p in FILES.items(): result[role]=parse(p); print(role,len(result[role]['sheets']),'sheets',flush=True)
diffs=[]
for s in result['output']['sheets']:
 d=next(v for v in result['demo']['sheets'] if v['name']==s['name']); a={c['ref']:c for c in s['cells'] if c['value'] is not None and c['kind']!='f'}; b={c['ref']:c for c in d['cells'] if c['value'] is not None and c['kind']!='f'}
 changes=[]
 for ref in a.keys()|b.keys():
  av=a.get(ref,{}).get('value'); bv=b.get(ref,{}).get('value')
  if av!=bv: changes.append({'ref':ref,'from':av,'to':bv,'style':a.get(ref,b.get(ref))['style']})
 diffs.append({'sheet':s['name'],'changes':changes})
result['outputDemoDifferences']=diffs
(OUT/'excel-audit.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
for role in FILES:
 print('\n'+role.upper())
 for s in result[role]['sheets']: print(s['name'],s['dimension'],'unlocked',s['unlockedCount'],'formulas',len(s['formulas']),'validations',len(s['validations']),'charts',len(s['charts']),'changes',len(next(d['changes'] for d in diffs if d['sheet']==s['name'])))


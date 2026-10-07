import json,re,unicodedata
from pathlib import Path
ROOT=Path(r'C:\Users\cobei\Desktop\brenda')
a=json.loads((ROOT/'work/excel-audit.json').read_text(encoding='utf8'))
books={role:{s['name']:s for s in a[role]['sheets']} for role in ['input','output','demo']}
maps={role:{s['name']:{c['ref']:c for c in s['cells']} for s in a[role]['sheets']} for role in books}
def val(role,sheet,ref): return maps[role][sheet].get(ref,{}).get('value')
def col(n):
 s=''
 while n: n,k=divmod(n-1,26); s=chr(65+k)+s
 return s
def slug(s): return re.sub(r'[^a-z0-9]+','-',unicodedata.normalize('NFD',s).encode('ascii','ignore').decode().lower()).strip('-')
def norm(s): return re.sub(r'\s+',' ',str(s or '')).strip()
def mapping(sheet,ref): return {'inputRef':ref,'outputRef':ref,'inputBaseline':val('input',sheet,ref),'outputBaseline':val('output',sheet,ref)}
CRITERIA=[('responsabilidad','Compromiso con la responsabilidad social'),('equidad','Equidad social y de género'),('inclusion','Inclusión'),('excelencia','Excelencia'),('vanguardia','Vanguardia'),('innovacion','Innovación social'),('interculturalidad','Interculturalidad')]
schema={'version':'CAI-2026-V5F-UTSJR-1','inputFile':a['input']['filename'],'outputFile':a['output']['filename'],'demoFile':a['demo']['filename'],'criteria':[{'id':id,'label':label} for id,label in CRITERIA],'sections':[],'referenceSheets':[],'indicators':[]}
for n in range(1,21):
 sheet='Indicador '+str(n)
 schema['indicators'].append({'id':n,'label':norm(val('input','Indicaciones y definiciones',f'B{n+4}')),'period':norm(val('input','Indicaciones y definiciones',f'E{n+4}')),'description':norm(val('input','Indicaciones y definiciones',f'D{n+4}'))})
# (indicator, block suffix, header, first, last, last numeric column, subheader)
BLOCKS=[(1,'a',7,8,12,12,False),(2,'a',7,8,12,12,False),(3,'a',7,9,13,26,True),(4,'a',6,7,11,12,False),(5,'a',5,7,7,12,True),(6,'a',7,8,8,12,False),(7,'a',7,8,8,12,False),(8,'a',5,7,11,12,True),(9,'a1',5,6,10,12,False),(9,'a2',22,24,28,26,True),(9,'a3',40,42,46,19,True),(9,'a4',58,60,64,19,True),(10,'a',5,6,10,12,False),(11,'a',7,8,12,12,False),(12,'a',6,7,11,12,False),(13,'a',7,8,8,12,False),(14,'a',7,8,8,12,False),(15,'a',5,6,6,12,False),(16,'a',4,5,9,12,False),(17,'a',5,7,8,12,True),(18,'a',7,8,11,12,False),(19,'a',7,8,8,12,False),(20,'a',6,7,7,12,False)]
for n,block,head,start,end,last,sub in BLOCKS:
 sheet=f'Indicador {n}'; s=books['input'][sheet]; fields=[]
 title=norm(val('input',sheet,f'A{head-1}'))
 sec={'id':f'ind-{n}-{block}','sheet':sheet,'label':title,'indicators':[n],'kind':'quantitative','fields':fields,'rows':[],'anchors':[{'ref':f'A{head-1}','value':title},{'ref':f'D{head}','value':str(val('input',sheet,f'D{head}'))},{'ref':f'E{head}','value':str(val('input',sheet,f'E{head}'))}]}
 parent=''
 for c in range(5,last+1):
  header=val('input',sheet,f'{col(c)}{head}')
  if header is not None: parent=norm(header)
  subtext=norm(val('input',sheet,f'{col(c)}{head+1}')) if sub and c>=6 else ''
  label=parent+(' · '+subtext if subtext else '')
  fld={'id':col(c).lower(),'label':label,'type':'number'}
  if n==9 and block!='a1': fld['criterion']={'a2':'equidad','a3':'inclusion','a4':'interculturalidad'}[block] if c>=6 else None
  elif n in [5,8,17] and c>=6: fld['criterion']='equidad' if c<=8 else 'inclusion' if c<=10 else 'interculturalidad'
  elif n==3 and c>=6: fld['criterion']=CRITERIA[(c-6)//3][0]
  elif n!=9 and c>=6: fld['criterion']=CRITERIA[c-6][0]
  if fld.get('criterion') is None: fld.pop('criterion',None)
  fields.append(fld)
 fields.append({'id':'comentarios','label':'Comentarios','type':'text'})
 for r in range(start,end+1):
  row={'id':slug(norm(val('input',sheet,f'D{r}'))),'label':norm(val('input',sheet,f'D{r}')),'fields':{f['id']:mapping(sheet,f'{col(5+i)}{r}') for i,f in enumerate(fields[:-1])}}
  row['fields']['comentarios']=mapping(sheet,f'{col(last+1)}{r}'); sec['rows'].append(row)
 schema['sections'].append(sec)
# Identity in both count and percentage tables, preserving merged period once.
for n in range(1,21):
 sheet=f'Indicador {n}'; s=books['input'][sheet]
 anchors=next(x['anchors'] for x in schema['sections'] if x['sheet']==sheet)
 sec={'id':f'identity-{n}','sheet':sheet,'label':f'Identificación y periodos · Indicador {n}','indicators':[n],'kind':'identity','fields':[{'id':'entidad','label':'Entidad','type':'text'},{'id':'institucion','label':'Institución','type':'text'},{'id':'periodo','label':'Periodo / cohorte','type':'text'}],'rows':[],'anchors':anchors}
 # D identifies actual table data rows. Exclude header, title, guide, graph labels.
 for c in s['cells']:
  if not re.match(r'^D\d+$',c['ref']) or c['value'] is None: continue
  r=int(c['ref'][1:]); label=norm(c['value'])
  if r<5 or label in ['Nivel educativo','Planta académica','Planta docente','Población escolar','Investigación','Personal de la institución','Iniciativas institucionales','Planes y programas']: continue
  if not any((val('input',sheet,f'E{r}') is not None, f'E{r}' in maps['input'][sheet])): continue
  # all matching rows bounded by last table, not graph cached labels
  lastrow=max(int(re.search(r'\d+',f['ref']).group()) for f in s['formulas']) if s['formulas'] else max(b[4] for b in BLOCKS if b[0]==n)
  if r>lastrow: continue
  data={}
  for fid,cc in [('entidad','A'),('institucion','B'),('periodo','C')]:
   ref=f'{cc}{r}'; mergedChild=False
   for merge in s['merged']:
    lo,hi=merge.split(':'); lc=int(re.search(r'\d+',lo).group()); hc=int(re.search(r'\d+',hi).group())
    if lo.startswith(cc) and hi.startswith(cc) and lc<=r<=hc and ref!=lo: mergedChild=True
   if not mergedChild: data[fid]=mapping(sheet,ref)
  sec['rows'].append({'id':f'fila-{r}','label':f'{label} · '+('porcentajes' if maps['input'][sheet].get(f'E{r}',{}).get('kind')=='f' else 'cantidades'),'fields':data})
 schema['sections'].append(sec)
ANNEX=[('Anexo inds 1 a 4 y 11',[1,2,3,4,11],4,3,['Programa educativo o referente','Rasgo del perfil de egreso'],3),('Anexo ind 6',[6],5,4,['Alcance institucional / unidad académica','Programa educativo / ámbito / lugar','Acción de profesionalización'],4),('Anexo inds 7 y 12',[7,12],4,3,['Alcance institucional / programa','Tipo de innovación','Proyecto de innovación'],4),('Anexo ind 13',[13],5,3,['Programa / unidad / institución','Proyecto de investigación'],3),('Anexo ind 14',[14],5,3,['Programa / unidad / institución','Producto de investigación'],3),('Anexo ind 18',[18],6,4,['Tipo de acción institucional','Iniciativa, servicio o acción'],3),('Anexo ind 19',[19],5,3,['Plan / programa / nivel','Acción prevista'],3),('Anexo ind 20',[20],5,3,['Programa / unidad / institución','Acción realizada o en proceso'],3)]
for sheet,inds,start,criterow,labels,critcol in ANNEX:
 sec={'id':'anexo-'+ '-'.join(map(str,inds)),'sheet':sheet,'label':{'Anexo inds 1 a 4 y 11':'Rasgos del perfil de egreso','Anexo ind 6':'Profesionalización docente','Anexo inds 7 y 12':'Proyectos de innovación','Anexo ind 13':'Proyectos de investigación','Anexo ind 14':'Productos de investigación','Anexo ind 18':'Iniciativas institucionales','Anexo ind 19':'Acciones previstas','Anexo ind 20':'Acciones de sensibilización'}[sheet],'indicators':inds,'kind':'annex','fields':[],'rows':[],'anchors':[{'ref':'A1','value':norm(val('input',sheet,'A1'))},{'ref':f'{col(critcol)}{criterow}','value':str(val('input',sheet,f'{col(critcol)}{criterow}'))}]}
 for i,label in enumerate(labels):
  fid=['alcance','descripcion'][i] if len(labels)==2 else ['alcance','tipo','descripcion'][i]
  fld={'id':fid,'label':label,'type':'text'}
  if sheet=='Anexo ind 18' and i==0: fld.update(type='choice',choices=[val('input',sheet,f'L{r}') for r in range(2,6)])
  sec['fields'].append(fld)
 for cid,label in CRITERIA: sec['fields'].append({'id':cid,'label':label,'type':'choice','criterion':cid,'choices':['','X']})
 sec['fields'].append({'id':'observaciones','label':'Observaciones (opcional)','type':'text'})
 for r in range(start,1001):
  sec['rows'].append({'id':f'fila-{r}','label':f'Registro {r-start+1}','fields':{f['id']:mapping(sheet,f'{col(i+1)}{r}') for i,f in enumerate(sec['fields'])}})
 schema['sections'].append(sec)
for s in a['input']['sheets']:
 if not s['name'].startswith(('Indicador ','Anexo ')):
  text='\n\n'.join(norm(c['value']) for c in s['cells'] if isinstance(c['value'],str) and c['kind']!='f' and not c['value'].startswith('Ir a '))
  schema['referenceSheets'].append({'name':s['name'],'text':text})
(ROOT/'public/data').mkdir(parents=True,exist_ok=True)
(ROOT/'public/data/schema.json').write_text(json.dumps(schema,ensure_ascii=False,separators=(',',':')),encoding='utf8')
print('schema',len(schema['sections']),'sections',sum(len(s['rows']) for s in schema['sections']),'rows',len((ROOT/'public/data/schema.json').read_bytes()),'bytes')
print([(s['id'],len(s['rows']),len(s['fields'])) for s in schema['sections']])

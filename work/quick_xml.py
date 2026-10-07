import zipfile,xml.etree.ElementTree as E,pathlib,json
root=pathlib.Path(r'C:\Users\cobei\Downloads')
z=zipfile.ZipFile(next(root.glob('SEAES - CAI 2026*.xlsx')))
ss=[ ''.join(n.itertext()) for n in E.fromstring(z.read('xl/sharedStrings.xml'))]
w=E.fromstring(z.read('xl/workbook.xml'))
lines=[]
for i,s in enumerate(w.find('{*}sheets')):
 if i>=38: continue
 lines.append('\n### '+s.attrib['name'])
 sh=E.fromstring(z.read(f'xl/worksheets/sheet{i+1}.xml'))
 for row in sh.find('{*}sheetData'):
  cells=[]
  for c in row:
   v=c.find('{*}v'); f=c.find('{*}f')
   val=ss[int(v.text)] if v is not None and c.attrib.get('t')=='s' else v.text if v is not None else ''.join(c.find('{*}is').itertext()) if c.find('{*}is') is not None else ''
   if f is not None: val='='+(f.text or '[shared]')
   if val: cells.append(c.attrib['r']+'[s'+c.attrib.get('s','0')+'] '+val.replace('\n',' ')[:600])
  if cells: lines.append(' | '.join(cells))
pathlib.Path(r'C:\Users\cobei\Desktop\brenda\work\input-rows.txt').write_text('\n'.join(lines),encoding='utf-8')
print('\n'.join(lines[:90]))

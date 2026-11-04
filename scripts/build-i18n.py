# Menyisipkan kamus scripts/i18n-en.txt ke web/index.html (antara penanda I18N-EN).
import json,re,io
d={}
for line in io.open('scripts/i18n-en.txt',encoding='utf8'):
    line=line.rstrip('\n')
    if '|' not in line: continue
    k,v=line.split('|',1)
    if k.strip() and v.strip() and k!=v: d[k.strip()]=v.strip()
p='web/index.html'; s=io.open(p,encoding='utf8').read()
blk='/*I18N-EN*/var I18N_EN = '+json.dumps(d,ensure_ascii=False,sort_keys=True)+';/*/I18N-EN*/'
if '/*I18N-EN*/' in s: s=re.sub(r'/\*I18N-EN\*/.*?/\*/I18N-EN\*/',lambda m:blk,s,flags=re.S)
else: s=s.replace('/* ---------------------------- RENDER: PENGUMUMAN','\n'+blk+'\n/* ---------------------------- RENDER: PENGUMUMAN',1)
io.open(p,'w',encoding='utf8').write(s); print(len(d),'entri')

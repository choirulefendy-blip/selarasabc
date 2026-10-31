// Sekali jalan: memasukkan daftar peralatan (List Equipment ABC Group) ke Aset Inventaris
// departemen milik karyawan yang namanya cocok dengan EMP_NAME. Aman diulang (nama yang sama dilewati).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(here, '..', 'web', 'index.html'), 'utf8');
const pick = (n) => { const m = new RegExp("var " + n + " = '([^']*)'").exec(html); return m ? m[1] : ''; };
const URL = pick('SUPABASE_URL'), KEY = pick('SUPABASE_ANON_KEY');
const DRY = process.env.DRY === 'true';
const NAME = new RegExp(process.env.EMP_NAME || 'choirul efendi', 'i');
const rows = JSON.parse(fs.readFileSync(path.join(here, 'data', 'aset-marketing.json'), 'utf8'));
const h = { apikey: KEY, Authorization: 'Bearer ' + KEY };
const r = await fetch(URL + '/rest/v1/kv_store?key=eq.hrdb&select=value', { headers: h });
if (!r.ok) throw new Error('HTTP ' + r.status);
const db = JSON.parse((await r.json())[0].value);
const emp = (db.employees || []).find((e) => e.active !== false && NAME.test(e.name || ''));
if (!emp) { console.log('Karyawan tidak ditemukan'); process.exit(1); }
const dept = emp.department;
console.log('Karyawan:', emp.name, '| Departemen:', dept, '| HOD:', Object.keys(db.departmentHods || {}).filter((k) => (db.departmentHods[k] || []).includes(emp.id)).join(', ') || '-');
db.assets = db.assets || [];
const pre = 'AST-' + (String(dept || 'UMUM').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'UMM') + '-';
let n = 0; db.assets.forEach((a) => { if (String(a.code || '').startsWith(pre)) n = Math.max(n, parseInt(a.code.slice(pre.length), 10) || 0); });
const now = new Date().toISOString(); let added = 0, skipped = 0;
for (const x of rows) {
  if (db.assets.some((a) => !a.deleted && a.dept === dept && String(a.name).toLowerCase() === x.name.toLowerCase())) { skipped++; continue; }
  n++;
  db.assets.push({ id: 'AS' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7), code: pre + String(n).padStart(4, '0'), name: x.name, qty: x.qty || 1,
    category: x.category, brand: x.brand || '', model: '', serial: '', dept, property: '', location: '', holderEmpId: emp.id, condition: 'baik', status: 'dipakai',
    purchaseDate: '', price: 0, lifeYears: 0, vendor: '', warrantyUntil: '', nextService: '', notes: 'Dari file List Equipment ABC Group',
    history: [{ at: now, by: 'Impor (List Equipment ABC Group)', type: 'Didaftarkan', text: 'Diimpor ke inventaris ' + dept + '.', cost: 0 }], importBatch: now, createdAt: now, updatedAt: now });
  added++;
}
console.log('Akan ditambah:', added, '| dilewati (sudah ada):', skipped, '| total aset', dept + ':', db.assets.filter((a) => !a.deleted && a.dept === dept).length);
if (DRY || !added) { console.log(DRY ? '[DRY RUN] tidak disimpan' : 'Tidak ada yang perlu disimpan'); process.exit(0); }
const w = await fetch(URL + '/rest/v1/kv_store', { method: 'POST', headers: { ...h, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
  body: JSON.stringify({ key: 'hrdb', value: JSON.stringify(db), updated_at: new Date().toISOString() }) });
if (!w.ok) throw new Error('Gagal simpan HTTP ' + w.status);
console.log('Tersimpan.');

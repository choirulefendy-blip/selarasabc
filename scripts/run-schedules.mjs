// ABC Selaras — menjalankan Notifikasi Terjadwal (dipanggil GitHub Actions tiap ~10 menit).
// Membaca data dari Supabase (tabel kv_store, key "hrdb"), mengirim notifikasi yang jatuh tempo,
// menyimpan kembali, lalu memicu push (FCM / Web Push) lewat Edge Function send-push.
// Kunci yang dipakai = kunci publik (anon) yang sama dengan aplikasi web; tidak perlu secret.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(here, '..', 'web', 'index.html'), 'utf8');
const pick = (name) => { const m = new RegExp("var " + name + " = '([^']*)'").exec(html); return m ? m[1] : ''; };
const SUPABASE_URL = process.env.SUPABASE_URL || pick('SUPABASE_URL');
const ANON = process.env.SUPABASE_ANON_KEY || pick('SUPABASE_ANON_KEY');
const PUSH_URL = process.env.PUSH_FUNCTION_URL || pick('PUSH_FUNCTION_URL');
const DRY = process.argv.includes('--dry');

const NS_WIB = 7 * 3600 * 1000;
const NS_DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
export function nsWib(ms) { const d = new Date(ms + NS_WIB); return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate(), wd: d.getUTCDay(), iso: d.toISOString().slice(0, 10) }; }
export function nsOccMs(y, m, d, hm) { const p = String(hm || '08:00').split(':'); return Date.UTC(y, m, d, +p[0] || 0, +p[1] || 0) - NS_WIB; }
export function nsDueKey(s, nowMs) {
  if (!s || s.deleted || s.active === false) return null;
  const created = Date.parse(s.createdAt || '') || 0;
  if (s.freq === 'once') {
    if (s.lastKey || !s.date) return null;
    const dp = String(s.date).split('-');
    return nowMs >= nsOccMs(+dp[0], (+dp[1]) - 1, +dp[2], s.time) ? s.date : null;
  }
  const w = nsWib(nowMs); let match = false;
  if (s.freq === 'daily') match = true;
  else if (s.freq === 'weekly') match = w.wd === (+s.weekday || 0);
  else if (s.freq === 'monthly') { const dim = new Date(Date.UTC(w.y, w.m + 1, 0)).getUTCDate(); match = w.d === Math.min(+s.monthDay || 1, dim); }
  if (!match) return null;
  const occ = nsOccMs(w.y, w.m, w.d, s.time);
  if (nowMs < occ || occ < created - 60000 || s.lastKey === w.iso) return null;
  return w.iso;
}
function label(s) {
  const t = ' pukul ' + (s.time || '08:00') + ' WIB';
  if (s.freq === 'once') return 'Sekali, ' + s.date + t;
  if (s.freq === 'daily') return 'Setiap hari' + t;
  if (s.freq === 'weekly') return 'Setiap ' + NS_DAYS[+s.weekday || 0] + t;
  return 'Setiap tanggal ' + (s.monthDay || 1) + t;
}
export function recipients(db, target) {
  const emps = (db.employees || []).filter((e) => e.active);
  const hods = db.departmentHods || {};
  const isHod = (id) => Object.keys(hods).some((k) => (hods[k] || []).includes(id));
  if (target === 'all') return emps;
  if (target === 'hod') return emps.filter((e) => isHod(e.id));
  if (target === 'staff') return emps.filter((e) => !isHod(e.id));
  if (target.startsWith('dept:')) return emps.filter((e) => e.department === target.slice(5));
  if (target.startsWith('emp:')) return emps.filter((e) => e.id === target.slice(4));
  return [];
}
function allowed(db, empId) {
  const p = ((db.notifPrefs || {}).emp || {})[empId] || {};
  return p.enabled !== false && p.hrmsg !== false;
}
const uid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export function runDue(db, nowMs) {
  const sent = [];
  for (const s of db.notifSchedules || []) {
    const key = nsDueKey(s, nowMs);
    if (!key) continue;
    const text = 'Pesan HR' + (s.fromName ? ' (' + s.fromName + ')' : '') + ': ' + s.message;
    const to = recipients(db, s.target).filter((e) => allowed(db, e.id));
    const now = new Date(nowMs).toISOString();
    db.notifications = db.notifications || [];
    for (const e of to) {
      db.notifications.unshift({ id: uid('N'), audience: { type: 'emp', empId: e.id }, message: text, link: s.link || null, createdAt: now, read: false });
      sent.push({ empId: e.id, text, link: s.link || '' });
    }
    db.notifications = db.notifications.slice(0, 200);
    s.lastKey = key; s.lastRunAt = now; s.sentCount = (s.sentCount || 0) + 1; s.updatedAt = now;
    if (s.freq === 'once') s.active = false;
    db.notifBroadcasts = db.notifBroadcasts || [];
    db.notifBroadcasts.unshift({ id: uid('NB'), target: s.target, targetLabel: s.target, message: s.message, link: s.link, count: to.length, by: 'Jadwal: ' + label(s), createdAt: now });
    db.notifBroadcasts = db.notifBroadcasts.slice(0, 100);
    console.log('Terkirim: ' + label(s) + ' -> ' + to.length + ' orang');
  }
  return sent;
}

async function main() {
  if (!SUPABASE_URL || !ANON) { console.log('Supabase belum diatur; lewati.'); return; }
  const h = { apikey: ANON, Authorization: 'Bearer ' + ANON };
  const r = await fetch(SUPABASE_URL + '/rest/v1/kv_store?key=eq.hrdb&select=value', { headers: h });
  if (!r.ok) throw new Error('Gagal membaca data: HTTP ' + r.status);
  const rows = await r.json();
  if (!rows.length || !rows[0].value) { console.log('Data kosong.'); return; }
  const db = JSON.parse(rows[0].value);
  const sent = runDue(db, Date.now());
  if (!sent.length) { console.log('Tidak ada jadwal yang jatuh tempo.'); return; }
  if (DRY) { console.log('[dry] ' + sent.length + ' notifikasi'); return; }
  const w = await fetch(SUPABASE_URL + '/rest/v1/kv_store', {
    method: 'POST',
    headers: { ...h, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ key: 'hrdb', value: JSON.stringify(db), updated_at: new Date().toISOString() }),
  });
  if (!w.ok) throw new Error('Gagal menyimpan: HTTP ' + w.status);
  if (PUSH_URL) {
    for (const x of sent) {
      try {
        await fetch(PUSH_URL, { method: 'POST', headers: { ...h, 'Content-Type': 'application/json' }, body: JSON.stringify({ recipient: x.empId, title: 'ABC Selaras', body: x.text, url: x.link ? '#' + x.link : '#' }) });
      } catch (e) { console.log('push gagal untuk ' + x.empId); }
    }
  }
  console.log('Selesai: ' + sent.length + ' notifikasi.');
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}

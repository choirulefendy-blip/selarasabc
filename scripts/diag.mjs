import fs from 'node:fs';
const html = fs.readFileSync('web/index.html', 'utf8');
const pick = (n) => { const m = new RegExp("var " + n + " = '([^']*)'").exec(html); return m ? m[1] : ''; };
const URL = pick('SUPABASE_URL'), KEY = pick('SUPABASE_ANON_KEY');
const h = { apikey: KEY, Authorization: 'Bearer ' + KEY, Origin: 'https://localhost' };
async function t(label, url, opt) {
  const s = Date.now();
  try {
    const r = await fetch(url, { headers: h, ...(opt || {}) });
    const b = await r.text();
    console.log(`::notice::${label}: HTTP ${r.status} ${Date.now() - s}ms ${b.length} byte acao=${r.headers.get('access-control-allow-origin')} ${r.ok ? '' : b.slice(0, 200)}`);
    return b;
  } catch (e) { console.log(`::error::${label}: ${e.message} ${Date.now() - s}ms`); }
}
await t('stamp', URL + '/rest/v1/kv_store?key=eq.hrdb&select=updated_at');
const b = await t('hrdb', URL + '/rest/v1/kv_store?key=eq.hrdb&select=value');
try { const v = JSON.parse(JSON.parse(b)[0].value); console.log('::notice::keys ' + Object.keys(v).map((k) => k + ':' + JSON.stringify(v[k]).length).sort((a, c) => +c.split(':')[1] - +a.split(':')[1]).slice(0, 12).join(' ')); } catch (e) { console.log('::error::parse ' + e.message); }
await t('preflight', URL + '/rest/v1/kv_store?key=eq.hrdb&select=value', { method: 'OPTIONS', headers: { Origin: 'https://localhost', 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'apikey,authorization' } });

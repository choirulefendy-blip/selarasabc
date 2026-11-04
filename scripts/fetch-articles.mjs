// Ambil artikel terbaru dari https://abchospitality.co.id/article/ lalu simpan ke Supabase (kv_store key "articles").
// Dijalankan GitHub Action bersama notifikasi terjadwal. Aplikasi membaca key "articles" untuk dashboard & halaman Artikel.
//   node scripts/fetch-articles.mjs          -> ambil & simpan
//   node scripts/fetch-articles.mjs --dry    -> ambil & tampilkan saja
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const html0 = fs.readFileSync(path.join(here, '..', 'web', 'index.html'), 'utf8');
const pick = (name) => { const m = new RegExp("var " + name + " = '([^']*)'").exec(html0); return m ? m[1] : ''; };
const SUPABASE_URL = process.env.SUPABASE_URL || pick('SUPABASE_URL');
const ANON = process.env.SUPABASE_ANON_KEY || pick('SUPABASE_ANON_KEY');
const DRY = process.argv.includes('--dry');
const SITE = 'https://abchospitality.co.id';
const INDEX = SITE + '/article/';
const MAX = 12;
const UA = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8',
};
/* kunci rahasia untuk aturan Cloudflare "Skip" (diatur admin situs), dari GitHub Secret ARTICLE_FETCH_KEY */
if (process.env.ARTICLE_FETCH_KEY) UA['X-ABC-Selaras-Key'] = process.env.ARTICLE_FETCH_KEY;

const decode = (s) => String(s || '')
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
  .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ').trim();
const abs = (u) => { if (!u) return ''; try { return new URL(decode(u), INDEX).href; } catch { return ''; } };

export function meta(html, keys) {
  for (const k of keys) {
    const re1 = new RegExp('<meta[^>]+(?:property|name|itemprop)=["\']' + k + '["\'][^>]*content=["\']([^"\']*)["\']', 'i');
    const re2 = new RegExp('<meta[^>]+content=["\']([^"\']*)["\'][^>]*(?:property|name|itemprop)=["\']' + k + '["\']', 'i');
    const m = re1.exec(html) || re2.exec(html);
    if (m && m[1].trim()) return decode(m[1]);
  }
  return '';
}

/* daftar link artikel dari halaman indeks (urutan = urutan di halaman = terbaru dulu) */
export function parseIndex(html) {
  const out = [], seen = new Set();
  const re = /<a\b([^>]*)href=["']((?:https?:\/\/(?:www\.)?abchospitality\.co\.id)?\/article\/([a-z0-9][a-z0-9-]*)\/?)["']([^>]*)>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const slug = m[3], url = INDEX + slug + '/';
    const attrs = m[1] + ' ' + m[4], inner = m[5];
    const t = /title=["']([^"']+)["']/i.exec(attrs);
    const img = /<img[^>]+(?:data-src|src)=["']([^"']+)["']/i.exec(inner) || /url\((['"]?)([^'")]+)\1\)/i.exec(inner);
    let item = out.find((x) => x.url === url);
    if (!item) { if (seen.has(url)) continue; seen.add(url); item = { url, slug, title: '', image: '' }; out.push(item); }
    if (!item.title) item.title = decode(t ? t[1] : inner.replace(/<[^>]+>/g, ''));
    if (!item.image && img) item.image = abs(img[2] || img[1]);
  }
  return out;
}

const MON = { jan: 0, feb: 1, mar: 2, apr: 3, mei: 4, may: 4, jun: 5, jul: 6, agu: 7, aug: 7, agt: 7, sep: 8, okt: 9, oct: 9, nov: 10, des: 11, dec: 11 };
export function parseDateText(s) {
  const m = /(\d{1,2})\s+(Jan|Feb|Mar|Apr|Mei|May|Jun|Jul|Agu|Agt|Aug|Sep|Okt|Oct|Nov|Des|Dec)[a-z]*\.?\s+(20\d\d)/i.exec(s || '');
  if (!m) return '';
  const d = new Date(Date.UTC(+m[3], MON[m[2].slice(0, 3).toLowerCase()], +m[1], 5));
  return isNaN(d) ? '' : d.toISOString();
}

export function parseArticle(html) {
  const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ');
  const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
  let date = meta(html, ['article:published_time', 'og:article:published_time', 'datePublished', 'date']);
  if (!date) { const j = /"datePublished"\s*:\s*"([^"]+)"/.exec(html); if (j) date = j[1]; }
  if (!date) date = parseDateText(text);
  let image = meta(html, ['og:image', 'og:image:url', 'twitter:image', 'twitter:image:src']);
  if (!image) { const i = /<(?:article|main)[\s\S]*?<img[^>]+(?:data-src|src)=["']([^"']+\.(?:jpe?g|png|webp)[^"']*)["']/i.exec(html); if (i) image = i[1]; }
  let title = meta(html, ['og:title', 'twitter:title']) || decode(h1 ? h1[1].replace(/<[^>]+>/g, '') : '');
  title = title.replace(/\s*[|\-–]\s*ABC Hospitality.*$/i, '');
  const excerpt = (meta(html, ['og:description', 'description', 'twitter:description']) || '').slice(0, 220);
  return { title, image: abs(image), date, excerpt };
}

async function get(url) {
  const r = await fetch(url, { headers: UA, redirect: 'follow', signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + url + ' [server=' + (r.headers.get('server') || '-') + ' cf=' + (r.headers.get('cf-ray') ? 'ya' : 'tidak') + ' cf-mitigated=' + (r.headers.get('cf-mitigated') || '-') + ']');
  return r.text();
}

async function main() {
  const h = { apikey: ANON, Authorization: 'Bearer ' + ANON };
  let old = { items: [] };
  if (SUPABASE_URL && ANON) {
    try {
      const r = await fetch(SUPABASE_URL + '/rest/v1/kv_store?key=eq.articles&select=value', { headers: h });
      const rows = r.ok ? await r.json() : [];
      if (rows[0] && rows[0].value) old = JSON.parse(rows[0].value);
    } catch { /* abaikan */ }
  }
  const known = new Map((old.items || []).map((x) => [x.url, x]));
  const list = parseIndex(await get(INDEX)).slice(0, MAX);
  if (!list.length) { console.log('Tidak ada link artikel ditemukan; data lama dipertahankan.'); return; }
  const items = [];
  for (const it of list) {
    const k = known.get(it.url);
    if (k && k.title && k.image && k.date) { items.push(k); continue; }
    let a = {};
    try { a = parseArticle(await get(it.url)); } catch (e) { console.log('lewati detail: ' + e.message); }
    items.push({ url: it.url, title: a.title || it.title || it.slug.replace(/-/g, ' '), image: a.image || it.image || '', date: a.date || '', excerpt: a.excerpt || '' });
  }
  const same = JSON.stringify(items) === JSON.stringify(old.items || []);
  console.log((same ? 'Tidak ada perubahan. ' : 'Artikel diperbarui. ') + items.length + ' artikel; terbaru: ' + items[0].title);
  if (DRY || same || !SUPABASE_URL || !ANON) return;
  const w = await fetch(SUPABASE_URL + '/rest/v1/kv_store', {
    method: 'POST',
    headers: { ...h, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ key: 'articles', value: JSON.stringify({ updatedAt: new Date().toISOString(), source: INDEX, items }), updated_at: new Date().toISOString() }),
  });
  if (!w.ok) throw new Error('Gagal menyimpan artikel: HTTP ' + w.status);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}

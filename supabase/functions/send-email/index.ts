// ABC Selaras — Edge Function: send-email
// Mengirim email (notifikasi & kode verifikasi) lewat Resend (https://resend.com).
//
// Deploy (Dashboard Supabase → Edge Functions → Deploy new function → Via Editor, nama: send-email,
// tempel file ini, lalu matikan "Verify JWT"), atau CLI:
//   supabase functions deploy send-email --no-verify-jwt
//
// Secrets (Edge Functions → Secrets):
//   RESEND_API_KEY = re_xxxxxxxx
//   FROM_EMAIL     = "ABC Selaras <resend@abcselaras.my.id>"   (domain harus diverifikasi di Resend)
//
// Keamanan: fungsi hanya mau mengirim ke alamat email yang terdaftar di data ABC Selaras
// (email karyawan aktif / akun HR), supaya tidak bisa dipakai mengirim spam ke sembarang alamat.

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "ABC Selaras <onboarding@resend.dev>";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";
const APP_URL = "https://abcselaras.my.id/web/";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...cors, "Content-Type": "application/json" } });
const esc = (s: string) => String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] || c));

let cache: { at: number; emails: Set<string>; names: Map<string, string> } | null = null;
let NAMES = new Map<string, string>();
async function registeredEmails(fresh = false): Promise<Set<string> | null> {
  if (!fresh && cache && Date.now() - cache.at < 60_000) { NAMES = cache.names; return cache.emails; }
  if (!SUPABASE_URL || !SERVICE_KEY) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/kv_store?key=eq.hrdb&select=value`, { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } });
    if (!r.ok) return null;
    const rows = await r.json();
    const db = JSON.parse(rows[0]?.value || "{}");
    const set = new Set<string>();
    const names = new Map<string, string>();
    const add = (e?: string, n?: string) => { if (e) { const k = String(e).trim().toLowerCase(); set.add(k); if (n && !names.has(k)) names.set(k, n); } };
    (db.employees || []).forEach((e: { active?: boolean; email?: string; name?: string }) => { if (e.active !== false) add(e.email, e.name); });
    add(db.hr?.email, db.hr?.name || "HR Admin");
    (db.hrAccounts || []).forEach((a: { email?: string; name?: string }) => add(a.email, a.name));
    cache = { at: Date.now(), emails: set, names };
    NAMES = names;
    return set;
  } catch (_) { return null; }
}

async function rateLimitOk(email: string): Promise<boolean> {
  if (!SUPABASE_URL || !SERVICE_KEY) return true;
  const WINDOW = 3600_000, MAX = 20;
  try {
    const h = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" };
    const r = await fetch(`${SUPABASE_URL}/rest/v1/kv_store?key=eq.email_rate&select=value`, { headers: h });
    const rows = r.ok ? await r.json() : [];
    const data = JSON.parse(rows?.[0]?.value || "{}");
    const now = Date.now();
    const list = (data[email] || []).filter((t: number) => now - t < WINDOW);
    if (list.length >= MAX) { data[email] = list; return false; }
    list.push(now);
    data[email] = list;
    /* bersihkan entri lama agar tidak membengkak */
    for (const k of Object.keys(data)) { data[k] = (data[k] || []).filter((t: number) => now - t < WINDOW); if (!data[k].length) delete data[k]; }
    await fetch(`${SUPABASE_URL}/rest/v1/kv_store`, { method: "POST", headers: { ...h, Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ key: "email_rate", value: JSON.stringify(data), updated_at: new Date().toISOString() }) });
    return true;
  } catch (_) { return true; }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { to, subject, body, url, kind, code, section } = await req.json();
    if (!to) return json({ ok: false, error: "to wajib diisi" }, 400);
    if (!RESEND_API_KEY) return json({ ok: false, error: "RESEND_API_KEY belum di-set" }, 500);
    let reg = await registeredEmails();
    /* email baru saja diisi staff: muat ulang daftar sebelum menolak */
    if (reg && !reg.has(String(to).trim().toLowerCase())) reg = await registeredEmails(true);
    if (reg && !reg.has(String(to).trim().toLowerCase())) return json({ ok: false, error: "Alamat email tidak terdaftar di ABC Selaras" }, 403);

    /* Rate limit: cegah email bombing — maks 20 email / penerima / jam. */
    const rl = await rateLimitOk(String(to).trim().toLowerCase());
    if (!rl) return json({ ok: false, error: "Terlalu banyak email ke alamat ini, coba lagi nanti." }, 429);

    /* Batasi tautan hanya ke domain aplikasi (matikan vektor phishing via tautan luar). */
    let link = APP_URL;
    if (typeof url === "string" && url.startsWith("http")) {
      try { const h = new URL(url).hostname.toLowerCase(); if (h === "abcselaras.my.id" || h.endsWith(".abcselaras.my.id")) link = url; } catch (_) { /* abaikan, pakai APP_URL */ }
    } else if (typeof url === "string" && url) {
      link = APP_URL + url.replace(/^\/+/, "");
    }
    const sec = section && typeof section === "object" ? section : { label: kind === "code" ? "Verifikasi Email" : "ABC Selaras", icon: kind === "code" ? "🔐" : "🔔", color: "#3980C4" };
    const accent = /^#[0-9a-fA-F]{6}$/.test(String(sec.color || "")) ? sec.color : "#3980C4";
    const name = NAMES.get(String(to).trim().toLowerCase()) || "";
    const title = String(subject || "").replace(/^ABC Selaras\s*[—-]\s*/, "") || "Notifikasi";
    const codeBlock = kind === "code" && code
      ? `<div style="font-size:36px;font-weight:800;letter-spacing:12px;color:#133451;background:#EAF3FC;border:2px dashed #9CC7EE;border-radius:16px;padding:18px 0;text-align:center;margin:4px 0 14px;">${esc(code)}</div><p style="font-size:12.5px;color:#7a8b9c;text-align:center;margin:0 0 18px;">Kode berlaku 15 menit. Jangan bagikan ke siapa pun.</p>`
      : "";
    const html = `
<div style="background:#EEF4FA;padding:28px 12px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;">
    <div style="text-align:center;margin-bottom:14px;">
      <img src="${APP_URL}icon-192.png" width="56" height="56" alt="ABC Selaras" style="border-radius:14px;display:inline-block;">
    </div>
    <div style="background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 18px rgba(19,52,81,.10);">
      <div style="background:linear-gradient(135deg,#4AA3F4,#1E4E78);padding:22px 24px;color:#fff;">
        <div style="font-size:12px;letter-spacing:1.5px;text-transform:uppercase;opacity:.85;font-weight:700;">ABC Selaras &middot; ABC Hospitality Group</div>
        <div style="font-size:21px;font-weight:800;margin-top:6px;line-height:1.3;">${esc(kind === "code" ? "Kode Verifikasi Email" : title)}</div>
      </div>
      <div style="padding:24px;">
        <span style="display:inline-block;background:${accent}1A;color:${accent};font-weight:700;font-size:12.5px;padding:6px 12px;border-radius:999px;margin-bottom:16px;">${esc(sec.icon || "")} ${esc(sec.label || "")}</span>
        ${name ? `<p style="font-size:15px;color:#133451;margin:0 0 10px;">Halo <b>${esc(name)}</b>,</p>` : ""}
        ${codeBlock}
        <div style="border-left:4px solid ${accent};background:#F7FAFD;border-radius:10px;padding:14px 16px;font-size:15px;color:#133451;line-height:1.6;margin:0 0 22px;">${esc(body || "")}</div>
        ${kind === "code" ? "" : `<div style="text-align:center;"><a href="${esc(link)}" style="display:inline-block;background:${accent};color:#fff;text-decoration:none;font-weight:700;padding:13px 28px;border-radius:999px;font-size:14.5px;">Buka di ABC Selaras &rarr;</a></div>`}
      </div>
      <div style="background:#F7FAFD;border-top:1px solid #E6EEF6;padding:14px 24px;font-size:11.5px;color:#7a8b9c;line-height:1.6;text-align:center;">
        Email otomatis dari ABC Selaras, mohon tidak membalas email ini.<br>Atur notifikasi email di menu <b>Profil</b> &middot; <a href="${APP_URL}" style="color:#3980C4;text-decoration:none;">abcselaras.my.id</a>
      </div>
    </div>
    <div style="text-align:center;font-size:11px;color:#9AABBC;margin-top:14px;">&copy; ABC Hospitality Group &middot; Malang</div>
  </div>
</div>`;

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject: subject || "ABC Selaras — Notifikasi", html, text: `${code ? "Kode: " + code + "\n\n" : ""}${body || ""}\n\n${link}` }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) return json({ ok: false, error: data?.message || `Resend HTTP ${resp.status}` }, 502);
    return json({ ok: true, id: data?.id });
  } catch (e) {
    return json({ ok: false, error: String((e as Error)?.message || e) }, 500);
  }
});

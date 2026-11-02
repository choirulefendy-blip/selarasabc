// ABC Selaras — Edge Function: send-email
// Mengirim email (notifikasi & kode verifikasi) lewat Resend (https://resend.com).
//
// Deploy (Dashboard Supabase → Edge Functions → Deploy new function → Via Editor, nama: send-email,
// tempel file ini, lalu matikan "Verify JWT"), atau CLI:
//   supabase functions deploy send-email --no-verify-jwt
//
// Secrets (Edge Functions → Secrets):
//   RESEND_API_KEY = re_xxxxxxxx
//   FROM_EMAIL     = "ABC Selaras <noreply@abcselaras.my.id>"   (domain harus diverifikasi di Resend)
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

let cache: { at: number; emails: Set<string> } | null = null;
async function registeredEmails(): Promise<Set<string> | null> {
  if (cache && Date.now() - cache.at < 60_000) return cache.emails;
  if (!SUPABASE_URL || !SERVICE_KEY) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/kv_store?key=eq.hrdb&select=value`, { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } });
    if (!r.ok) return null;
    const rows = await r.json();
    const db = JSON.parse(rows[0]?.value || "{}");
    const set = new Set<string>();
    const add = (e?: string) => { if (e) set.add(String(e).trim().toLowerCase()); };
    (db.employees || []).forEach((e: { active?: boolean; email?: string }) => { if (e.active !== false) add(e.email); });
    add(db.hr?.email);
    (db.hrAccounts || []).forEach((a: { email?: string }) => add(a.email));
    cache = { at: Date.now(), emails: set };
    return set;
  } catch (_) { return null; }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { to, subject, body, url, kind, code } = await req.json();
    if (!to) return json({ ok: false, error: "to wajib diisi" }, 400);
    if (!RESEND_API_KEY) return json({ ok: false, error: "RESEND_API_KEY belum di-set" }, 500);
    const reg = await registeredEmails();
    if (reg && !reg.has(String(to).trim().toLowerCase())) return json({ ok: false, error: "Alamat email tidak terdaftar di ABC Selaras" }, 403);

    const link = typeof url === "string" && url.startsWith("http") ? url : APP_URL + (url || "");
    const codeBlock = kind === "code" && code
      ? `<div style="font-size:34px;font-weight:800;letter-spacing:10px;color:#133451;background:#EAF3FC;border-radius:14px;padding:16px 0;text-align:center;margin:8px 0 18px;">${esc(code)}</div>`
      : "";
    const html = `
<div style="background:#F4F8FC;padding:24px 12px;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 2px 10px rgba(19,52,81,.08);">
    <div style="background:linear-gradient(135deg,#4AA3F4,#296290);padding:18px 22px;color:#fff;font-weight:800;font-size:18px;">ABC Selaras</div>
    <div style="padding:22px;">
      ${codeBlock}
      <p style="font-size:15px;color:#133451;line-height:1.6;margin:0 0 18px;">${esc(body || "")}</p>
      ${kind === "code" ? "" : `<a href="${esc(link)}" style="display:inline-block;background:#3980C4;color:#fff;text-decoration:none;font-weight:700;padding:11px 20px;border-radius:999px;font-size:14px;">Buka ABC Selaras</a>`}
      <p style="font-size:12px;color:#7a8b9c;margin:24px 0 0;border-top:1px solid #eef2f6;padding-top:12px;">Email otomatis dari ABC Selaras &middot; ABC Hospitality Group. Atur notifikasi email di menu Profil / Pengaturan Notifikasi.</p>
    </div>
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

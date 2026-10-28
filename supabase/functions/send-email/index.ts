// ABC Selaras — Edge Function: send-email
// Mengirim notifikasi ke email lewat Resend (https://resend.com).
//
// Deploy dengan Supabase CLI:
//   supabase functions deploy send-email --no-verify-jwt
//
// Set secrets sebelum deploy:
//   supabase secrets set RESEND_API_KEY=re_xxxxxxxx
//   supabase secrets set FROM_EMAIL="ABC Selaras <onboarding@resend.dev>"
//
// Catatan: "onboarding@resend.dev" adalah alamat pengirim testing bawaan
// Resend yang bisa langsung dipakai tanpa verifikasi domain. Untuk
// pengiriman produksi dengan alamat sendiri (mis. noreply@abchospitality.com),
// verifikasi domain dulu di dashboard Resend, baru ganti FROM_EMAIL.

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "ABC Selaras <onboarding@resend.dev>";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] || c));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { to, subject, body, url } = await req.json();
    if (!to) {
      return new Response(JSON.stringify({ ok: false, error: "to wajib diisi" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const html = `
      <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px 20px;">
        <h2 style="color:#111;margin:0 0 16px;">ABC Selaras</h2>
        <p style="font-size:15px;color:#333;line-height:1.5;margin:0 0 16px;">${escapeHtml(body || "")}</p>
        <p style="font-size:12px;color:#999;margin-top:28px;border-top:1px solid #eee;padding-top:12px;">
          Notifikasi otomatis dari Sistem HR &amp; Penggajian ABC Selaras.
        </p>
      </div>
    `;

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [to],
        subject: subject || "ABC Selaras — Notifikasi Baru",
        html,
      }),
    });

    const data = await resp.json();
    if (!resp.ok) throw new Error(JSON.stringify(data));

    return new Response(JSON.stringify({ ok: true, id: data.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

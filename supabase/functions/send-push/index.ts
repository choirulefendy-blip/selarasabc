// ABC Selaras — Edge Function: send-push
// Mengirim notifikasi ke semua perangkat milik seorang penerima
// ('hr' atau ID karyawan):
//   - Web Push (browser/PWA)  -> tabel push_subscriptions + kunci VAPID
//   - FCM (aplikasi Android)  -> tabel fcm_tokens + service account Firebase
// Keduanya opsional: yang secret-nya tidak diisi otomatis dilewati.
//
// Deploy:  supabase functions deploy send-push --no-verify-jwt
//
// Secrets:
//   supabase secrets set VAPID_PUBLIC_KEY=xxxx VAPID_PRIVATE_KEY=xxxx      (Web Push)
//   supabase secrets set SB_URL=https://xxxx.supabase.co SB_ANON_KEY=xxxx
//   supabase secrets set FCM_SERVICE_ACCOUNT="$(cat serviceAccount.json)"  (FCM)
// SUPABASE_SERVICE_ROLE_KEY disediakan otomatis oleh Supabase.

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") || "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") || "";
const SB_URL = Deno.env.get("SB_URL") || Deno.env.get("SUPABASE_URL") || "";
const SB_ANON_KEY = Deno.env.get("SB_ANON_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";
const SB_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SB_SERVICE_KEY") || "";
const FCM_SA_RAW = Deno.env.get("FCM_SERVICE_ACCOUNT") || "";

const webPushReady = !!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
if (webPushReady) {
  webpush.setVapidDetails("mailto:admin@example.com", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

/* ------------------------------ FCM (HTTP v1) ------------------------------ */
let fcmSa: any = null;
try { fcmSa = FCM_SA_RAW ? JSON.parse(FCM_SA_RAW) : null; } catch (_) { fcmSa = null; }

const enc = new TextEncoder();
function b64url(input: ArrayBuffer | string): string {
  const bytes = typeof input === "string" ? enc.encode(input) : new Uint8Array(input);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

let cachedToken: { value: string; exp: number } | null = null;
async function getFcmAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp - 60 > now) return cachedToken.value;
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(JSON.stringify({
    iss: fcmSa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const pem = String(fcmSa.private_key).replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, enc.encode(`${header}.${claim}`));
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claim}.${b64url(sig)}`,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) throw new Error("FCM auth gagal: " + JSON.stringify(data));
  cachedToken = { value: data.access_token, exp: now + (data.expires_in || 3600) };
  return cachedToken.value;
}

// true = token sudah mati dan boleh dihapus
function isDeadToken(status: number, body: any): boolean {
  const code = body?.error?.details?.find?.((d: any) => d?.errorCode)?.errorCode || "";
  if (code === "UNREGISTERED") return true;
  if (status === 404) return true;
  if (status === 400 && code === "INVALID_ARGUMENT" && /registration token/i.test(body?.error?.message || "")) return true;
  return false;
}

async function sendFcm(token: string, accessToken: string, title: string, body: string, url: string) {
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${fcmSa.project_id}/messages:send`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        token,
        notification: { title, body },
        data: { url },
        android: {
          priority: "HIGH",
          notification: { channel_id: "selaras_default", icon: "ic_stat_selaras", color: "#296290" },
        },
      },
    }),
  });
  if (res.ok) return { ok: true, dead: false };
  let err: any = null;
  try { err = await res.json(); } catch (_) { /* abaikan */ }
  return { ok: false, dead: isDeadToken(res.status, err), error: err?.error?.message || String(res.status) };
}

/* --------------------------------- Handler --------------------------------- */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { recipient, title, body, url } = await req.json();
    if (!recipient) return json({ ok: false, error: "recipient wajib diisi" }, 400);

    const t = title || "ABC Selaras";
    const b = body || "";
    const u = url || "#";
    const out: Record<string, unknown> = { ok: true };

    // Web Push (iPhone / browser) — kalau gagal, FCM Android tetap dikirim
    if (webPushReady && SB_URL && (SB_SERVICE_KEY || SB_ANON_KEY)) try {
      const supabase = createClient(SB_URL, SB_SERVICE_KEY || SB_ANON_KEY);
      const { data: rows, error } = await supabase.from("push_subscriptions").select("*").eq("recipient", recipient);
      if (error) throw error;
      // satu perangkat bisa tersimpan berkali-kali -> kirim sekali per endpoint
      const seen = new Set<string>();
      const subs = (rows || []).filter((r: any) => { const ep = r.subscription && r.subscription.endpoint; if (!ep || seen.has(ep)) return false; seen.add(ep); return true; });
      const payload = JSON.stringify({ title: t, body: b, url: u === "#" ? "/" : u, icon: "icon-192.png" });
      const results = await Promise.allSettled(subs.map((row: any) => webpush.sendNotification(row.subscription, payload)));
      // langganan kedaluwarsa (HP ganti / aplikasi dihapus) dibersihkan otomatis
      if (SB_SERVICE_KEY) {
        const dead = subs.filter((_: any, i: number) => { const r: any = results[i]; return r.status === "rejected" && [404, 410].includes(r.reason && r.reason.statusCode); })
          .map((r: any) => r.subscription.endpoint);
        if (dead.length) {
          const all = (rows || []).filter((r: any) => dead.includes(r.subscription && r.subscription.endpoint)).map((r: any) => r.id);
          if (all.length) await supabase.from("push_subscriptions").delete().in("id", all);
        }
      }
      const sent = results.filter((r) => r.status === "fulfilled").length;
      out.sent = sent;
      out.failed = results.length - sent;
    } catch (e) { out.webPushError = String(e); }

    // FCM (Android)
    if (!fcmSa) out.fcmError = FCM_SA_RAW ? "FCM_SERVICE_ACCOUNT tidak valid (bukan JSON)" : "FCM_SERVICE_ACCOUNT belum diisi";
    else if (!SB_SERVICE_KEY) out.fcmError = "SUPABASE_SERVICE_ROLE_KEY tidak tersedia di Edge Function";
    if (fcmSa && SB_URL && SB_SERVICE_KEY) try {
      const admin = createClient(SB_URL, SB_SERVICE_KEY);
      const { data: rows, error } = await admin.from("fcm_tokens").select("token").eq("recipient", recipient);
      if (error) {
        out.fcmError = error.message;
      } else if (rows && rows.length) {
        const accessToken = await getFcmAccessToken();
        const res = await Promise.all(rows.map((r: any) => sendFcm(r.token, accessToken, t, b, u)));
        const dead = rows.filter((_: any, i: number) => res[i].dead).map((r: any) => r.token);
        if (dead.length) await admin.from("fcm_tokens").delete().in("token", dead);
        out.fcmSent = res.filter((r) => r.ok).length;
        out.fcmFailed = res.filter((r) => !r.ok).length;
        out.fcmRemoved = dead.length;
        const firstErr = res.find((r) => !r.ok && !r.dead);
        if (firstErr) out.fcmError = (firstErr as any).error;
      } else {
        out.fcmSent = 0;
        out.fcmNote = "belum ada HP terdaftar untuk penerima ini";
      }
    } catch (e) { out.fcmError = String(e); }

    return json(out);
  } catch (err) {
    return json({ ok: false, error: String(err) }, 500);
  }
});

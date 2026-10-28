// ABC Selaras — Edge Function: send-push
// Mengirim notifikasi push ke semua perangkat yang terdaftar untuk
// seorang penerima ('hr' atau ID karyawan).
//
// Deploy dengan Supabase CLI:
//   supabase functions deploy send-push --no-verify-jwt
//
// Set secrets sebelum deploy (lihat README untuk cara membuat VAPID keys):
//   supabase secrets set VAPID_PUBLIC_KEY=xxxx VAPID_PRIVATE_KEY=xxxx
//   supabase secrets set SB_URL=https://xxxx.supabase.co SB_ANON_KEY=xxxx

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") || "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") || "";
const SB_URL = Deno.env.get("SB_URL") || "";
const SB_ANON_KEY = Deno.env.get("SB_ANON_KEY") || "";

webpush.setVapidDetails("mailto:admin@example.com", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { recipient, title, body, url } = await req.json();
    if (!recipient) {
      return new Response(JSON.stringify({ ok: false, error: "recipient wajib diisi" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SB_URL, SB_ANON_KEY);
    const { data: subs, error } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("recipient", recipient);

    if (error) throw error;

    const payload = JSON.stringify({
      title: title || "ABC Selaras",
      body: body || "",
      url: url || "/",
    });

    const results = await Promise.allSettled(
      (subs || []).map((row: any) => webpush.sendNotification(row.subscription, payload))
    );

    const sent = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.length - sent;

    return new Response(JSON.stringify({ ok: true, sent, failed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

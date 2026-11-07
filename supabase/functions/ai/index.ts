// ABC Selaras — Edge Function: ai
// Perantara (proxy) ke Google Gemini untuk fitur AI ABC Selaras:
//   asisten (chat), tulis (rapikan teks), insight (ringkasan HR/HOD), jadwal (draf jadwal HOD), ping (tes koneksi).
//
// API key Gemini HANYA disimpan sebagai secret di Supabase — tidak pernah ada di aplikasi / GitHub.
//
// Deploy (Dashboard Supabase → Edge Functions → Deploy new function → Via Editor, nama: ai,
// tempel file ini, lalu matikan "Verify JWT"), atau CLI:
//   supabase functions deploy ai --no-verify-jwt
//
// Secrets (Edge Functions → Secrets):
//   GEMINI_API_KEY = (API key dari Google AI Studio)                    ← wajib
//   GEMINI_MODELS  = gemini-3.8-flash,gemini-2.5-flash,gemini-3.1-flash-lite   ← opsional (urutan cadangan)
//   AI_DAILY_LIMIT = 40                                                  ← opsional (batas permintaan / akun / hari)
//
// Keamanan:
// - hanya akun yang terdaftar & aktif di data ABC Selaras yang dilayani;
// - batas pemakaian harian per akun (disimpan di tabel kv_store, key "ai_usage") + batas per menit;
// - jenis tugas & instruksi sistem ditentukan di sini, bukan oleh aplikasi.

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";

const KEY = (Deno.env.get("GEMINI_API_KEY") || "").trim();
const MODELS_ENV = (Deno.env.get("GEMINI_MODELS") || "").split(",").map((s) => s.trim()).filter(Boolean);
const DAILY_LIMIT_ENV = parseInt(Deno.env.get("AI_DAILY_LIMIT") || "", 10);
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const FLASH = ["gemini-3.8-flash", "gemini-3.6-flash", "gemini-2.5-flash"];
const LITE = ["gemini-3.1-flash-lite", "gemini-3.5-flash-lite", "gemini-2.5-flash-lite"];

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...cors, "Content-Type": "application/json" } });
const clip = (s: unknown, n: number) => String(s ?? "").slice(0, n);
const today = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10); // WIB

/* ---------- instruksi sistem per tugas ---------- */
const BASE = "Anda adalah Asisten Selaras, asisten AI di aplikasi HR 'ABC Selaras' milik ABC Hospitality Group " +
  "(Briggs Inn, Padi Heritage Resort, Briggscat Restaurant, Kopi Kalibrantas) di Malang, Indonesia. " +
  "Jawab dalam bahasa yang dipakai pengguna (default Bahasa Indonesia), ramah, singkat, dan jelas. " +
  "Gunakan HANYA data pada KONTEKS untuk fakta tentang karyawan, jadwal, cuti, absensi, gaji, dan aturan; jika data tidak ada, katakan tidak tahu dan sarankan menghubungi HR/HOD. " +
  "Jangan mengarang angka, nama, atau kebijakan. Anda tidak bisa mengubah data atau mengajukan sesuatu atas nama pengguna — arahkan ke menu yang tepat. " +
  "Jangan membocorkan data karyawan lain yang tidak ada di konteks. Format: teks biasa, boleh **tebal** dan daftar '- '. Maksimal ~180 kata kecuali diminta lebih.";

const WRITE_KINDS: Record<string, string> = {
  leave: "alasan pengajuan cuti/izin/sakit ke atasan — sopan, jelas, 1–3 kalimat",
  overtime: "uraian pekerjaan lembur — ringkas, konkret, berupa poin pekerjaan bila lebih dari satu",
  recap: "rekap pekerjaan harian — daftar poin singkat, kata kerja di awal, tanpa basa-basi",
  announcement: "pengumuman resmi HR untuk seluruh karyawan — profesional, hangat, terstruktur (pembuka, inti, penutup singkat)",
  article: "artikel internal/blog perusahaan — paragraf rapi, menarik, mudah dibaca",
  banner_title: "judul banner aplikasi — sangat singkat (maks 6 kata), menarik",
  banner_sub: "teks pendukung banner — satu kalimat pendek (maks 14 kata)",
  form: "isi formulir pengajuan internal — jelas dan formal",
  task: "deskripsi tugas di board kerja — jelas, bisa ditindaklanjuti",
  general: "teks kerja internal — rapi dan profesional",
};

function systemFor(task: string, body: Record<string, unknown>): string {
  if (task === "tulis") {
    const kind = WRITE_KINDS[String(body.kind)] || WRITE_KINDS.general;
    const tone = body.tone === "santai" ? "nada santai namun sopan" : body.tone === "singkat" ? "sesingkat mungkin" : "nada profesional";
    return "Anda editor bahasa untuk karyawan ABC Hospitality Group. Tulis ulang teks pengguna menjadi " + kind + ", dengan " + tone + ". " +
      "Pertahankan semua fakta (tanggal, jam, nama, angka) — jangan menambah fakta baru. Bahasa sama dengan teks asli. " +
      "Keluarkan HANYA teks hasil, tanpa pengantar, tanpa tanda kutip, tanpa markdown heading.";
  }
  if (task === "insight") {
    return BASE + " Tugas: buat RINGKASAN untuk " + (body.scope === "hod" ? "kepala departemen (HOD) tentang timnya" : "tim HR tentang seluruh perusahaan") +
      " dari data statistik di KONTEKS. Format: 1 paragraf ringkasan (maks 3 kalimat), lalu '**Perlu perhatian**' berisi 2–4 poin, lalu '**Saran tindakan**' berisi 2–4 poin konkret. Sebut angka dari data. Maks 220 kata.";
  }
  if (task === "jadwal") {
    return "Anda perencana jadwal shift untuk departemen hotel/restoran. Buat draf jadwal satu bulan berdasarkan KONTEKS (anggota tim, pola bulan lalu, preset shift, cuti yang sudah disetujui, tanggal yang sudah terisi). " +
      "Aturan: hormati cuti/izin/sakit yang disetujui dan hari yang sudah terisi (jangan diubah, tidak perlu dikeluarkan); tiap orang kira-kira mengikuti jumlah libur per minggu bulan lalu (default 1 hari/minggu); " +
      "sebar libur supaya tiap hari tetap ada orang yang bekerja; pakai jam shift dari preset/pola bulan lalu. " +
      "Isi HANYA tanggal yang kosong. Keluarkan JSON saja dengan format ringkas: {\"catatan\":\"ringkasan singkat bahasa Indonesia (maks 2 kalimat)\",\"jadwal\":{\"<empId>\":{\"<tanggal>\":\"HH:MM-HH:MM\" untuk kerja atau \"L\" untuk libur}}}.";
  }
  return BASE;
}

/* ---------- akun terdaftar ---------- */
let accCache: { at: number; keys: Map<string, string> } | null = null;
async function accounts(fresh = false): Promise<Map<string, string> | null> {
  if (!fresh && accCache && Date.now() - accCache.at < 60_000) return accCache.keys;
  if (!SUPABASE_URL || !SERVICE_KEY) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/kv_store?key=eq.hrdb&select=value`, { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } });
    if (!r.ok) return null;
    const rows = await r.json();
    const db = JSON.parse(rows[0]?.value || "{}");
    const m = new Map<string, string>();
    (db.employees || []).forEach((e: { id: string; active?: boolean; name?: string }) => { if (e.active !== false) m.set("emp:" + e.id, e.name || ""); });
    m.set("hr", "HR");
    (db.hrAccounts || []).forEach((a: { id: string; name?: string }) => m.set("hra:" + a.id, a.name || "HR"));
    const ai = (db.settings && db.settings.ai) || {};
    m.set("__enabled", ai.enabled === false ? "0" : "1");
    m.set("__limit", String(ai.dailyLimit || ""));
    accCache = { at: Date.now(), keys: m };
    return m;
  } catch (_) { return null; }
}

/* ---------- batas pemakaian ---------- */
const perMinute = new Map<string, number[]>();
function minuteOk(k: string, max = 8): boolean {
  const now = Date.now(), arr = (perMinute.get(k) || []).filter((t) => now - t < 60_000);
  if (arr.length >= max) { perMinute.set(k, arr); return false; }
  arr.push(now); perMinute.set(k, arr); return true;
}
async function usage(account: string, limit: number, commit: boolean): Promise<{ ok: boolean; used: number; limit: number }> {
  if (!SUPABASE_URL || !SERVICE_KEY) return { ok: true, used: 0, limit };
  const h = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" };
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/kv_store?key=eq.ai_usage&select=value`, { headers: h });
    const rows = r.ok ? await r.json() : [];
    let data: { day?: string; counts?: Record<string, number> } = {};
    try { data = JSON.parse(rows[0]?.value || "{}"); } catch (_) { data = {}; }
    if (data.day !== today()) data = { day: today(), counts: {} };
    const used = (data.counts || {})[account] || 0;
    if (used >= limit) return { ok: false, used, limit };
    if (commit) {
      data.counts = data.counts || {}; data.counts[account] = used + 1;
      await fetch(`${SUPABASE_URL}/rest/v1/kv_store`, {
        method: "POST", headers: { ...h, Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify({ key: "ai_usage", value: JSON.stringify(data), updated_at: new Date().toISOString() }),
      });
    }
    return { ok: true, used: used + (commit ? 1 : 0), limit };
  } catch (_) { return { ok: true, used: 0, limit }; }
}

/* ---------- panggil Gemini (dengan model cadangan) ---------- */
type Msg = { role: string; text: string };
async function callGemini(models: string[], system: string, contents: unknown[], cfg: Record<string, unknown>) {
  const errors: string[] = [];
  for (const model of models) {
    const body = JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents, generationConfig: cfg });
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    let r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": KEY }, body });
    if (r.status === 401 || r.status === 403) {
      // beberapa jenis key (mis. "AQ.") hanya diterima lewat parameter ?key= atau endpoint Vertex express
      r = await fetch(`${url}?key=${encodeURIComponent(KEY)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body });
      if (r.status === 401 || r.status === 403) {
        const vx = `https://aiplatform.googleapis.com/v1/publishers/google/models/${model}:generateContent?key=${encodeURIComponent(KEY)}`;
        const r2 = await fetch(vx, { method: "POST", headers: { "Content-Type": "application/json" }, body });
        if (r2.ok || (r2.status !== 401 && r2.status !== 403)) r = r2;
      }
    }
    const txt = await r.text();
    if (!r.ok) {
      errors.push(`${model}: ${r.status} ${clip(txt.replace(/\s+/g, " "), 160)}`);
      if ([400].includes(r.status) && !/not found|not supported|unknown name|model/i.test(txt)) break; // permintaan salah, jangan ulang
      continue; // 401/403/404/429/5xx → coba model berikutnya
    }
    try {
      const j = JSON.parse(txt);
      const out = (j.candidates?.[0]?.content?.parts || []).map((p: { text?: string }) => p.text || "").join("").trim();
      if (!out) { errors.push(`${model}: jawaban kosong (${j.candidates?.[0]?.finishReason || j.promptFeedback?.blockReason || "?"})`); continue; }
      return { ok: true, text: out, model };
    } catch (_) { errors.push(`${model}: format jawaban tidak dikenal`); }
  }
  return { ok: false, errors };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "POST saja" }, 405);
  try {
    const body = await req.json();
    const task = String(body.task || "asisten");
    if (!["asisten", "tulis", "insight", "jadwal", "ping"].includes(task)) return json({ ok: false, error: "Tugas tidak dikenal" }, 400);
    if (!KEY) return json({ ok: false, error: "GEMINI_API_KEY belum di-set di Supabase (Edge Functions → Secrets)." }, 500);

    const account = clip(body.account, 80);
    let acc = await accounts();
    if (acc && !acc.has(account)) acc = await accounts(true);
    if (acc && !acc.has(account)) return json({ ok: false, error: "Akun tidak terdaftar di ABC Selaras." }, 403);
    if (task !== "ping" && acc && acc.get("__enabled") === "0") return json({ ok: false, error: "Fitur AI sedang dimatikan oleh HR." }, 403);
    const limit = parseInt(acc?.get("__limit") || "", 10) || DAILY_LIMIT_ENV || 40;

    if (!minuteOk(account)) return json({ ok: false, error: "Terlalu cepat. Coba lagi dalam 1 menit." }, 429);
    const pre = await usage(account, limit, false);
    if (!pre.ok) return json({ ok: false, error: `Batas pemakaian AI hari ini sudah habis (${pre.limit}x). Coba lagi besok.`, used: pre.used, limit: pre.limit }, 429);

    const context = clip(body.context, 14000);
    let contents: unknown[] = [];
    const cfg: Record<string, unknown> = { temperature: 0.6, maxOutputTokens: 900 };
    let models = MODELS_ENV.length ? MODELS_ENV : FLASH.concat(LITE);

    if (task === "ping") {
      contents = [{ role: "user", parts: [{ text: "Balas tepat dengan: OK" }] }];
      cfg.maxOutputTokens = 10; cfg.temperature = 0;
    } else if (task === "tulis") {
      const text = clip(body.text, 6000).trim();
      if (!text) return json({ ok: false, error: "Teks masih kosong." }, 400);
      contents = [{ role: "user", parts: [{ text: (context ? "Konteks: " + context + "\n\n" : "") + "Teks:\n" + text }] }];
      cfg.temperature = 0.4; cfg.maxOutputTokens = body.kind === "article" || body.kind === "announcement" ? 1600 : 600;
      if (!MODELS_ENV.length) models = LITE.concat(FLASH);
    } else if (task === "jadwal") {
      contents = [{ role: "user", parts: [{ text: "KONTEKS:\n" + context + "\n\nBuat draf jadwal sesuai aturan." }] }];
      cfg.temperature = 0.3; cfg.maxOutputTokens = 8000; cfg.responseMimeType = "application/json";
    } else if (task === "insight") {
      contents = [{ role: "user", parts: [{ text: "KONTEKS:\n" + context + "\n\nBuat ringkasan sesuai format." }] }];
      cfg.temperature = 0.4; cfg.maxOutputTokens = 900;
    } else {
      const hist: Msg[] = Array.isArray(body.messages) ? body.messages.slice(-12) : [];
      if (!hist.length) return json({ ok: false, error: "Pesan kosong." }, 400);
      contents = hist.map((m, i) => ({
        role: m.role === "model" ? "model" : "user",
        parts: [{ text: (i === 0 && context ? "KONTEKS (data akun saya, jangan disebut ulang kecuali relevan):\n" + context + "\n\nPERTANYAAN:\n" : "") + clip(m.text, 3000) }],
      }));
    }

    const res = await callGemini(models, systemFor(task, body), contents, cfg);
    if (!res.ok) {
      const errs = (res as { errors: string[] }).errors || [];
      const auth = errs.some((e) => / 40[13] /.test(e));
      const quota = errs.length && errs.every((e) => / 429 /.test(e));
      return json({ ok: false, error: auth ? "API key Gemini ditolak. Periksa GEMINI_API_KEY di Supabase." : quota ? "Kuota gratis Gemini sedang habis. Coba lagi beberapa saat lagi." : "AI sedang tidak bisa dihubungi. Coba lagi nanti.", detail: errs.slice(0, 4) }, 502);
    }
    const post = task === "ping" ? pre : await usage(account, limit, true);
    return json({ ok: true, text: (res as { text: string }).text, model: (res as { model: string }).model, used: post.used, limit });
  } catch (e) {
    return json({ ok: false, error: "Permintaan tidak valid: " + String((e as Error).message || e) }, 400);
  }
});

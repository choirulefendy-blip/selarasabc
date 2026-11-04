// Supabase Edge Function: calendar-ics
// Feed kalender (iCal) per karyawan untuk dilanggan di Google Calendar / Apple / Outlook.
//   GET /functions/v1/calendar-ics?e=<empId>&t=<calToken>
// Isi: jadwal shift & libur/cuti/sakit/izin, cuti disetujui, tenggat tugas Selaras Board, agenda.
//
// PENTING: deploy dengan "Verify JWT" NONAKTIF (Google Calendar tidak bisa mengirim header login):
//   supabase functions deploy calendar-ics --no-verify-jwt
// Keamanan: setiap karyawan punya calToken acak (bisa di-reset dari Profil).
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";
const APP_URL = "https://abcselaras.my.id/web/";

type Any = Record<string, any>;
const pad = (n: number) => String(n).padStart(2, "0");
const esc = (s: unknown) => String(s ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const dstr = (d: Date) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
const iso = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);
const parseIso = (s: string) => { const [y, m, d] = String(s).slice(0, 10).split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const hm = (t: string) => String(t || "").replace(":", "").padEnd(4, "0").slice(0, 4) + "00";
const stamp = () => new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");

/* lipat baris > 75 oktet sesuai RFC 5545 */
function fold(line: string) {
  const out: string[] = []; let cur = "";
  for (const ch of line) { if (new TextEncoder().encode(cur + ch).length > 74) { out.push(cur); cur = " " + ch; } else cur += ch; }
  out.push(cur); return out.join("\r\n");
}

function ev(uid: string, summary: string, opt: { date?: Date; endDate?: Date; start?: [Date, string]; end?: [Date, string]; desc?: string; loc?: string }) {
  const L = ["BEGIN:VEVENT", `UID:${uid}@abcselaras.my.id`, `DTSTAMP:${stamp()}`, `SUMMARY:${esc(summary)}`];
  if (opt.start) {
    L.push(`DTSTART;TZID=Asia/Jakarta:${dstr(opt.start[0])}T${hm(opt.start[1])}`);
    if (opt.end) L.push(`DTEND;TZID=Asia/Jakarta:${dstr(opt.end[0])}T${hm(opt.end[1])}`);
  } else if (opt.date) {
    L.push(`DTSTART;VALUE=DATE:${dstr(opt.date)}`, `DTEND;VALUE=DATE:${dstr(addDays(opt.endDate || opt.date, 1))}`, "TRANSP:TRANSPARENT");
  }
  if (opt.desc) L.push(`DESCRIPTION:${esc(opt.desc)}`);
  if (opt.loc) L.push(`LOCATION:${esc(opt.loc)}`);
  L.push("END:VEVENT");
  return L.map(fold).join("\r\n");
}

const OFF_LABEL: Any = { libur: "Libur", cuti: "Cuti", sakit: "Sakit", izin: "Izin" };
function kind(sc: Any | null) { if (!sc) return ""; if (sc.type === "kerja") return "kerja"; if (sc.leave === "sakit" || sc.leave === "izin") return sc.leave; return sc.cuti ? "cuti" : "libur"; }

export function buildIcs(db: Any, emp: Any, now = new Date()) {
  const events: string[] = [];
  const today = new Date(now.getTime() + 7 * 3600000); // WIB
  const from = addDays(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())), -30);
  const to = addDays(from, 30 + 90);
  /* jadwal shift / libur */
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const ym = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
    const sc = db.schedules?.[ym]?.[emp.id]?.[d.getUTCDate()] || null;
    const k = kind(sc);
    if (!k) continue;
    const id = `sched-${emp.id}-${iso(d)}`;
    if (k === "kerja" && sc.start) {
      const end = sc.end || sc.start;
      const endDay = end <= sc.start ? addDays(d, 1) : d; // shift malam lewat tengah malam
      events.push(ev(id, `Shift Kerja ${sc.start}–${end}`, { start: [d, sc.start], end: [endDay, end], desc: "Jadwal kerja dari ABC Selaras. Jangan lupa absen.\n" + APP_URL }));
    } else if (k !== "kerja") {
      events.push(ev(id, OFF_LABEL[k] || "Libur", { date: d, desc: "Jadwal dari ABC Selaras" }));
    }
  }
  /* cuti disetujui */
  for (const r of db.leaveRequests || []) {
    if (r.empId !== emp.id || r.status !== "approved" || !r.startDate) continue;
    events.push(ev(`leave-${r.id}`, `Cuti${r.type ? ": " + r.type : ""} (disetujui)`, { date: parseIso(r.startDate), endDate: parseIso(r.endDate || r.startDate), desc: r.reason || "" }));
  }
  /* tenggat tugas */
  for (const t of db.todos || []) {
    if (t.deleted || t.rekap || t.ownerId !== emp.id || !t.due || t.status === "done" || t.status === "batal") continue;
    events.push(ev(`todo-${t.id}`, `📋 Tenggat: ${t.title || t.text || "Tugas"}`, { date: parseIso(t.due), desc: (t.note || t.desc || "") + "\nSelaras Board: " + APP_URL + "#todo" }));
  }
  /* agenda */
  const ownerDept = (oid: string) => (db.employees || []).find((x: Any) => x.id === oid)?.department || "";
  for (const a of db.agenda || []) {
    if (a.deleted || !a.date) continue;
    const vis = a.ownerId === emp.id || a.scope === "semua" || (a.scope === "departemen" && ownerDept(a.ownerId) && ownerDept(a.ownerId) === emp.department);
    if (!vis) continue;
    const d = parseIso(a.date);
    const o = a.startTime ? { start: [d, a.startTime] as [Date, string], end: [d, a.endTime || a.startTime] as [Date, string] } : { date: d };
    events.push(ev(`agenda-${a.id}`, a.title || "Agenda", { ...o, desc: a.note || "", loc: a.location || "" }));
  }
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//ABC Hospitality Group//ABC Selaras//ID", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    fold(`X-WR-CALNAME:${esc("ABC Selaras – " + (emp.name || "Jadwal"))}`), "X-WR-TIMEZONE:Asia/Jakarta", "REFRESH-INTERVAL;VALUE=DURATION:PT1H", "X-PUBLISHED-TTL:PT1H",
    "BEGIN:VTIMEZONE", "TZID:Asia/Jakarta", "BEGIN:STANDARD", "DTSTART:19700101T000000", "TZOFFSETFROM:+0700", "TZOFFSETTO:+0700", "TZNAME:WIB", "END:STANDARD", "END:VTIMEZONE",
    ...events, "END:VCALENDAR", "",
  ].join("\r\n");
}

if (import.meta.main) serve(async (req) => {
  const u = new URL(req.url);
  const e = u.searchParams.get("e") || "", t = u.searchParams.get("t") || "";
  if (!e || !t || t.length < 20) return new Response("Link kalender tidak valid", { status: 400 });
  const r = await fetch(`${SUPABASE_URL}/rest/v1/kv_store?key=eq.hrdb&select=value`, { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } });
  if (!r.ok) return new Response("Gagal membaca data", { status: 502 });
  const rows = await r.json();
  const db = JSON.parse(rows[0]?.value || "{}");
  const emp = (db.employees || []).find((x: Any) => x.id === e);
  if (!emp || emp.active === false || !emp.calToken || emp.calToken !== t) return new Response("Link kalender tidak valid atau sudah di-reset", { status: 404 });
  return new Response(buildIcs(db, emp), {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "public, max-age=900", "Content-Disposition": 'inline; filename="abc-selaras.ics"' },
  });
});

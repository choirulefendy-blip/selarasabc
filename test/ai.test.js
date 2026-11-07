/* Tes: fitur AI (Gemini lewat Edge Function "ai"): asisten, bantu tulis, insight, saran jadwal, pengaturan HR. */
var fs = require('fs'), path = require('path'), JSDOM = require('jsdom').JSDOM;
var html = fs.readFileSync(path.join(__dirname, '..', 'web', 'index.html'), 'utf8')
  .replace(/var SUPABASE_URL = '[^']*'/, "var SUPABASE_URL = ''").replace(/var SUPABASE_ANON_KEY = '[^']*'/, "var SUPABASE_ANON_KEY = ''")
  .replace(/var PUSH_FUNCTION_URL = '[^']*'/, "var PUSH_FUNCTION_URL = ''").replace(/var EMAIL_FUNCTION_URL = '[^']*'/, "var EMAIL_FUNCTION_URL = ''");
var fn = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'functions', 'ai', 'index.ts'), 'utf8');
var pass = 0, fail = 0;
function ok(c, n){ if(c){ pass++; console.log('  ok   - '+n); } else { fail++; console.log('  FAIL - '+n); } }
function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
(async function(){
  console.log('\n[Keamanan API key]');
  var repo = path.join(__dirname, '..');
  ok(!/AQ\.Ab8|AIza[0-9A-Za-z_-]{20,}/.test(html) && !/AQ\.Ab8|AIza[0-9A-Za-z_-]{20,}/.test(fn), 'tidak ada API key Gemini di aplikasi maupun kode server');
  ok(/Deno\.env\.get\("GEMINI_API_KEY"\)/.test(fn) && /x-goog-api-key/.test(fn), 'server membaca key dari secret Supabase & mengirim lewat header');
  ok(/usage\(account, limit/.test(fn) && /Akun tidak terdaftar/.test(fn) && /minuteOk/.test(fn), 'server: hanya akun terdaftar + batas harian + batas per menit');
  ok(/gemini-2\.5-flash/.test(fn) && /flash-lite/.test(fn) && /continue; \/\/ 401\/403\/404\/429\/5xx/.test(fn), 'server: model cadangan saat kuota habis / model tidak tersedia');

  ok(/thinkingBudget: 0/.test(fn) && /thinkingLevel: "low"/.test(fn), 'cepat: mode thinking dimatikan/diminimalkan');
  ok(/AUTH_MODE = mode/.test(fn) && /GOOD_MODEL\[group\] = model/.test(fn) && /BAD_MODEL\.set/.test(fn), 'cepat: cara kirim key & model yang berhasil diingat, model gagal dilewati');
  ok(/timed\(/.test(fn) && /waitUntil/.test(fn) && /usagePre = usage/.test(fn), 'cepat: batas waktu per percobaan, kuota dicek paralel & dicatat di belakang');
  ok(/AI terlalu lama merespons/.test(html) && /Sedang berpikir/.test(html), 'aplikasi: batas waktu 60 dtk & penanda "Sedang berpikir…"');
  var dom = new JSDOM(html, {url:'https://abcselaras.my.id/web/', runScripts:'dangerously', pretendToBeVisual:true});
  var w = dom.window; w.console.error = function(){}; w.scrollTo = function(){}; await sleep(400);
  var d = w.document; function app(){ return d.getElementById('app').textContent; }
  w.saveDB = function(){ return Promise.resolve(); };
  var toasts = []; w.toast = function(m){ toasts.push(m); };
  var t = w.todayParts(), ym = t.ym;
  w.DB.employees = [
    {id:'S1', empCode:'S1', name:'Sari Ayu', username:'sari', department:'Marketing', position:'Content Creator', properties:['Briggs Inn'], active:true, joinDate:'2024-03-01'},
    {id:'S2', empCode:'S2', name:'Budi Dua', username:'budi', department:'Marketing', position:'Designer', properties:['Briggs Inn'], active:true},
    {id:'H1', empCode:'H1', name:'Hana HOD', username:'hana', department:'Marketing', position:'Manager', properties:['ABC Group'], active:true}];
  w.DB.departmentHods = {Marketing:['H1']};
  w.DB.schedules[ym] = {S1:{}, S2:{}, H1:{}}; w.DB.schedules[ym].S1[t.day] = {type:'kerja', start:'08:00', end:'17:00'};
  w.DB.schedules[ym].S1[1] = {type:'libur'};
  w.DB.leaveRequests = [{id:'L1', empId:'S1', type:'Cuti Tahunan', startDate:ym+'-20', endDate:ym+'-20', status:'pending_hod'}];

  console.log('\n[Belum aktif]');
  w.SESSION = {role:'staff', empId:'S1'}; w.STATE.view = 'dashboard'; w.render();
  ok(!w.navItemsFor('staff').some(function(it){ return it.v==='ai-assistant'; }) && !d.querySelector('[data-view="ai-assistant"]'), 'sebelum HR mengaktifkan: menu Asisten AI tidak tampil');

  console.log('\n[HR mengaktifkan di Pengaturan]');
  var calls = [], reply = {ok:true, text:'OK', model:'gemini-3.8-flash', used:1, limit:40};
  w.AI_FUNCTION_URL = 'https://x.supabase.co/functions/v1/ai';
  w.fetch = function(url, opt){ var body = JSON.parse(opt.body); calls.push({url:url, body:body}); var r = typeof reply==='function' ? reply(body) : reply;
    return Promise.resolve({status:r.ok?200:429, text:function(){ return Promise.resolve(JSON.stringify(r)); }}); };
  w.SESSION = {role:'hr', empId:null, hrAccountId:null}; w.STATE.view = 'settings'; w.render();
  ok(/Asisten AI \(Gemini\)/.test(app()) && !!d.getElementById('ai_enabled') && !!d.getElementById('ai_limit'), 'kartu Asisten AI di Pengaturan HR');
  d.querySelector('[data-action="ai-test"]').dispatchEvent(new w.MouseEvent('click', {bubbles:true})); await sleep(30);
  ok(calls[0] && calls[0].body.task==='ping' && calls[0].body.account==='hr' && /Terhubung ✓ \(model: gemini-3\.8-flash\)/.test(app()), 'Tes Koneksi AI menampilkan model yang dipakai');
  d.getElementById('ai_enabled').value = '1'; d.getElementById('ai_limit').value = '25';
  d.querySelector('[data-action="save-ai-settings"]').dispatchEvent(new w.MouseEvent('click', {bubbles:true})); await sleep(30);
  ok(w.DB.settings.ai.enabled===true && w.DB.settings.ai.dailyLimit===25 && w.aiEnabled(), 'AI diaktifkan untuk semua akun (batas 25/hari)');

  console.log('\n[Asisten Selaras]');
  w.SESSION = {role:'staff', empId:'S1'}; w.STATE.view = 'ai-assistant'; w.render();
  ok(!!d.querySelector('[data-view="ai-assistant"]') && /Asisten Selaras/.test(app()) && d.querySelectorAll('.ai-chip').length===4, 'staf: menu & halaman Asisten AI dengan contoh pertanyaan');
  reply = {ok:true, text:'Sisa cuti Anda **11 hari**.\n- Terpakai 0\n- Menunggu 1', model:'gemini-3.8-flash', used:2, limit:25};
  d.querySelector('.ai-chip').dispatchEvent(new w.MouseEvent('click', {bubbles:true})); await sleep(40);
  var last = calls[calls.length-1].body;
  ok(last.task==='asisten' && last.account==='emp:S1' && last.messages[0].text==='Berapa sisa cuti saya?', 'pertanyaan dikirim dengan akun yang benar');
  ok(/Sari Ayu/.test(last.context) && /jatah 12 hari/.test(last.context) && /menunggu HOD/.test(last.context) && /Bagaimana cara absen masuk\?/.test(last.context), 'konteks: profil, saldo cuti, pengajuan, panduan FAQ');
  ok(!/Budi Dua/.test(last.context), 'konteks staf tidak memuat data karyawan lain');
  var bot = d.querySelector('.ai-msg.bot .ai-bubble');
  ok(bot && bot.querySelector('b') && bot.querySelectorAll('li').length===2 && /Sisa hari ini: 23\/25/.test(app()), 'jawaban tampil rapi (tebal, daftar) + sisa kuota');
  ok(w.aiFormat('<img src=x onerror=alert(1)>').indexOf('<img')===-1, 'jawaban AI di-escape (aman dari HTML berbahaya)');
  w.STATE.aiChat = null; ok(w.aiChatLoad().length===2, 'riwayat obrolan tersimpan di perangkat');
  reply = {ok:false, error:'Batas pemakaian AI hari ini sudah habis (25x). Coba lagi besok.'};
  d.getElementById('ai_input').value = 'halo'; d.querySelector('[data-action="ai-send"]').dispatchEvent(new w.MouseEvent('click', {bubbles:true})); await sleep(40);
  ok(/sudah habis/.test(d.querySelector('.ai-msg.err').textContent), 'batas habis: pesan jelas di obrolan');
  w.SESSION = {role:'hod', empId:'H1'}; w.STATE.aiChat = null; w.render();
  reply = {ok:true, text:'ok', model:'m', used:1, limit:25};
  w.aiSend('siapa belum absen?'); await sleep(40);
  ok(/Tim saya/.test(calls[calls.length-1].body.context) && /Sari Ayu — kerja 08:00–17:00, belum absen/.test(calls[calls.length-1].body.context) && /Menunggu persetujuan saya: 1 cuti/.test(calls[calls.length-1].body.context), 'HOD: konteks status tim & pengajuan yang menunggu');

  console.log('\n[Rapikan dengan AI]');
  w.SESSION = {role:'staff', empId:'S1'}; w.STATE.view = 'leave-request'; w.render();
  var btn = d.querySelector('[data-action="ai-write"][data-target="lr_reason"]');
  ok(!!btn, 'tombol "Rapikan dengan AI" di alasan cuti');
  btn.dispatchEvent(new w.MouseEvent('click', {bubbles:true})); await sleep(20);
  ok(/Tulis poin-poinnya dulu/.test(toasts.join('|')), 'teks kosong: diminta menulis dulu');
  d.getElementById('lr_reason').value = 'acara nikahan sodara di blitar';
  reply = {ok:true, text:'"Mohon izin cuti untuk menghadiri pernikahan saudara di Blitar."', model:'gemini-3.1-flash-lite', used:3, limit:25};
  btn.dispatchEvent(new w.MouseEvent('click', {bubbles:true})); await sleep(40);
  ok(calls[calls.length-1].body.task==='tulis' && calls[calls.length-1].body.kind==='leave' && d.getElementById('lr_reason').value==='Mohon izin cuti untuk menghadiri pernikahan saudara di Blitar.', 'teks dirapikan (tanpa tanda kutip)');
  d.querySelector('[data-action="ai-undo"][data-target="lr_reason"]').dispatchEvent(new w.MouseEvent('click', {bubbles:true})); await sleep(10);
  ok(d.getElementById('lr_reason').value==='acara nikahan sodara di blitar', 'Urungkan mengembalikan teks asli');
  w.STATE.view = 'overtime-request'; w.render();
  ok(!!d.querySelector('[data-action="ai-write"][data-target="ot_desc"]'), 'juga di uraian lembur');
  w.SESSION = {role:'hr', empId:null, hrAccountId:null}; w.STATE.view = 'banners'; w.render();
  ok(!!d.querySelector('[data-target="bn_title"]') && !!d.querySelector('[data-target="bn_sub"]'), 'juga di judul & teks banner');

  console.log('\n[Insight AI]');
  w.STATE.view = 'dashboard'; w.render();
  ok(/Insight AI/.test(app()) && !!d.querySelector('[data-action="ai-insight"][data-scope="hr"]'), 'dashboard HR: kartu Insight AI (tidak otomatis memakai kuota)');
  reply = {ok:true, text:'Kehadiran baik.\n**Perlu perhatian**\n- Telat Marketing', model:'m', used:4, limit:25};
  d.querySelector('[data-action="ai-insight"]').dispatchEvent(new w.MouseEvent('click', {bubbles:true})); await sleep(40);
  ok(calls[calls.length-1].body.task==='insight' && /Departemen Marketing \(3 org\)/.test(calls[calls.length-1].body.context) && /Kehadiran baik/.test(d.querySelector('.ai-insight').textContent), 'ringkasan dibuat dari statistik per departemen & disimpan');
  w.SESSION = {role:'hod', empId:'H1'}; w.render();
  ok(!!d.querySelector('[data-action="ai-insight"][data-scope="hod"]'), 'dashboard HOD: Insight AI Tim');

  console.log('\n[Saran Jadwal AI]');
  w.STATE.view = 'schedule'; w.render();
  var sb = d.querySelector('[data-action="ai-schedule"]');
  ok(!!sb, 'tombol Saran Jadwal AI di Atur Jadwal Tim');
  reply = function(b){ return {ok:true, model:'m', used:5, limit:25, text:JSON.stringify({catatan:'Libur disebar merata.', jadwal:{S1:{'1':'09:00-18:00','2':'08:00-17:00','3':'L'}, S2:{'2':'L','3':'8:00-17:00'}, X9:{'2':'L'}}})}; };
  sb.dispatchEvent(new w.MouseEvent('click', {bubbles:true})); await sleep(50);
  var cb = calls[calls.length-1].body;
  ok(cb.task==='jadwal' && /S1 \| Sari Ayu/.test(cb.context) && /Sudah terisi bulan ini \(jangan diubah\): 1=libur/.test(cb.context), 'konteks: anggota tim, pola bulan lalu, tanggal yang sudah terisi');
  var P = w.STATE.aiSchedPlan;
  ok(P && P.count===4 && !P.plan.S1[1] && P.plan.S1[2].start==='08:00' && P.plan.S2[3].start==='08:00' && !P.plan.X9, 'hanya tanggal kosong & anggota tim yang diambil (hari terisi tidak ditimpa)');
  ok(!!d.querySelector('.ai-sched') && /Libur disebar merata/.test(d.getElementById('modalRoot').textContent), 'pratinjau jadwal sebelum diterapkan');
  d.querySelector('[data-action="ai-schedule-apply"]').dispatchEvent(new w.MouseEvent('click', {bubbles:true})); await sleep(30);
  ok(w.DB.schedules[ym].S1[1].type==='libur' && w.DB.schedules[ym].S1[2].type==='kerja' && w.DB.schedules[ym].S2[2].type==='libur', 'jadwal diterapkan; yang sudah ada tetap');
  ok(w.aiParseSchedule('bukan json', [], ym)===null, 'jawaban AI rusak ditolak dengan aman');

  console.log('\n[Nonaktif]');
  w.DB.settings.ai.enabled = false; w.render();
  ok(!d.querySelector('[data-action="ai-schedule"]') && !w.navItemsFor('hod').some(function(it){ return it.v==='ai-assistant'; }), 'saat dinonaktifkan HR: semua fitur AI tersembunyi');

  console.log('\nHASIL: '+pass+' lulus, '+fail+' gagal'); process.exit(fail ? 1 : 0);
})();

/* Tes: target jam kerja mengikuti durasi shift, chat kamera & video, Enter = baris baru, banner tanpa bayangan gelap. */
var fs = require('fs'), path = require('path'), JSDOM = require('jsdom').JSDOM;
var html = fs.readFileSync(path.join(__dirname, '..', 'web', 'index.html'), 'utf8')
  .replace(/var SUPABASE_URL = '[^']*'/, "var SUPABASE_URL = ''").replace(/var SUPABASE_ANON_KEY = '[^']*'/, "var SUPABASE_ANON_KEY = ''")
  .replace(/var PUSH_FUNCTION_URL = '[^']*'/, "var PUSH_FUNCTION_URL = ''").replace(/var EMAIL_FUNCTION_URL = '[^']*'/, "var EMAIL_FUNCTION_URL = ''");
var pass = 0, fail = 0;
function ok(c, n){ if(c){ pass++; console.log('  ok   - '+n); } else { fail++; console.log('  FAIL - '+n); } }
function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
(async function(){
  var dom = new JSDOM(html, {url:'https://abcselaras.my.id/web/', runScripts:'dangerously', pretendToBeVisual:true});
  var w = dom.window; w.console.error = function(){}; w.scrollTo = function(){}; await sleep(400);
  var d = w.document; function app(){ return d.getElementById('app').textContent; }
  w.saveDB = function(){ return Promise.resolve(); };
  w.DB.employees = [{id:'S1', empCode:'S1', name:'Sari Ayu', username:'sari', department:'Marketing', position:'Staff', active:true},
                    {id:'K1', empCode:'K1', name:'Kiki', username:'kiki', department:'Kitchen', position:'Cook', active:true}];
  var ym = '2026-11'; w.DB.schedules[ym] = {S1:{}, K1:{}}; w.DB.attendance[ym] = {S1:{}, K1:{}};

  console.log('\n[Target jam kerja mengikuti shift]');
  ok(w.shiftTargetMin({type:'kerja', start:'09:00', end:'13:00'})===240 && w.shiftTargetMin({type:'kerja', start:'09:00', end:'14:00'})===300, 'shift 4 jam / 5 jam -> target 4 / 5 jam');
  ok(w.shiftTargetMin({type:'kerja', start:'09:00', end:'17:00'})===480 && w.shiftTargetMin({type:'kerja', start:'08:00', end:'17:00'})===480, 'shift penuh tetap 8 jam');
  ok(w.shiftTargetMin({type:'kerja', start:'22:00', end:'03:00'})===300, 'shift malam lintas hari dihitung benar');
  w.DB.schedules[ym].S1[1] = {type:'kerja', start:'09:00', end:'14:00'};
  w.DB.attendance[ym].S1[1] = {checkIn:'09:30', checkOut:'14:40'};
  var m = w.getMatchDay('S1', ym, 1);
  ok(m.status==='hadir' && m.flex && m.flex.targetMin===300 && m.flex.covered, 'jam fleksibel: masuk +30 mnt, kerja 5j10m pada shift 5 jam -> tidak telat');
  ok(/5 jam terpenuhi/.test(w.flexNoteHtml(m)) && !/8 jam/.test(w.flexNoteHtml(m)), 'keterangan "5 jam terpenuhi" (bukan 8 jam)');
  w.DB.attendance[ym].S1[1] = {checkIn:'09:30', checkOut:'14:00'};
  m = w.getMatchDay('S1', ym, 1);
  ok(m.status==='telat' && /kurang dari 5 jam/.test(w.flexNoteHtml(m)), 'kurang dari 5 jam -> tetap telat, keterangan sesuai');
  var st = w.workTimerState('09:00', '14:05', 300);
  ok(st.phase==='target' && st.ot===360, 'timer: 5 jam tercapai; lembur mulai setelah 6 jam');
  ok(w.workTimerState('09:00', '15:10', 300).phase==='overtime' && w.workTimerState('09:00', '15:10', 480).phase==='work', 'shift pendek: lewat 6 jam = lembur; shift penuh belum');
  w.SESSION = {role:'staff', empId:'S1'};
  var body = w.workTimerBodyHtml(w.workTimerState('09:00','14:05',300), '09:00', '14:05', ym+'-01', true);
  ok(/5 jam terpenuhi/.test(body) && !/8 jam/.test(body), 'kartu durasi kerja menyebut 5 jam');
  ok(w.targetMinFor('S1', ym+'-01')===300 && w.targetMinFor('S1', ym+'-02')===480, 'target per tanggal dari jadwal (tanpa jadwal = 8 jam)');

  console.log('\n[Chat: kamera, video, Enter]');
  ok(/id="chatCamFile" accept="image\/\*" capture="environment"/.test(html) && /id="chatVidCamFile" accept="video\/\*" capture="environment"/.test(html) && /id="chatGalFile" accept="image\/\*,video\/\*"/.test(html), 'input kamera foto, rekam video, dan galeri foto+video');
  ok(/data-action="chat-camera"/.test(html) && /Rekam video/.test(html) && /Galeri foto & video/.test(html), 'tombol kamera + menu lampiran (kamera, rekam video, galeri, dokumen)');
  var vm = {id:9, file_key:'chatfile_x.mp4', file_name:'rekaman.mp4', file_type:'video/mp4', body:''};
  ok(w.chatIsVideoMsg(vm) && /<video controls playsinline/.test(w.chatVideoHtml(vm)) && w.chatPreview(vm)==='🎬 Video', 'pesan video diputar langsung di chat (bukan kartu berkas)');
  ok(!w.chatIsVideoMsg({file_key:'a.pdf', file_name:'a.pdf', file_type:'application/pdf'}), 'berkas biasa tetap kartu berkas');
  ok(w.CHAT_VIDEO_MAX===50*1024*1024, 'batas video 50MB');
  var ev = new w.KeyboardEvent('keydown', {key:'Enter', bubbles:true, cancelable:true});
  var ta = d.createElement('textarea'); ta.id = 'chatInput'; d.body.appendChild(ta);
  var sent = 0; w.chatSend = function(){ sent++; return Promise.resolve(true); };
  ta.dispatchEvent(ev);
  ok(!ev.defaultPrevented && sent===0, 'Enter = baris baru, pesan tidak langsung terkirim');
  var ev2 = new w.KeyboardEvent('keydown', {key:'Enter', ctrlKey:true, bubbles:true, cancelable:true}); ta.dispatchEvent(ev2);
  ok(sent===1, 'Ctrl+Enter (laptop) tetap bisa kirim');

  console.log('\n[Banner tanpa bayangan menutupi]');
  w.DB.banners = [{id:'B1', active:true, imageUrl:'https://x/banner.png', title:'', subtitle:''}, {id:'B2', active:true, imageUrl:'https://x/b2.png', title:'Promo', subtitle:''}];
  w.STATE.view = 'dashboard'; w.render();
  var b1 = d.querySelector('.banner-slide[data-bn-plain]'), b2 = Array.prototype.filter.call(d.querySelectorAll('.banner-slide'), function(x){ return !x.hasAttribute('data-bn-plain'); })[0];
  ok(b1 && !/gradient/.test(b1.getAttribute('style')) && !b1.querySelector('.dash-banner-title'), 'banner gambar tanpa judul: tidak ada bayangan gelap sama sekali');
  ok(b2 && /rgba\(0,0,0,\.42\)/.test(b2.getAttribute('style')) && !/\.68/.test(b2.getAttribute('style')), 'banner dengan judul: bayangan tipis di sisi teks saja');
  ok(!/box-shadow:0 8px 24px -4px rgba\(55,75,255,\.2\)/.test(html), 'bayangan ungu di bawah banner dihapus');

  console.log('\nHASIL: '+pass+' lulus, '+fail+' gagal'); process.exit(fail ? 1 : 0);
})();

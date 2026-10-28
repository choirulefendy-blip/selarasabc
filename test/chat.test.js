/* Tes foto profil, sidebar, dan chat. Jalankan: node chat.test.js */
var fs = require('fs'), path = require('path');
var JSDOM = require('jsdom').JSDOM;
var html = fs.readFileSync(path.join(__dirname, '..', 'web', 'index.html'), 'utf8')
  .replace(/var SUPABASE_URL = '[^']*'/, "var SUPABASE_URL = ''")
  .replace(/var SUPABASE_ANON_KEY = '[^']*'/, "var SUPABASE_ANON_KEY = ''")
  .replace(/var PUSH_FUNCTION_URL = '[^']*'/, "var PUSH_FUNCTION_URL = ''")
  .replace(/var EMAIL_FUNCTION_URL = '[^']*'/, "var EMAIL_FUNCTION_URL = ''");
var pass = 0, fail = 0, failures = [];
function ok(c, n){ if(c){ pass++; console.log('  ok   - '+n); } else { fail++; failures.push(n); console.log('  FAIL - '+n); } }
function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
function boot(){
  var dom = new JSDOM(html, {url:'https://abc-selaras.test/', runScripts:'dangerously', pretendToBeVisual:true});
  var w = dom.window; w.confirm = function(){ return true; }; w.scrollTo = function(){}; w.console.error = function(){};
  return sleep(400).then(function(){ return w; });
}
function click(w, action, attrs){
  var sel = '[data-action="'+action+'"]';
  if(attrs) Object.keys(attrs).forEach(function(k){ sel += '[data-'+k+'="'+attrs[k]+'"]'; });
  var el = w.document.querySelector(sel);
  if(!el) throw new Error('Elemen tidak ditemukan: '+sel);
  el.dispatchEvent(new w.MouseEvent('click', {bubbles:true}));
  return sleep(120);
}
function text(w){ return w.document.getElementById('app').textContent; }
function mkEmp(id, name, dept, user){
  return {id:id, empCode:'ABC-T-'+id, name:name, position:'Staff', department:dept, properties:[], joinDate:'2025-01-01', dateOfBirth:'1995-01-01', gender:'Laki-laki',
    baseSalary:3000000, mealAllowance:0, transportAllowance:0, address:'', phone:'', email:'', username:user, password:'pw', active:true, bpjsKesehatanActive:true, bpjsKetenagakerjaanActive:true};
}
function login(w, who){
  w.SESSION = who==='hr' ? {role:'hr', empId:null, hrAccountId:null} : {role: who==='E2' ? 'hod' : 'staff', empId:who};
  w.STATE.view = 'dashboard'; w.STATE.chatWith = null; w.render(); return sleep(80);
}
function typeInto(w, id, v){ var e = w.document.getElementById(id); e.value = v; e.dispatchEvent(new w.Event('input', {bubbles:true})); }

(async function(){
  var w = await boot();
  w.DB.employees.push(mkEmp('E1','Budi Staff','Marketing Communication','budi'), mkEmp('E2','Sari HOD','Marketing Communication','sari'), mkEmp('E3','Dewi Front','Front Office','dewi'));
  w.DB.departmentHods['Marketing Communication'] = ['E2'];
  w.compressSquare = function(){ return Promise.resolve('data:image/jpeg;base64,/9j/AAAA'); };   /* jsdom tanpa canvas */

  console.log('\n[Foto profil]');
  await login(w, 'E1');
  ok(!!w.document.querySelector('button.dash-profile-avatar') && w.document.querySelector('.dash-profile-avatar').textContent.trim()==='BS', 'dashboard menampilkan inisial bila belum ada foto');
  await click(w, 'nav', {view:'my-profile'});
  ok(text(w).indexOf('Tambah Foto')!==-1, 'Staff: halaman Profil Saya terbuka');
  async function pick(empId, size, type){
    var btn = w.document.querySelector('[data-action="choose-photo"][data-emp="'+empId+'"]');
    if(btn){ await click(w, 'choose-photo', {emp:empId}); } else { w.STATE.photoTarget = empId; }
    var input = w.document.getElementById('photoFile');
    var f = new w.File(['x'], 'foto.jpg', {type:type||'image/jpeg'});
    Object.defineProperty(f, 'size', {value:size||1000});
    Object.defineProperty(input, 'files', {value:[f], configurable:true});
    input.dispatchEvent(new w.Event('change', {bubbles:true}));
    await sleep(250);
  }
  await pick('E1');
  var e1 = w.getEmployee('E1');
  ok(!!e1.photoKey, 'Staff: foto profil tersimpan');
  ok(text(w).indexOf('Ganti Foto')!==-1 && text(w).indexOf('Hapus Foto')!==-1, 'tombol berubah jadi Ganti/Hapus Foto');
  await login(w, 'E1');
  await sleep(200);
  ok(!!w.document.querySelector('.dash-profile-avatar img'), 'dashboard menampilkan foto setelah diunggah');
  ok(!!w.document.querySelector('.sidebar-user .avatar img'), 'menu samping menampilkan foto');
  await pick('E3');
  ok(!w.getEmployee('E3').photoKey, 'Staff tidak bisa mengubah foto orang lain');
  await pick('E1', 20*1024*1024);
  var keyBefore = e1.photoKey;
  ok(e1.photoKey===keyBefore, 'foto > 8MB ditolak (foto lama tetap)');
  await login(w, 'hr'); await click(w, 'nav', {view:'employees'});
  await pick('E3');
  ok(!!w.getEmployee('E3').photoKey, 'HR: bisa menambah foto karyawan dari daftar Karyawan');
  ok(w.document.querySelectorAll('#app .avatar img').length>=2, 'HR: daftar karyawan menampilkan foto');
  await click(w, 'remove-photo', {emp:'E3'});
  ok(!w.getEmployee('E3').photoKey, 'HR: bisa menghapus foto karyawan');

  console.log('\n[Sembunyikan sidebar]');
  await login(w, 'E1');
  w.innerWidth = 1280;
  ok(!w.document.querySelector('.shell.sidebar-collapsed'), 'awalnya sidebar tampil');
  await click(w, 'toggle-sidebar');
  ok(!!w.document.querySelector('.shell.sidebar-collapsed'), 'desktop: sidebar bisa disembunyikan');
  ok(w.localStorage.getItem('abcSelarasSidebarHidden')==='1', 'pilihan disimpan');
  await click(w, 'toggle-sidebar');
  ok(!w.document.querySelector('.shell.sidebar-collapsed'), 'desktop: sidebar bisa ditampilkan lagi');
  w.innerWidth = 400;
  await click(w, 'toggle-sidebar');
  ok(w.STATE.sidebarOpen===true && !w.document.querySelector('.shell.sidebar-collapsed'), 'mobile: tetap pakai drawer');
  w.innerWidth = 1280; w.STATE.sidebarOpen = false;

  console.log('\n[Chat]');
  await login(w, 'E1'); await click(w, 'nav', {view:'chat'});
  ok(text(w).indexOf('Sari HOD')!==-1 && text(w).indexOf('Dewi Front')!==-1 && w.document.querySelector('[data-peer="hr"]'), 'Staff: daftar kontak = HR + semua karyawan');
  ok(!w.document.querySelector('[data-peer="E1"]'), 'tidak bisa chat dengan diri sendiri');
  await click(w, 'chat-open', {peer:'E3'});
  typeInto(w, 'chatInput', 'Halo Dewi, jadwal besok aman?');
  await click(w, 'chat-send'); await sleep(150);
  ok(text(w).indexOf('Halo Dewi, jadwal besok aman?')!==-1, 'pesan terkirim dan tampil di thread');
  ok(w.document.getElementById('chatInput').value==='', 'kolom ketik dikosongkan');
  typeInto(w, 'chatInput', '   '); await click(w, 'chat-send');
  ok(w.CHAT.msgs.length===1, 'pesan kosong tidak terkirim');
  typeInto(w, 'chatInput', '<img src=x onerror=alert(1)>'); await sleep(450); await click(w, 'chat-send'); await sleep(150);
  ok(!w.document.querySelector('.chat-bubble img') && text(w).indexOf('<img src=x')!==-1, 'isi pesan di-escape (aman dari HTML/XSS)');
  /* penerima */
  await login(w, 'E3'); await sleep(100);
  await w.chatPoll(); await sleep(50);
  ok(w.chatUnreadTotal()===2, 'Dewi: 2 pesan belum dibaca');
  w.render(); await sleep(50);
  ok(!!w.document.querySelector('.nav-item[data-view="chat"] .nav-badge') && w.document.querySelector('.nav-item[data-view="chat"] .nav-badge').textContent==='2', 'badge belum dibaca muncul di menu Chat');
  await click(w, 'nav', {view:'chat'});
  ok(w.document.querySelector('.chat-item[data-peer="E1"] .chat-unread'), 'daftar chat menandai percakapan belum dibaca');
  await click(w, 'chat-open', {peer:'E1'});
  ok(text(w).indexOf('Halo Dewi, jadwal besok aman?')!==-1, 'Dewi: membaca pesan dari Budi');
  ok(w.chatUnreadTotal()===0 && !w.document.querySelector('.nav-item[data-view="chat"] .nav-badge'), 'membuka percakapan menandai sudah dibaca');
  typeInto(w, 'chatInput', 'Aman Bud, sudah saya cek.'); await sleep(450);
  await click(w, 'chat-send'); await sleep(150);
  /* privasi: pihak ketiga tidak bisa melihat */
  await login(w, 'E2'); await w.chatPoll();
  ok(w.CHAT.msgs.length===0, 'pihak ketiga (HOD) tidak menerima pesan percakapan orang lain');
  /* HR ke staf */
  await login(w, 'hr'); await click(w, 'nav', {view:'chat'});
  ok(!w.document.querySelector('[data-peer="hr"]') && w.document.querySelector('[data-peer="E1"]'), 'HR: kontak = semua karyawan');
  await click(w, 'chat-open', {peer:'E1'});
  typeInto(w, 'chatInput', 'Bud, tolong kirim laporan.'); await sleep(450);
  w.document.getElementById('chatInput').dispatchEvent(new w.KeyboardEvent('keydown', {key:'Enter', bubbles:true})); await sleep(150);
  ok(text(w).indexOf('Bud, tolong kirim laporan.')!==-1, 'HR: kirim dengan tombol Enter');
  /* balasan notifikasi */
  await login(w, 'E1'); await w.chatPoll(); await sleep(50);
  ok(w.chatUnreadTotal()===2, 'Budi: 2 pesan masuk (Dewi dan HR)');
  /* preferensi */
  w.SESSION = {role:'staff', empId:'E1'};
  ok(w.notifAllowed({type:'emp', empId:'E1'}, 'chat')===true, 'notifikasi chat aktif secara default');
  w.setNotifPref({type:'emp', empId:'E1'}, 'chat', false);
  ok(w.notifAllowed({type:'emp', empId:'E1'}, 'chat')===false, 'notifikasi chat bisa dimatikan per akun');
  /* pencarian */
  await click(w, 'nav', {view:'chat'});
  typeInto(w, 'chatSearch', 'dew');
  ok(w.document.querySelectorAll('.chat-item').length===1 && w.document.querySelector('.chat-item').textContent.indexOf('Dewi')!==-1, 'pencarian nama memfilter kontak');

  console.log('\n[Chat ke server Supabase (fetch tiruan)]');
  var calls = [], store = [], nid = 1;
  w.fetch = function(url, opts){
    calls.push({url:String(url), method:(opts&&opts.method)||'GET', body:opts&&opts.body});
    var u = String(url);
    if(u.indexOf('/rest/v1/chat_messages')===-1) return Promise.resolve({ok:false, status:500});
    if(opts && opts.method==='POST'){
      var rows = JSON.parse(opts.body).map(function(r){ r.id = nid++; r.created_at = new Date().toISOString(); store.push(r); return r; });
      return Promise.resolve({ok:true, status:201, json:function(){ return Promise.resolve(rows); }});
    }
    var m = /id=gt\.(\d+)/.exec(u); var after = m ? parseInt(m[1],10) : 0;
    return Promise.resolve({ok:true, status:200, json:function(){ return Promise.resolve(store.filter(function(r){ return r.id>after; })); }});
  };
  w.SUPABASE_URL = 'https://x.supabase.co'; w.SUPABASE_ANON_KEY = 'anon';
  w.chatRemote = function(){ return true; };
  await login(w, 'E1'); w.chatReset(); await w.chatPoll();
  w.STATE.view = 'chat'; w.STATE.chatWith = 'E3';
  w.render(); typeInto(w, 'chatInput', 'via server'); await sleep(450); await click(w, 'chat-send'); await sleep(150);
  var post = calls.filter(function(c){ return c.method==='POST'; })[0];
  ok(post && post.url.indexOf('/rest/v1/chat_messages')!==-1 && JSON.parse(post.body)[0].recipient==='E3' && JSON.parse(post.body)[0].sender==='E1', 'kirim memakai POST ke tabel chat_messages');
  var get = calls.filter(function(c){ return c.method==='GET'; })[0];
  ok(get && decodeURIComponent(get.url).indexOf('or=(sender.eq.E1,recipient.eq.E1)')!==-1, 'ambil pesan hanya milik akun yang login');
  ok(text(w).indexOf('via server')!==-1, 'pesan dari server tampil');
  /* tabel belum dibuat */
  w.fetch = function(){ return Promise.resolve({ok:false, status:404}); };
  w.chatReset(); w.CHAT.me = null;
  w.STATE.view = 'chat'; w.render(); await sleep(150);
  await w.chatPoll(); await sleep(100);
  ok(text(w).indexOf('Fitur chat belum aktif')!==-1, 'tabel belum ada -> pesan jelas untuk admin');

  console.log('\n[Smoke semua halaman]');
  w.chatRemote = function(){ return false; }; w.chatReset();
  var errs = [];
  for(var r of ['hr','E2','E1']){
    await login(w, r);
    var views = w.navItemsFor(w.SESSION.role).map(function(i){ return i.v; });
    for(var i=0;i<views.length;i++){
      w.STATE.view = views[i];
      try{ w.render(); }catch(e){ errs.push(r+':'+views[i]+' '+e.message); }
      if(text(w).trim().length < 20) errs.push(r+':'+views[i]+' kosong');
    }
  }
  ok(errs.length===0, 'semua halaman semua peran dirender tanpa error'+(errs.length?' -> '+errs.slice(0,3).join(' | '):''));
  console.log('\nHASIL: '+pass+' lulus, '+fail+' gagal');
  if(fail){ console.log(' - '+failures.join('\n - ')); process.exit(1); }
  process.exit(0);
})().catch(function(e){ console.error('TES CRASH', e); process.exit(2); });

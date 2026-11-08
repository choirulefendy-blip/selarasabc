/* Tes: akun HR terpisah di chat, tautan di chat bisa diketuk. */
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
  var d = w.document;
  w.saveDB = function(){ return Promise.resolve(); };
  w.DB.employees = [{id:'S1', name:'Sari Ayu', username:'sari', department:'Marketing', position:'Staff', active:true},
                    {id:'IL', name:'Ilin', username:'ilin', department:'Front Office', position:'FO', active:true, hrAccess:true}];
  w.DB.hr.name = 'Dewi HR';
  w.DB.hrAccounts = [{id:'A1', name:'Rina HR', username:'rina'}, {id:'A2', name:'Tono HR', username:'tono'}];

  console.log('\n[Identitas chat HR terpisah]');
  w.SESSION = {role:'hr', empId:null, hrAccountId:null}; ok(w.chatMe()==='hr', 'HR utama = "hr"');
  w.SESSION = {role:'hr', empId:null, hrAccountId:'A1'}; ok(w.chatMe()==='hra:A1', 'akun HR tambahan punya identitas sendiri (hra:A1)');
  w.SESSION = w.hrModeSession(w.getEmployee('IL')); ok(w.chatMe()==='IL', 'karyawan ber-akses HR (Mode HR) chat sebagai dirinya sendiri');

  console.log('\n[Daftar kontak]');
  w.SESSION = {role:'staff', empId:'S1'}; w.chatReset(); w.chatEnsureIdentity();
  var peers = w.chatPeers(), ids = peers.map(function(p){ return p.id; });
  ok(ids.indexOf('hr')!==-1 && ids.indexOf('hra:A1')!==-1 && ids.indexOf('hra:A2')!==-1, 'staf melihat tiap akun HR sebagai kontak terpisah');
  ok(peers.filter(function(p){ return p.id==='hr'; })[0].name==='Dewi HR' && w.chatPeerName('hra:A1')==='Rina HR', 'nama kontak HR sesuai nama akun');
  w.SESSION = {role:'hr', empId:null, hrAccountId:'A1'}; w.chatEnsureIdentity();
  ids = w.chatPeers().map(function(p){ return p.id; });
  ok(ids.indexOf('hra:A1')===-1 && ids.indexOf('hr')!==-1 && ids.indexOf('hra:A2')!==-1 && ids.indexOf('S1')!==-1, 'akun HR bisa chat ke HR lain & karyawan (bukan ke dirinya sendiri)');

  console.log('\n[Kirim & terima antar akun HR]');
  w.chatSend = w.chatSend; w.STATE.view = 'chat'; w.STATE.chatWith = 'hra:A2'; w.render();
  d.getElementById('chatInput').value = 'Tono, cek rekap lembur ya';
  await w.chatSend(); await sleep(50);
  var all = JSON.parse(w.localStorage.getItem('abcChatLocal')||'[]'), last = all[all.length-1];
  ok(last && last.sender==='hra:A1' && last.recipient==='hra:A2' && !/HRN:/.test(last.body), 'pesan Rina -> Tono tersimpan dengan pengirim & penerima masing-masing');
  w.SESSION = {role:'hr', empId:null, hrAccountId:'A2'}; w.chatEnsureIdentity(); await w.chatFetch('hra:A2', 0).then(function(r){ w.chatMergeRows(r); });
  ok(w.chatVisible().some(function(m){ return m.body==='Tono, cek rekap lembur ya'; }), 'Tono menerima pesan Rina');
  w.SESSION = {role:'hr', empId:null, hrAccountId:null}; w.chatEnsureIdentity(); await w.chatFetch('hr', 0).then(function(r){ w.chatMergeRows(r); });
  ok(!w.chatVisible().some(function(m){ return m.body==='Tono, cek rekap lembur ya'; }), 'HR utama tidak ikut membaca percakapan Rina & Tono');
  var pushed = []; w.pushConfigured = function(){ return true; }; w.PUSH_FUNCTION_URL = 'x';
  w.fetch = function(u, o){ pushed.push(JSON.parse(o.body)); return Promise.resolve({ok:true}); };
  w.triggerPush(w.chatAudience('hra:A2'), 'Pesan dari Rina: rahasia', 'chat');
  ok(pushed[0] && !/rahasia/.test(pushed[0].body) && /Tono HR/.test(pushed[0].body), 'notifikasi ke akun HR tertentu tidak menampilkan isi pesan (perangkat HR dipakai bersama)');

  console.log('\n[Tautan bisa diketuk]');
  var h = w.linkifyHtml('Cek https://abchospitality.co.id/article/, www.google.com dan email hr@abc.co.id atau WA 0812-3456-7890. <b>x</b>');
  ok(/<a class="chat-link" href="https:\/\/abchospitality\.co\.id\/article\/"[^>]*target="_blank"/.test(h) && /\/article\/<\/a>,/.test(h), 'URL jadi tautan (tanda koma di akhir tidak ikut)');
  ok(/href="https:\/\/www\.google\.com"/.test(h) && /href="mailto:hr@abc\.co\.id"/.test(h) && /href="tel:081234567890"/.test(h), 'www., email, dan nomor HP jadi tautan');
  ok(/&lt;b&gt;x&lt;\/b&gt;/.test(h) && w.linkifyHtml('javascript:alert(1)').indexOf('<a')===-1, 'HTML tetap di-escape; javascript: tidak jadi tautan');
  w.SESSION = {role:'staff', empId:'S1'}; w.chatEnsureIdentity(); w.STATE.chatWith = 'hr';
  w.CHAT.msgs.push({id:999, sender:'hr', recipient:'S1', body:'Info: https://abcselaras.my.id', created_at:new Date().toISOString(), kind:'msg'});
  w.render();
  var a = d.querySelector('.chat-text a.chat-link');
  ok(a && a.getAttribute('href')==='https://abcselaras.my.id' && a.getAttribute('rel')==='noopener noreferrer', 'tautan tampil di gelembung chat');

  console.log('\nHASIL: '+pass+' lulus, '+fail+' gagal'); process.exit(fail ? 1 : 0);
})();

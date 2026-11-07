/* Tes: tombol aksi tabel di HP berderet, warna status/navigation bar Android menyatu, Panduan & FAQ menggantikan "Yang Baru". */
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
  function app(){ return d.getElementById('app').textContent; }
  w.DB.employees = [
    {id:'S1', empCode:'ABC-23-0606-002', name:'Afrizal Tegar Saputra', username:'sueb', department:'Marketing', position:'Content Creator', properties:['ABC Group'], baseSalary:2050000, active:true},
    {id:'H1', empCode:'ABC-22-0101-001', name:'Moch Choirul Efendi', username:'fendy', department:'Marketing', position:'HOD', properties:['ABC Group'], baseSalary:3000000, active:true}];

  console.log('\n[Tabel karyawan versi HP: tombol aksi berderet]');
  w.SESSION = {role:'hr', empId:null, hrAccountId:null}; w.STATE.view = 'employees'; w.render(); await sleep(30);
  var act = d.querySelectorAll('table.mob-stack-table td.mob-act-cell');
  ok(act.length>=2 && act[0].querySelectorAll('button, a.btn').length>=4, 'sel Aksi ditandai mob-act-cell (berisi banyak tombol)');
  ok(/td\.mob-act-cell\{grid-column:1 \/ -1;flex-direction:row !important;flex-wrap:wrap/.test(html), 'CSS: tombol aksi berderet & membungkus, bukan menumpuk');
  var single = Array.prototype.filter.call(d.querySelectorAll('table.mob-stack-table td'), function(td){ return td.querySelectorAll('button, a.btn').length===1; });
  ok(single.every(function(td){ return !td.classList.contains('mob-act-cell'); }), 'sel dengan satu tombol tidak diubah');

  console.log('\n[Android: status bar & navigation bar menyatu dengan latar]');
  var calls = [];
  w.Capacitor = {isNativePlatform:function(){ return true; }, getPlatform:function(){ return 'android'; }, Plugins:{AbcBars:{set:function(o){ calls.push(o); return Promise.resolve(); }}}};
  w.setDarkMode(false); await sleep(30);
  var last = calls[calls.length-1] || {};
  ok(/^#[0-9A-F]{6}$/i.test(last.color||'') && last.color.toUpperCase()!=='#000000' && parseInt(last.color.slice(1,3),16)>200 && last.dark===false, 'mode terang: warna latar dikirim ke plugin AbcBars ('+last.color+')');
  ok(d.documentElement.classList.contains('native-app'), 'APK: latar polos (kelas native-app) agar warna sama persis');
  ok((d.querySelector('meta[name="theme-color"]')||{}).content===last.color, 'meta theme-color ikut warna latar');
  w.setDarkMode(true); await sleep(30);
  var lastD = calls[calls.length-1] || {};
  ok(lastD.dark===true && lastD.color && lastD.color!==last.color, 'mode gelap: warna gelap + ikon bar terang ('+lastD.color+')');
  ok(w.cssColorToHex('rgba(0, 0, 0, 0)')==='' && w.cssColorToHex('rgb(245, 246, 252)')==='#F5F6FC' && w.cssColorToHex(' #14141A')==='#14141A', 'konversi warna: transparan diabaikan, rgb & hex benar');
  w.setDarkMode(false);
  var java = fs.readFileSync(path.join(__dirname,'..','mobile','android','app','src','main','java','id','abchospitality','selaras','MainActivity.java'),'utf8');
  var plug = fs.readFileSync(path.join(__dirname,'..','mobile','android','app','src','main','java','id','abchospitality','selaras','AbcBarsPlugin.java'),'utf8');
  ok(/registerPlugin\(AbcBarsPlugin\.class\);\s*super\.onCreate/.test(java) && /@CapacitorPlugin\(name = "AbcBars"\)/.test(plug), 'plugin native AbcBars terdaftar sebelum bridge dibuat');
  ok(/getDecorView\(\)\.setBackgroundColor\(color\)/.test(java) && /onConfigurationChanged/.test(java), 'warna celah (decor view) diatur & dipasang ulang saat konfigurasi berubah');

  console.log('\n[Panduan & FAQ menggantikan "Yang Baru"]');
  w.SESSION = {role:'staff', empId:'S1'}; w.STATE.view = 'my-profile'; w.render(); await sleep(30);
  ok(!/Yang Baru/.test(app()) && !d.querySelector('.chg'), 'daftar "Yang Baru" dihapus');
  ok(/Panduan & FAQ/.test(app()) && d.querySelectorAll('.faq-item').length>=10, 'Panduan & FAQ tampil sebagai daftar tanya-jawab');
  ok(/Bagaimana cara absen masuk\?/.test(app()) && /izin tidak masuk kerja/.test(app()), 'FAQ staf: absen & izin tidak masuk kerja');
  ok(!/Bagaimana mengatur jadwal tim\?/.test(app()), 'staf tidak melihat FAQ khusus HOD');
  var first = d.querySelector('.faq-item');
  ok(first && first.querySelectorAll('ol li').length>=4, 'jawaban berupa langkah bernomor (step by step)');
  ok(!!d.querySelector('.faq a[href$="terms.html"]') && !!d.querySelector('.faq a[href$="privacy.html"]'), 'Ketentuan Layanan & Kebijakan Privasi tersedia');
  w.SESSION = {role:'hod', empId:'H1'}; w.isHOD = function(id){ return id==='H1'; }; w.render(); await sleep(30);
  ok(/Bagaimana mengatur jadwal tim\?/.test(app()) && /Ajukan Jadwal Departemen ke HR/.test(d.querySelector('.faq').innerHTML), 'HOD melihat panduan mengatur jadwal tim');
  w.SESSION = {role:'hr', empId:null, hrAccountId:null}; w.STATE.view = 'hr-profile'; w.render(); await sleep(30);
  ok(/Bagaimana menyetujui jadwal, cuti, dan lembur\?/.test(app()) && !/Bagaimana cara absen masuk\?/.test(app()), 'HR melihat panduan khusus HR');

  console.log('\nHASIL: '+pass+' lulus, '+fail+' gagal'); process.exit(fail ? 1 : 0);
})();

/* Tes: informasi perangkat login di setiap akun (catat, tampil, keluarkan, logout otomatis). */
var fs = require('fs'), path = require('path'), JSDOM = require('jsdom').JSDOM;
var html = fs.readFileSync(path.join(__dirname, '..', 'web', 'index.html'), 'utf8')
  .replace(/var SUPABASE_URL = '[^']*'/, "var SUPABASE_URL = ''").replace(/var SUPABASE_ANON_KEY = '[^']*'/, "var SUPABASE_ANON_KEY = ''")
  .replace(/var PUSH_FUNCTION_URL = '[^']*'/, "var PUSH_FUNCTION_URL = ''").replace(/var EMAIL_FUNCTION_URL = '[^']*'/, "var EMAIL_FUNCTION_URL = ''");
var pass = 0, fail = 0;
function ok(c, n){ if(c){ pass++; console.log('  ok   - '+n); } else { fail++; console.log('  FAIL - '+n); } }
function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
(async function(){
  var dom = new JSDOM(html, {url:'https://abcselaras.my.id/web/', runScripts:'dangerously', pretendToBeVisual:true});
  var w = dom.window; w.console.error = function(){}; w.scrollTo = function(){}; w.confirm = function(){ return true; }; await sleep(400);
  var d = w.document; function app(){ return d.getElementById('app').textContent; }
  var saves = 0; w.saveDB = function(){ saves++; return Promise.resolve(); };
  w.DB.employees = [{id:'S1', empCode:'S1', name:'Sari Ayu', username:'sari', password:'rahasia', department:'Marketing', position:'Staff', properties:['Briggs Inn'], active:true}];

  console.log('\n[Deteksi perangkat]');
  var a = w.describeDevice('Mozilla/5.0 (Linux; Android 14; SM-S918B Build/UP1A.231005.007) AppleWebKit/537.36 Chrome/129.0 Mobile Safari/537.36');
  ok(a.os==='Android 14' && a.model==='SM-S918B' && a.browser==='Chrome' && a.mobile, 'Android: model, versi, browser ('+a.label+')');
  var b = w.describeDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1');
  ok(b.os==='iPhone' && b.browser==='Safari', 'iPhone + Safari');
  var c = w.describeDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/129.0 Safari/537.36 Edg/129.0');
  ok(c.os==='Windows' && c.browser==='Edge' && !c.mobile, 'Windows + Edge (laptop)');
  ok(w.describeDevice('Mozilla/5.0 (Linux; Android 13; K) Chrome/129.0 Mobile').model==='', 'UA Android yang disamarkan ("K") tidak dianggap model');

  console.log('\n[Login mencatat perangkat]');
  w.SESSION = {}; w.STATE.view = 'dashboard'; w.STATE.loginTab = 'staff'; w.render();
  d.getElementById('li_staff_user').value = 'sari'; d.getElementById('li_staff_pass').value = 'rahasia';
  w.doStaffLogin(); await sleep(20);
  var me = w.currentDeviceId(), rec = w.DB.loginDevices['emp:S1'][me];
  ok(w.SESSION.empId==='S1' && rec && rec.loginAt && rec.lastAt && rec.label===w.describeDevice().label, 'login staf: perangkat tercatat di akunnya');
  ok(saves>0, 'catatan perangkat disimpan ke server');
  ok(w.sessionAccountKey({role:'hr'})==='hr' && w.sessionAccountKey({role:'hr', hrAccountId:'X'})==='hra:X' && w.sessionAccountKey({role:'hr', asEmpId:'S1'})==='emp:S1', 'kunci akun: HR utama, akun HR tambahan, karyawan ber-akses HR');

  console.log('\n[Kartu Perangkat Login di profil]');
  var old = new Date(Date.now()-2*86400000).toISOString();
  w.DB.loginDevices['emp:S1'].dv_laptop = {label:'Windows · Chrome', os:'Windows', kind:'web', mobile:false, firstAt:old, loginAt:old, lastAt:old};
  w.STATE.view = 'my-profile'; w.render();
  var rows = d.querySelectorAll('.dev-card .dev-row');
  ok(rows.length===2 && /Perangkat ini/.test(rows[0].textContent) && /Aktif sekarang/.test(rows[0].textContent), 'dua perangkat tampil, perangkat ini ditandai & paling atas');
  ok(/Windows · Chrome/.test(rows[1].textContent) && /2 hari lalu/.test(rows[1].textContent), 'perangkat lain: nama & terakhir aktif');
  ok(!rows[0].querySelector('[data-action="device-revoke"]') && !!rows[1].querySelector('[data-action="device-revoke"]'), 'tombol Keluarkan hanya untuk perangkat lain');
  rows[1].querySelector('[data-action="device-revoke"]').dispatchEvent(new w.MouseEvent('click', {bubbles:true})); await sleep(20);
  var lap = w.DB.loginDevices['emp:S1'].dv_laptop;
  ok(lap.revokedAt && lap.revokedBy==='Sari Ayu' && !w.deviceIsActive(lap) && /Dikeluarkan/.test(app()), 'perangkat lain dikeluarkan (tercatat oleh siapa)');

  console.log('\n[Perangkat yang dikeluarkan logout otomatis]');
  var remote = JSON.parse(JSON.stringify({loginDevices:w.DB.loginDevices}));
  remote.loginDevices['emp:S1'][me].revokedAt = new Date(Date.now()+1000).toISOString(); remote.loginDevices['emp:S1'][me].revokedBy = 'HR';
  w.mergeLiveData(remote);
  ok(w.deviceCheckRevoked() && !w.SESSION.role && /dikeluarkan dari perangkat ini/.test(app()), 'saat sinkron: perangkat ini keluar & muncul pesan di halaman login');
  ok(!w.localStorage.getItem('abcSelarasSession'), 'sesi tersimpan dihapus (tidak masuk lagi saat refresh)');
  await sleep(1100);
  d.getElementById('li_staff_user').value = 'sari'; d.getElementById('li_staff_pass').value = 'rahasia'; w.doStaffLogin(); await sleep(20);
  ok(w.SESSION.empId==='S1' && w.deviceIsActive(w.DB.loginDevices['emp:S1'][me]), 'login ulang: perangkat aktif kembali');

  console.log('\n[Sinkron antar perangkat]');
  var L = {x:{label:'A', lastAt:'2026-11-01T00:00:00Z', loginAt:'2026-11-01T00:00:00Z', firstAt:'2026-10-01T00:00:00Z'}};
  w.DB.loginDevices = {'emp:S1': L};
  w.mergeLoginDevices({'emp:S1':{x:{label:'A', lastAt:'2026-10-20T00:00:00Z', loginAt:'2026-10-20T00:00:00Z', revokedAt:'2026-11-02T00:00:00Z', revokedBy:'HR', firstAt:'2026-09-01T00:00:00Z'}, y:{label:'B', lastAt:'2026-11-03T00:00:00Z'}}});
  var X = w.DB.loginDevices['emp:S1'].x;
  ok(X.revokedAt==='2026-11-02T00:00:00Z' && !w.deviceIsActive(X) && X.lastAt==='2026-11-01T00:00:00Z' && X.firstAt==='2026-09-01T00:00:00Z', 'pengeluaran dari perangkat lain tidak hilang saat data digabung');
  ok(!!w.DB.loginDevices['emp:S1'].y, 'perangkat baru dari server ikut masuk');
  for(var i=0;i<14;i++) w.DB.loginDevices['emp:S1']['z'+i] = {label:'Z', lastAt:'2026-0'+(1+i%9)+'-01T00:00:00Z'};
  w.deviceTouch(true);
  ok(Object.keys(w.DB.loginDevices['emp:S1']).length===10 && !!w.DB.loginDevices['emp:S1'][me], 'maksimal 10 perangkat per akun (yang terlama dibuang)');

  console.log('\n[HR melihat perangkat karyawan]');
  w.SESSION = {role:'hr', empId:null, hrAccountId:null}; w.STATE.personId = 'S1'; w.STATE.view = 'person'; w.render();
  ok(!!d.querySelector('.dev-card') && /akun Sari Ayu/.test(d.querySelector('.dev-card').textContent) && !!d.querySelector('.dev-card [data-action="device-revoke-all"]'), 'profil karyawan (HR): daftar perangkat + Keluarkan semua');
  w.STATE.view = 'hr-profile'; w.render();
  ok(!!d.querySelector('.dev-card') && w.DB.loginDevices.hr && w.DB.loginDevices.hr[me], 'akun HR juga punya kartu Perangkat Login');
  w.SESSION = {role:'staff', empId:'S2'}; ok(!w.canManageDevicesOf('emp:S1'), 'staf tidak bisa mengeluarkan perangkat akun orang lain');

  console.log('\nHASIL: '+pass+' lulus, '+fail+' gagal'); process.exit(fail ? 1 : 0);
})();

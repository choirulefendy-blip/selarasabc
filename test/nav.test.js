/* Tes menu samping berkelompok. */
var fs = require('fs'), path = require('path');
var JSDOM = require('jsdom').JSDOM;
var html = fs.readFileSync(path.join(__dirname, '..', 'web', 'index.html'), 'utf8')
  .replace(/var SUPABASE_URL = '[^']*'/, "var SUPABASE_URL = ''").replace(/var SUPABASE_ANON_KEY = '[^']*'/, "var SUPABASE_ANON_KEY = ''")
  .replace(/var PUSH_FUNCTION_URL = '[^']*'/, "var PUSH_FUNCTION_URL = ''").replace(/var EMAIL_FUNCTION_URL = '[^']*'/, "var EMAIL_FUNCTION_URL = ''");
var pass = 0, fail = 0;
function ok(c, n){ if(c){ pass++; console.log('  ok   - '+n); } else { fail++; console.log('  FAIL - '+n); } }
function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
(async function(){
  var dom = new JSDOM(html, {url:'https://abc.test/', runScripts:'dangerously', pretendToBeVisual:true});
  var w = dom.window; w.console.error = function(){}; w.scrollTo = function(){}; await sleep(400);
  var d = w.document;
  w.DB.employees.push({id:'E1',empCode:'A1',name:'Budi',position:'Staff',department:'MC',properties:[],joinDate:'2025-01-01',dateOfBirth:'1995-01-01',gender:'Laki-laki',baseSalary:1,mealAllowance:0,transportAllowance:0,address:'',phone:'',email:'',username:'b',password:'p',active:true});
  function login(who){ w.SESSION = who==='hr' ? {role:'hr',empId:null,hrAccountId:null} : {role:who,empId:'E1'}; w.STATE.view='dashboard'; w.STATE.navSeenView=null; w.render(); }
  async function click(sel){ d.querySelector(sel).dispatchEvent(new w.MouseEvent('click',{bubbles:true})); await sleep(60); }

  console.log('\n[Pengelompokan menu]');
  ['hr','hod','staff'].forEach(function(role){
    var all = w.navItemsFor(role).map(function(i){ return i.v; }).sort();
    var cfg = w.navGroupsFor(role);
    var grouped = cfg.top.concat([].concat.apply([], cfg.groups.map(function(g){ return g.views; }))).sort();
    ok(JSON.stringify(all)===JSON.stringify(grouped), role+': semua menu masuk tepat satu kelompok (tidak ada yang hilang/ganda)');
  });
  login('hr');
  ok(d.querySelectorAll('.nav-group').length===5, 'HR: 5 kelompok menu');
  ok(d.querySelectorAll('.nav-item').length===16, 'HR: 16 item tetap ada di DOM');
  ok(!d.querySelector('.nav-group.open'), 'HR: di Dashboard semua kelompok tertutup');
  var topItems = Array.prototype.filter.call(d.querySelectorAll('.sidebar > .nav-item'), function(){ return true; }).length;
  ok(topItems===1, 'HR: Dashboard tampil di luar kelompok');
  await click('.nav-group-head[data-group="persetujuan"]');
  ok(d.querySelector('.nav-group[data-group="persetujuan"]').classList.contains('open'), 'klik judul kelompok membukanya');
  ok(d.querySelector('.nav-group-head[data-group="persetujuan"]').getAttribute('aria-expanded')==='true', 'aria-expanded ikut berubah');
  await click('.nav-group-head[data-group="persetujuan"]');
  ok(!d.querySelector('.nav-group[data-group="persetujuan"]').classList.contains('open'), 'klik lagi menutupnya');
  await click('.nav-group-head[data-group="sdm"]');
  w.render();
  ok(d.querySelector('.nav-group[data-group="sdm"]').classList.contains('open'), 'pilihan buka/tutup bertahan setelah render ulang');
  ok(/"sdm":true/.test(w.localStorage.getItem('abcSelarasNavOpen_hr')||''), 'pilihan disimpan di perangkat');
  /* pindah halaman -> kelompoknya terbuka otomatis */
  w.STATE.view = 'banners'; w.render();
  ok(d.querySelector('.nav-group[data-group="komunikasi"]').classList.contains('open') && d.querySelector('.nav-group[data-group="komunikasi"]').classList.contains('has-active'), 'membuka halaman Banner otomatis membuka kelompok Komunikasi');
  w.STATE.view = 'payroll-detail'; w.STATE.payrollDetailEmp = 'E1'; w.render();
  ok(d.querySelector('.nav-group[data-group="sdm"]').classList.contains('has-active'), 'detail slip gaji menandai kelompok SDM');
  /* badge chat pada judul kelompok */
  login('staff'); w.STATE.view='dashboard'; w.render();
  w.localStorage.setItem('abcChatLocal', JSON.stringify([{id:1,sender:'hr',recipient:'E1',body:'Halo',created_at:new Date().toISOString(),kind:'msg'}]));
  w.chatReset(); await w.chatPoll(); await sleep(80); w.render();
  var gb = d.querySelector('.nav-group[data-group="komunikasi"] .nav-group-badge');
  ok(!!gb && gb.textContent==='1', 'Staff: pesan belum dibaca tampil sebagai badge di judul kelompok Komunikasi');
  ok(d.querySelectorAll('.nav-group').length===5 && d.querySelector('.nav-item[data-view="checkin"]'), 'Staff: Absen tampil di luar kelompok, 5 kelompok');
  login('hod');
  ok(d.querySelectorAll('.nav-group').length===5 && !!d.querySelector('.nav-group[data-group="tim"] .nav-item[data-view="schedule"]'), 'HOD: kelompok Tim Saya berisi Atur Jadwal Tim');
  /* navigasi tetap berfungsi */
  await click('.nav-item[data-view="todo"]');
  ok(w.STATE.view==='todo', 'klik item menu tetap berpindah halaman');
  console.log('\n[Panel notifikasi]');
  ok(w.fixEntities('A &mdash; B &amp; C')==='A \u2014 B & C', 'fixEntities mengubah &mdash; dan &amp; menjadi karakter biasa');
  login('staff');
  w.DB.notifications = [{id:'N1', audience:{type:'emp',empId:'E1'}, message:'Budi mengajukan Cuti (1 Okt) &mdash; perlu persetujuan Anda.', link:null, createdAt:new Date().toISOString(), read:false}];
  w.STATE.notifPanelOpen = true; w.render();
  var nm = d.querySelector('.notif-msg').textContent;
  ok(nm.indexOf('\u2014')!==-1 && nm.indexOf('&mdash;')===-1, 'notifikasi lama dengan &mdash; tampil sebagai tanda pisah, bukan teks mentah');
  w.addNotification({type:'hr'}, 'Tes &mdash; baru', null, 'general');
  ok(w.DB.notifications[0].message==='Tes \u2014 baru', 'notifikasi baru dibersihkan saat dibuat');
  w.innerWidth = 390; w.render();
  ok(/px$/.test(d.querySelector('.notif-panel').style.top), 'HP: panel notifikasi diposisikan di bawah ikon lonceng');
  w.STATE.notifPanelOpen = false; w.innerWidth = 1280;
  console.log('\n[Live sync cepat]');
  login('hr'); w.STATE.view='dashboard'; w.render();
  w.STATE.notifPanelOpen = true; w.render();
  var cnt0 = d.querySelectorAll('.notif-item').length;
  w.DB.notifications.unshift({id:'N-live1', audience:{type:'hr'}, message:'Notif live', link:'', createdAt:new Date().toISOString(), read:false});
  w.updateBellBadge();
  ok(d.querySelectorAll('.notif-item').length===cnt0+1, 'panel notifikasi yang terbuka langsung menampilkan notifikasi baru');
  var calls = 0, orig = w.refreshLiveData;
  w.refreshLiveData = function(){ calls++; return Promise.resolve(true); };
  await w.liveTick(true);
  ok(calls===1, 'liveTick(force) langsung menarik data (dipakai saat app dibuka kembali)');
  w.refreshLiveData = orig;
  w.STATE.notifPanelOpen = false;
  console.log('\n[Sembunyikan Take Home Pay]');
  login('staff'); w.STATE.view='dashboard'; w.render();
  var mv = d.querySelector('.money-val');
  ok(!!mv && mv.textContent.indexOf('Rp')===0 && mv.textContent.indexOf('\u2022')===-1, 'THP tampil secara default');
  await click('.money-eye');
  ok(d.querySelector('.money-val').textContent.indexOf('\u2022')!==-1, 'klik ikon mata menyembunyikan nominal');
  w.render();
  ok(d.querySelector('.money-val').textContent.indexOf('\u2022')!==-1, 'pilihan sembunyi bertahan setelah render ulang');
  await click('.money-eye');
  ok(d.querySelector('.money-val').textContent.indexOf('\u2022')===-1, 'klik lagi menampilkan nominal');
  console.log('\n[Pembaruan APK]');
  var sha1='a'.repeat(40), sha2='b'.repeat(40);
  var rel = {body:'APK debug hasil build otomatis dari commit '+sha2+'. Unduh', assets:[{name:'app-debug.apk', browser_download_url:'https://x/app-debug.apk'}]};
  var pi = w.parseReleaseInfo(rel);
  ok(pi && pi.sha===sha2 && pi.url==='https://x/app-debug.apk', 'parseReleaseInfo membaca hash commit & tautan APK');
  ok(w.parseReleaseInfo({body:'tanpa hash', assets:[]})===null, 'rilis tanpa hash/APK diabaikan');
  /* web biasa: tidak mengecek */
  ok((await w.checkAppUpdate(true))===false, 'versi web (bukan APK) tidak menampilkan pembaruan');
  /* simulasi APK */
  w.Capacitor = {isNativePlatform:function(){ return true; }, Plugins:{}};
  w.APP_BUILD = sha1;
  w.fetch = function(){ return Promise.resolve({ok:true, json:function(){ return Promise.resolve(rel); }}); };
  login('staff'); w.STATE.view='dashboard'; w.render();
  ok((await w.checkAppUpdate(true))===true, 'APK versi lama: pembaruan terdeteksi');
  ok(!!d.querySelector('.update-banner') && d.querySelector('[data-action="app-update-download"]'), 'banner Unduh & Pasang tampil');
  var opened=null; w.open = function(u){ opened=u; };
  await click('[data-action="app-update-download"]');
  ok(opened==='https://x/app-debug.apk', 'tombol membuka tautan unduhan APK terbaru');
  await click('[data-action="app-update-dismiss"]');
  ok(!d.querySelector('.update-banner'), '"Nanti" menyembunyikan banner');
  w.STATE.updateDismissed=false; w.APP_BUILD = sha2; w.STATE.updateInfo=null;
  ok((await w.checkAppUpdate(true))===false && !d.querySelector('.update-banner'), 'APK sudah terbaru: tidak ada banner');
  w.Capacitor = undefined; w.APP_BUILD = 'dev';
  console.log('\nHASIL: '+pass+' lulus, '+fail+' gagal');
  process.exit(fail?1:0);
})().catch(function(e){ console.error('TES CRASH', e); process.exit(2); });

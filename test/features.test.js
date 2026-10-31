/* Tes fitur baru ABC Selaras (jsdom). Jalankan: node features.test.js */
var fs = require('fs');
var path = require('path');
var JSDOM = require('jsdom').JSDOM;

var SRC = path.join(__dirname, '..', 'web', 'index.html');
var html = fs.readFileSync(SRC, 'utf8');
/* kosongkan kredensial supaya tes memakai penyimpanan lokal, bukan server sungguhan */
html = html.replace(/var SUPABASE_URL = '[^']*'/, "var SUPABASE_URL = ''")
           .replace(/var SUPABASE_ANON_KEY = '[^']*'/, "var SUPABASE_ANON_KEY = ''")
           .replace(/var PUSH_FUNCTION_URL = '[^']*'/, "var PUSH_FUNCTION_URL = ''")
           .replace(/var EMAIL_FUNCTION_URL = '[^']*'/, "var EMAIL_FUNCTION_URL = ''");

var EARLY_NIGHT = (function(){ var n = new Date(); return n.getHours()===0 && n.getMinutes()<20; })();
var pass = 0, fail = 0, failures = [];
function ok(cond, name){
  if(cond){ pass++; console.log('  ok   - '+name); }
  else { fail++; failures.push(name); console.log('  FAIL - '+name); }
}
function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }

function boot(sharedStore){
  var dom = new JSDOM(html, {url:'https://abc-selaras.test/', runScripts:'dangerously', pretendToBeVisual:true});
  var w = dom.window;
  w.confirm = function(){ return true; };
  w.scrollTo = function(){};
  w.HTMLElement.prototype.scrollTo = function(){};
  w.console.error = function(){};   /* diam: ada banyak error disengaja */
  return sleep(400).then(function(){ return w; });
}
function click(w, action, attrs){
  var sel = '[data-action="'+action+'"]';
  if(attrs){ Object.keys(attrs).forEach(function(k){ sel += '[data-'+k+'="'+attrs[k]+'"]'; }); }
  var el = w.document.querySelector(sel);
  if(!el) throw new Error('Elemen tidak ditemukan: '+sel);
  el.dispatchEvent(new w.MouseEvent('click', {bubbles:true}));
  return sleep(120);
}
function setVal(w, id, v){ var e = w.document.getElementById(id); if(!e) throw new Error('#'+id+' tidak ada'); e.value = v; }
function change(w, id, v){ var e = w.document.getElementById(id); e.value = v; e.dispatchEvent(new w.Event('change', {bubbles:true})); return sleep(80); }
function text(w){ return w.document.getElementById('app').textContent; }
function nav(w, view){ return click(w, 'nav', {view:view}); }

function mkEmp(id, name, dept, user){
  return {id:id, empCode:'ABC-T-'+id, name:name, position:'Staff', department:dept, properties:[], joinDate:'2025-01-01',
    dateOfBirth:'1995-01-01', gender:'Laki-laki', baseSalary:3000000, mealAllowance:0, transportAllowance:0, address:'', phone:'',
    email:'', username:user, password:'pw', active:true, bpjsKesehatanActive:true, bpjsKetenagakerjaanActive:true};
}

function seedTestData(w){
  var d = w.DB;
  d.employees.push(mkEmp('E1','Budi Staff','Marketing Communication','budi'));
  d.employees.push(mkEmp('E2','Sari HOD','Marketing Communication','sari'));
  d.employees.push(mkEmp('E3','Dewi Front','Front Office','dewi'));
  d.departmentHods['Marketing Communication'] = ['E2'];
  var t = new Date();
  var ym = t.getFullYear()+'-'+('0'+(t.getMonth()+1)).slice(-2);
  var day = t.getDate();
  ['E1','E2','E3'].forEach(function(id){
    d.schedules[ym] = d.schedules[ym] || {};
    d.schedules[ym][id] = d.schedules[ym][id] || {};
    d.schedules[ym][id][day] = {type:'kerja', start:'00:01', end:'23:59'};   /* jam 00:01 -> pasti telat */
  });
  w.STATE.currentMonth = ym;
  return {ym:ym, day:day};
}

function login(w, who){
  w.SESSION = {role:'hr', empId:null, hrAccountId:null};
  if(who==='hr'){ w.SESSION = {role:'hr', empId:null, hrAccountId:null}; }
  else { w.SESSION = {role: who==='E2' ? 'hod' : 'staff', empId:who}; }
  w.STATE.view = 'dashboard';
  w.render();
  return sleep(60);
}

(async function main(){
  var w = await boot();
  ok(w.STATE.loaded === true, 'aplikasi termuat (mode lokal)');
  var info = seedTestData(w);

  /* ---------------- BANNER ---------------- */
  console.log('\n[Banner]');
  ok(Array.isArray(w.DB.banners) && w.DB.banners.length===1, 'banner sambutan default dibuat oleh migrasi');
  await login(w, 'hr');
  ok(!!w.document.querySelector('.banner-slide'), 'HR: banner tampil di dashboard');
  await nav(w, 'banners');
  ok(text(w).indexOf('Tambah Banner')!==-1, 'HR: halaman Banner terbuka');
  setVal(w, 'bn_title', 'Promo Akhir Tahun'); setVal(w, 'bn_sub', 'Diskon 20% untuk tamu menginap'); setVal(w, 'bn_color', 'emas');
  await click(w, 'save-banner'); await sleep(150);
  ok(w.DB.banners.length===2 && w.DB.banners[1].title==='Promo Akhir Tahun' && w.DB.banners[1].color==='emas', 'HR: banner baru tersimpan');
  var bid = w.DB.banners[1].id;
  await click(w, 'edit-banner', {id:bid});
  ok(w.document.getElementById('bn_title').value==='Promo Akhir Tahun', 'HR: form edit terisi data banner');
  setVal(w, 'bn_title', 'Promo Natal'); await click(w, 'save-banner'); await sleep(150);
  ok(w.getBannerById(bid).title==='Promo Natal', 'HR: banner berhasil diubah');
  await click(w, 'toggle-banner', {id:bid});
  ok(w.getBannerById(bid).active===false, 'HR: banner bisa disembunyikan');
  await click(w, 'toggle-banner', {id:bid});
  await click(w, 'move-banner', {id:bid, dir:'up'});
  ok(w.DB.banners[0].id===bid, 'HR: urutan banner bisa dinaikkan');
  await login(w, 'E1');
  ok(w.document.querySelectorAll('.banner-slide').length===2 && text(w).indexOf('Promo Natal')!==-1, 'Staff: melihat banner yang diatur HR');
  await login(w, 'E2');
  ok(w.document.querySelectorAll('.banner-slide').length===2, 'HOD: melihat banner yang diatur HR');
  await login(w, 'hr'); await nav(w, 'banners');
  await click(w, 'delete-banner', {id:bid});
  ok(w.getBannerById(bid).deleted===true && w.document.querySelectorAll('.banner-track .banner-slide').length===1, 'HR: banner dihapus (soft-delete) dan hilang dari dashboard');

  /* ---------------- TO-DO ---------------- */
  console.log('\n[To-Do]');
  await login(w, 'E1'); await nav(w, 'todo');
  setVal(w, 'td_title', 'Siapkan konten IG'); setVal(w, 'td_due', '2020-01-01'); setVal(w, 'td_prio', 'tinggi');
  await click(w, 'add-todo'); await sleep(150);
  var td1 = w.DB.todos[0];
  ok(td1 && td1.ownerId==='E1' && td1.title==='Siapkan konten IG', 'Staff: menambah tugas sendiri');
  ok(w.DB.notifications.some(function(n){ return n.audience.type==='hr' && n.message.indexOf('Budi Staff menambahkan tugas')!==-1; }), 'HR dapat notifikasi saat staf menambah tugas');
  ok(text(w).indexOf('Lewat ')!==-1, 'Staff: tugas lewat tenggat ditandai');
  await click(w, 'todo-set-status', {id:td1.id, status:'doing'});
  ok(td1.status==='doing', 'Staff: ubah status ke Dikerjakan');
  var nBefore = w.DB.notifications.length;
  await click(w, 'todo-set-status', {id:td1.id, status:'done'});
  ok(td1.status==='done' && !!td1.doneAt, 'Staff: tugas diselesaikan');
  ok(w.DB.notifications.length===nBefore+1 && w.DB.notifications[0].message.indexOf('menyelesaikan tugas')!==-1 && w.DB.notifications[0].audience.type==='hr', 'HR dapat notifikasi saat tugas selesai');
  /* HR memantau & menugaskan */
  await login(w, 'hr'); await nav(w, 'todo');
  ok(text(w).indexOf('Board Saya')!==-1 && text(w).indexOf('Board Semua')!==-1, 'HR: ada tab Board Saya dan Board Semua');
  await click(w, 'todo-tab', {tab:'monitor'});
  ok(text(w).indexOf('Budi Staff')!==-1 && text(w).indexOf('Siapkan konten IG')!==-1, 'HR: memantau tugas semua karyawan');
  setVal(w, 'ta_owner', 'E3'); setVal(w, 'ta_title', 'Rapikan lobby display'); setVal(w, 'ta_due', '2030-01-01');
  await click(w, 'assign-todo'); await sleep(150);
  var td2 = w.DB.todos[0];
  ok(td2.ownerId==='E3' && td2.createdById==='hr', 'HR: menugaskan tugas ke karyawan');
  ok(w.DB.notifications.some(function(n){ return n.audience.type==='emp' && n.audience.empId==='E3' && n.message.indexOf('HR memberi tugas baru')!==-1; }), 'Karyawan dapat notifikasi tugas dari HR');
  await change(w, 'todoFilterEmp', 'E1');
  ok(text(w).indexOf('Siapkan konten IG')!==-1 && text(w).indexOf('Rapikan lobby')===-1, 'HR: filter karyawan di pantauan bekerja');
  /* HOD hanya bisa menugaskan tim sendiri */
  await login(w, 'E2'); await nav(w, 'todo'); await click(w, 'todo-tab', {tab:'monitor'});
  var ownerOpts = Array.prototype.map.call(w.document.querySelectorAll('#ta_owner option'), function(o){ return o.value; });
  ok(ownerOpts.indexOf('E1')!==-1 && ownerOpts.indexOf('E3')===-1, 'HOD: hanya bisa menugaskan anggota timnya');
  setVal(w, 'ta_owner', 'E1'); setVal(w, 'ta_title', 'Laporan mingguan');
  var hrNotifBefore = w.DB.notifications.filter(function(n){ return n.audience.type==='hr'; }).length;
  await click(w, 'assign-todo'); await sleep(150);
  ok(w.DB.notifications.filter(function(n){ return n.audience.type==='hr'; }).length===hrNotifBefore+1, 'HR ikut diberi tahu saat HOD menugaskan staf');
  var td3 = w.DB.todos[0];
  await login(w, 'E1'); await nav(w, 'todo');
  await click(w, 'todo-set-status', {id:td3.id, status:'done'});
  ok(w.DB.notifications.some(function(n){ return n.audience.type==='emp' && n.audience.empId==='E2' && n.message.indexOf('menyelesaikan tugas yang kamu berikan')!==-1; }), 'HOD dapat notifikasi saat stafnya menyelesaikan tugas');
  await nav(w, 'dashboard');
  ok(text(w).indexOf('Board Saya')!==-1, 'Staff: widget Board di dashboard');
  await login(w, 'hr');
  ok(text(w).indexOf('Pantauan Selaras Board')!==-1, 'HR: widget Pantauan Selaras Board di dashboard');
  /* keamanan: staf tidak bisa mengubah tugas milik orang lain */
  await login(w, 'E1'); await nav(w, 'todo');
  w.document.getElementById('app').insertAdjacentHTML('beforeend', '<button data-action="todo-set-status" data-id="'+td2.id+'" data-status="done" id="hack"></button>');
  w.document.getElementById('hack').dispatchEvent(new w.MouseEvent('click', {bubbles:true})); await sleep(100);
  ok(td2.status==='todo', 'Staff tidak bisa menyelesaikan tugas milik orang lain');

  /* ---------------- ABSEN TELAT / LUAR JANGKAUAN ---------------- */
  console.log('\n[Notifikasi absen]');
  w.DB.officeLocations = [{id:'L1', name:'Briggs Inn Batu', lat:-7.9010474, lng:112.5586311, address:'Batu', radius:150}];
  async function doCheckin(empId, loc, type){
    await login(w, empId); await nav(w, 'checkin');
    w.CHECKIN_DRAFT.photoDataUrl = 'data:image/jpeg;base64,AAAA';
    w.CHECKIN_DRAFT.location = loc;
    w.CHECKIN_DRAFT.condition = 'sehat';
    w.render(); await sleep(60);
    await click(w, 'submit-checkin', {type:type});
    await sleep(250);
  }
  var hrCount = function(){ return w.DB.notifications.filter(function(n){ return n.audience.type==='hr'; }).length; };
  var c0 = hrCount();
  await doCheckin('E1', {lat:-7.9010474, lng:112.5586311, accuracy:10}, 'in');
  var rec1 = w.DB.attendance[info.ym]['E1'][info.day];
  ok(rec1 && rec1.checkIn, 'absen masuk tersimpan');
  var lateN = w.DB.notifications.filter(function(n){ return n.message.indexOf('Budi Staff')!==-1 && n.message.indexOf('TELAT')!==-1; });
  (EARLY_NIGHT ? function(c,n){ ok(true, n+' (dilewati: jam 00.00–00.20)'); } : ok)(lateN.length===1 && lateN[0].audience.type==='hr' && lateN[0].link==='attendance', 'HR dapat notifikasi saat staf absen telat');
  ok(!w.DB.notifications.some(function(n){ return n.message.indexOf('LUAR JANGKAUAN')!==-1 && n.message.indexOf('Budi')!==-1; }), 'tidak ada alarm luar jangkauan saat di kantor');
  var c1 = hrCount();
  await doCheckin('E3', {lat:-7.2929571, lng:112.7338145, accuracy:10}, 'in');
  var farN = w.DB.notifications.filter(function(n){ return n.message.indexOf('Dewi Front')!==-1 && n.message.indexOf('LUAR JANGKAUAN')!==-1; });
  ok(farN.length===1 && farN[0].message.indexOf('Briggs Inn Batu')!==-1, 'HR dapat notifikasi saat absen di luar jangkauan (menyebut lokasi terdekat)');
  await doCheckin('E2', null, 'in');
  ok(w.DB.notifications.some(function(n){ return n.message.indexOf('Sari HOD')!==-1 && n.message.indexOf('tanpa data lokasi')!==-1; }), 'HR dapat notifikasi saat GPS tidak terdeteksi');
  await login(w, 'hr');
  ok(text(w).indexOf('Peringatan Absen Hari Ini')!==-1 && text(w).indexOf('Dewi Front')!==-1 && text(w).indexOf('Di luar jangkauan')!==-1, 'HR: kartu Peringatan Absen Hari Ini di dashboard');
  /* absen pulang di luar jangkauan */
  await doCheckin('E1', {lat:-7.2929571, lng:112.7338145, accuracy:10}, 'out');
  (EARLY_NIGHT ? function(c,n){ ok(true, n+' (dilewati: jam 00.00–00.20)'); } : ok)(w.DB.notifications.some(function(n){ return n.message.indexOf('Budi Staff')!==-1 && n.message.indexOf('absen pulang')!==-1 && n.message.indexOf('LUAR JANGKAUAN')!==-1; }), 'HR dapat notifikasi saat absen pulang di luar jangkauan');
  /* notifikasi tampil di lonceng HR */
  await login(w, 'hr');
  ok(w.document.querySelector('.notif-badge') && parseInt(w.document.querySelector('.notif-badge').textContent,10)>0, 'HR: badge lonceng menunjukkan notifikasi belum dibaca');

  /* ---------------- PREFERENSI NOTIFIKASI ---------------- */
  console.log('\n[Preferensi notifikasi]');
  await login(w, 'hr'); await nav(w, 'notif-settings');
  ok(text(w).indexOf('Karyawan absen telat')!==-1 && text(w).indexOf('Absen di luar jangkauan')!==-1, 'HR: halaman Notifikasi menampilkan kategori HR');
  await click(w, 'toggle-notif-pref', {key:'late'});
  ok(w.DB.notifPrefs.hr.late===false, 'HR: matikan notifikasi telat');
  var beforeLate = w.DB.notifications.length;
  w.DB.schedules[info.ym]['E3'][info.day] = {type:'kerja', start:'00:01', end:'23:59'};
  w.raiseAttendanceAlerts('E3', info.ym, info.day, 'in', '09:00', {lat:-7.9010474, lng:112.5586311}, {name:'Briggs Inn Batu', distance:5, withinRange:true, address:'Batu'});
  ok(w.DB.notifications.length===beforeLate, 'notifikasi telat TIDAK dibuat saat dimatikan HR');
  w.raiseAttendanceAlerts('E3', info.ym, info.day, 'in', '09:00', {lat:1, lng:1}, {name:'Briggs Inn Batu', distance:9000, withinRange:false, address:'Batu'});
  ok(w.DB.notifications.length===beforeLate+1, 'notifikasi luar jangkauan tetap dibuat (kategori lain masih aktif)');
  await click(w, 'toggle-notif-pref', {key:'enabled'});
  var beforeAll = w.DB.notifications.length;
  w.raiseAttendanceAlerts('E3', info.ym, info.day, 'in', '09:00', {lat:1, lng:1}, {name:'X', distance:9000, withinRange:false, address:''});
  ok(w.DB.notifPrefs.hr.enabled===false && w.DB.notifications.length===beforeAll, 'saklar utama mematikan semua notifikasi HR');
  await click(w, 'toggle-notif-pref', {key:'enabled'});
  await login(w, 'E1'); await nav(w, 'notif-settings');
  ok(text(w).indexOf('Tugas Selaras Board')!==-1 && text(w).indexOf('Karyawan absen telat')===-1, 'Staff: kategori notifikasi khusus staf');
  await click(w, 'toggle-notif-pref', {key:'todo'});
  ok(w.DB.notifPrefs.emp.E1.todo===false, 'Staff: matikan notifikasi To-Do');
  var nb = w.DB.notifications.length;
  w.SESSION = {role:'hr', empId:null, hrAccountId:null};
  w.createTodo({ownerId:'E1', title:'Tugas diam-diam'});
  ok(!w.DB.notifications.some(function(n){ return n.audience.empId==='E1' && n.message.indexOf('Tugas diam-diam')!==-1; }), 'staf yang mematikan notifikasi To-Do tidak dikirimi');

  /* ---------------- AKTIVITAS SAYA ---------------- */
  console.log('\n[Aktivitas Saya]');
  await login(w, 'E1'); await nav(w, 'my-activity');
  var t = text(w);
  (EARLY_NIGHT ? function(c,n){ ok(true, n+' (dilewati: jam 00.00–00.20)'); } : ok)(t.indexOf('Absen masuk pukul')!==-1 && t.indexOf('Telat')!==-1, 'Staff: log menampilkan absen masuk + telat');
  (EARLY_NIGHT ? function(c,n){ ok(true, n+' (dilewati: jam 00.00–00.20)'); } : ok)(t.indexOf('DI LUAR JANGKAUAN')!==-1 && t.indexOf('Absen pulang')!==-1, 'Staff: log menampilkan absen pulang di luar jangkauan');
  ok(t.indexOf('Siapkan konten IG')!==-1, 'Staff: log memuat aktivitas To-Do');
  ok(t.indexOf('Promo Natal')===-1 && t.indexOf('Dewi Front')===-1, 'Staff: log hanya berisi aktivitas dirinya sendiri');
  await click(w, 'my-act-filter', {filter:'absen'});
  ok(text(w).indexOf('Absen masuk pukul')!==-1 && text(w).indexOf('Membuat tugas')===-1, 'Staff: filter Absensi');

  /* ---------------- SINKRONISASI LIVE ---------------- */
  console.log('\n[Sinkronisasi live]');
  await login(w, 'hr'); await nav(w, 'dashboard');
  var remote = JSON.parse(JSON.stringify(w.DB));
  remote.notifications.unshift({id:'N-remote1', audience:{type:'hr'}, message:'Notifikasi dari perangkat lain', link:'attendance', createdAt:new Date().toISOString(), read:false, });
  remote.todos.unshift({id:'TD-remote', ownerId:'E3', title:'Tugas dari perangkat lain', note:'', due:'', priority:'normal', status:'todo', createdById:'hr', createdAt:new Date().toISOString(), updatedAt:new Date().toISOString()});
  remote.attendance[info.ym]['E3'][info.day].checkOut = '17:00';
  await w.storageSet('hrdb', JSON.stringify(remote));
  var okPoll = await w.refreshLiveData();
  ok(okPoll===true, 'refreshLiveData berhasil menarik data');
  ok(w.DB.notifications.some(function(n){ return n.id==='N-remote1'; }), 'notifikasi baru dari perangkat lain masuk ke HR');
  ok(w.DB.todos.some(function(x){ return x.id==='TD-remote'; }), 'tugas baru dari perangkat lain tergabung');
  ok(w.DB.attendance[info.ym]['E3'][info.day].checkOut==='17:00', 'catatan absen baru tergabung (tidak tertimpa)');
  ok(w.document.getElementById('toastEl').textContent.indexOf('Notifikasi dari perangkat lain')!==-1, 'toast muncul untuk notifikasi baru');
  var unreadBefore = w.unreadNotifCount();
  /* penandaan "dibaca" lokal tidak hilang saat sync */
  w.DB.notifications.forEach(function(n){ n.read = true; });
  await w.refreshLiveData();
  ok(w.unreadNotifCount()===0, 'status dibaca lokal tidak ter-reset oleh sinkronisasi');

  /* ---------------- tanpa error runtime di render semua halaman ---------------- */
  console.log('\n[Smoke semua halaman]');
  var errs = [];
  w.addEventListener('error', function(e){ errs.push(e.message); });
  var roles = {hr:null, E2:null, E1:null};
  for(var r in roles){
    await login(w, r);
    var views = w.navItemsFor(w.SESSION.role).map(function(i){ return i.v; });
    for(var i=0;i<views.length;i++){
      w.STATE.view = views[i];
      try{ w.render(); }catch(e){ errs.push(r+':'+views[i]+' '+e.message); }
      if(text(w).trim().length < 20) errs.push(r+':'+views[i]+' kosong');
    }
  }
  ok(errs.length===0, 'semua halaman semua peran dirender tanpa error' + (errs.length ? ' -> '+errs.slice(0,3).join(' | ') : ''));

  console.log('\nHASIL: '+pass+' lulus, '+fail+' gagal');
  if(fail){ console.log('Gagal:\n - '+failures.join('\n - ')); process.exit(1); }
  process.exit(0);
})().catch(function(e){ console.error('TES CRASH', e); process.exit(2); });

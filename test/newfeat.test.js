/* Tes: SOP, Struktur Organisasi, e-ID Card, Profil HR, kirim notifikasi HR, pengingat 8 jam, bottom nav, bulan default. */
var fs=require('fs'),path=require('path'),JSDOM=require('jsdom').JSDOM;
var html=fs.readFileSync(path.join(__dirname,'..','web','index.html'),'utf8')
  .replace(/var SUPABASE_URL = '[^']*'/,"var SUPABASE_URL = ''").replace(/var SUPABASE_ANON_KEY = '[^']*'/,"var SUPABASE_ANON_KEY = ''")
  .replace(/var PUSH_FUNCTION_URL = '[^']*'/,"var PUSH_FUNCTION_URL = ''").replace(/var EMAIL_FUNCTION_URL = '[^']*'/,"var EMAIL_FUNCTION_URL = ''");
var pass=0,fail=0; function ok(c,n){ if(c){pass++;console.log('  ok   - '+n);}else{fail++;console.log('  FAIL - '+n);} }
function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}
(async function(){
  var dom=new JSDOM(html,{url:'https://abc.test/',runScripts:'dangerously',pretendToBeVisual:true});
  var w=dom.window; w.console.error=function(){}; w.scrollTo=function(){}; w.confirm=function(){return true;}; await sleep(400);
  var d=w.document; function app(){ return d.getElementById('app').innerHTML; }
  function emp(id,name,dept,props){ return {id:id,empCode:'ABC-'+id,name:name,position:'Staff',department:dept,properties:props||[],joinDate:'2025-01-01',dateOfBirth:'1995-01-01',gender:'Laki-laki',baseSalary:1,mealAllowance:0,transportAllowance:0,address:'',phone:'',email:'',username:id.toLowerCase(),password:'p',active:true}; }
  w.DB.employees=[emp('H1','Hana HOD','Marketing',['Kaly']),emp('S1','Sari Staf','Marketing',['Kaly']),emp('S2','Sigit Staf','Marketing',['Kaly']),emp('S3','Santi Staf','Marketing',['Kaly']),emp('F1','Fajar FO','Front Office',['Padi Heritage'])];
  w.DB.departmentHods={Marketing:['H1']};
  function as(role,id,view){ w.SESSION= role==='hr'?{role:'hr',empId:null,hrAccountId:null}:{role:role,empId:id}; w.STATE.view=view; w.STATE.sidebarOpen=false; w.render(); }
  async function click(sel){ var el=typeof sel==='string'?d.querySelector(sel):sel; if(!el) throw new Error('tidak ada: '+sel); el.dispatchEvent(new w.MouseEvent('click',{bubbles:true})); await sleep(80); }
  function setv(id,v){ var el=d.getElementById(id); el.value=v; el.dispatchEvent(new w.Event('input',{bubbles:true})); el.dispatchEvent(new w.Event('change',{bubbles:true})); }

  console.log('\n[Bug fix]');
  var now=new Date(), ym=now.getFullYear()+'-'+(now.getMonth()<9?'0':'')+(now.getMonth()+1);
  ok(w.STATE.currentMonth===ym, 'periode default = bulan ini ('+ym+')');
  ok(!/backdrop-filter:blur\(12px\);border-bottom/.test(html) && /\.topbar\{\s*background:var\(--surface\);position:relative;z-index:70/.test(html.replace(/\n\s*/g,'')), 'topbar di atas banner (panel notifikasi tidak tertumpuk)');

  console.log('\n[SOP & Peraturan]');
  as('hr',null,'sop'); ok(!!d.getElementById('sop_title'), 'HR: form tambah SOP');
  setv('sop_title','SOP Check-in Tamu'); setv('sop_desc','1. Sapa tamu\n2. Cek reservasi'); setv('sop_dept','Marketing');
  await click('[data-action="sop-add"]'); await sleep(100);
  ok((w.DB.sops||[]).length===1 && w.DB.sops[0].dept==='Marketing', 'SOP tersimpan');
  ok(w.DB.notifications.some(function(n){ return n.audience.empId==='S1' && /SOP baru/.test(n.message); }) && !w.DB.notifications.some(function(n){ return n.audience.empId==='F1' && /SOP baru/.test(n.message); }), 'notifikasi hanya ke departemen terkait');
  as('staff','S1','sop'); ok(/SOP Check-in Tamu/.test(app()) && !d.getElementById('sop_title'), 'staf Marketing melihat SOP (tanpa form)');
  as('staff','F1','sop'); ok(!/SOP Check-in Tamu/.test(app()), 'staf departemen lain tidak melihat');
  as('hr',null,'sop'); await click('[data-action="sop-edit"]'); setv('sope_title','SOP Check-in Tamu v2'); await click('[data-action="sop-save"]'); await sleep(80);
  ok(w.DB.sops[0].title==='SOP Check-in Tamu v2', 'HR bisa edit SOP');

  console.log('\n[Struktur Organisasi]');
  as('hr',null,'org'); ok(!!d.querySelector('[data-action="org-autogen"]'), 'HR: tombol susun otomatis');
  await click('[data-action="org-autogen"]');
  var g=w.DB.org.group; ok(g.length===7 && g.filter(function(n){ return !n.parentId; }).length===1, 'group: 1 pimpinan + 2 head + 4 staff');
  ok(!!d.querySelector('.org-tree .org-node') && !!d.querySelector('.org-group'), 'tampil sebagai bagan (staff dikelompokkan)');
  await click('[data-action="org-tab"][data-tab="Kaly"]'); await click('[data-action="org-autogen"]');
  ok(w.DB.org.props.Kaly.length===5 && /General Manager Kaly/.test(app()), 'organisasi per property (Kaly)');
  await click('[data-action="org-node-new"][data-parent=""]'); setv('org_title','Wakil GM'); setv('org_emp','S2'); await click('[data-action="org-node-save"]');
  ok(w.DB.org.props.Kaly.some(function(n){ return n.title==='Wakil GM' && n.empId==='S2'; }), 'tambah jabatan manual');
  var root=w.DB.org.props.Kaly.filter(function(n){ return /General Manager/.test(n.title); })[0];
  await click('[data-action="org-node-del"][data-id="'+root.id+'"]');
  ok(!w.DB.org.props.Kaly.some(function(n){ return n.id===root.id; }) && w.DB.org.props.Kaly.every(function(n){ return n.parentId!==root.id; }), 'hapus jabatan: bawahan naik');
  as('staff','S1','org'); ok(!!d.querySelector('.org-tree') && !d.querySelector('[data-action="org-node-new"]'), 'staf bisa melihat, tidak bisa mengubah');

  console.log('\n[e-ID Card]');
  as('staff','S1','id-card'); var svgs=d.querySelectorAll('.idc-face svg');
  ok(svgs.length===2 && /Sari Staf/.test(svgs[0].outerHTML) && /ABC-S1/.test(svgs[0].outerHTML), 'kartu depan & belakang berisi nama dan ID');
  ok(!!d.querySelector('[data-action="idc-print"]') && d.querySelectorAll('[data-action="idc-dl"]').length===2, 'tombol cetak & unduh');
  as('hr',null,'id-card'); var sel=d.getElementById('idcEmp'); ok(!!sel, 'HR memilih karyawan'); sel.value='F1'; sel.dispatchEvent(new w.Event('change',{bubbles:true})); await sleep(50);
  ok(/Fajar FO/.test(d.querySelector('.idc-face svg').outerHTML), 'kartu berganti sesuai pilihan');

  console.log('\n[Profil HR]');
  as('hr',null,'hr-profile'); setv('hp_name','Dyah HR'); setv('hp_title','HR Manager'); setv('hp_user','hrdyah');
  await click('[data-action="hr-profile-save"]'); await sleep(60);
  ok(w.DB.hr.name==='Dyah HR' && w.DB.hr.username==='hrdyah' && w.currentHrAccount().name==='Dyah HR', 'HR mengubah profil (nama, username)');
  setv('hp_user','sari'.replace('sari','s1')); await click('[data-action="hr-profile-save"]'); ok(w.DB.hr.username==='hrdyah', 'username bentrok dengan karyawan ditolak');

  console.log('\n[Kirim notifikasi dari HR]');
  as('hr',null,'notif-settings'); ok(!!d.getElementById('nb_target'), 'form kirim notifikasi di Pengaturan Notifikasi HR');
  setv('nb_target','hod'); setv('nb_msg','Rapat HOD jam 3'); await click('[data-action="notif-broadcast-send"]');
  ok(w.DB.notifications.some(function(n){ return n.audience.empId==='H1' && /Rapat HOD/.test(n.message); }) && !w.DB.notifications.some(function(n){ return n.audience.empId==='S1' && /Rapat HOD/.test(n.message); }), 'terkirim hanya ke HOD');
  setv('nb_target','dept:Marketing'); setv('nb_msg','Briefing marketing'); await click('[data-action="notif-broadcast-send"]');
  ok(w.DB.notifications.filter(function(n){ return /Briefing marketing/.test(n.message); }).length===4 && w.DB.notifBroadcasts.length===2, 'kirim per departemen + riwayat');

  console.log('\n[Pengingat 8 jam]');
  var t=w.todayParts(), ago=new Date(Date.now()-8*3600*1000-60000), hm=(ago.getHours()<10?'0':'')+ago.getHours()+':'+(ago.getMinutes()<10?'0':'')+ago.getMinutes();
  if(ago.getDate()===new Date().getDate()){
    w.DB.attendance[t.ym]=w.DB.attendance[t.ym]||{}; w.DB.attendance[t.ym].S2={}; w.DB.attendance[t.ym].S2[t.day]={checkIn:hm};
    as('staff','S2','dashboard'); w.workReminderSync();
    var rem=w.DB.notifications.filter(function(n){ return n.audience.empId==='S2' && /8 jam kerja/.test(n.message); });
    ok(rem.length===1, 'notifikasi "Sudah 8 jam kerja" muncul');
    w.workReminderSync(); ok(w.DB.notifications.filter(function(n){ return n.audience.empId==='S2' && /8 jam kerja/.test(n.message); }).length===1, 'tidak dikirim dua kali');
    w.DB.attendance[t.ym].S3={}; w.DB.attendance[t.ym].S3[t.day]={checkIn:hm, checkOut:'23:59'}; as('staff','S3','dashboard'); w.workReminderSync();
    ok(!w.DB.notifications.some(function(n){ return n.audience.empId==='S3' && /8 jam kerja/.test(n.message); }), 'tidak muncul kalau sudah absen pulang');
  } else { ok(true,'(dilewati: lewat tengah malam)'); ok(true,'-'); ok(true,'-'); }

  console.log('\n[Bottom navigation]');
  as('staff','S1','dashboard'); var bn=d.querySelectorAll('.bottom-nav .bn-item');
  ok(bn.length===5 && /Menu/.test(bn[0].textContent) && /Absen/.test(bn[1].textContent) && /Beranda/.test(bn[2].textContent) && /Board/.test(bn[3].textContent) && /Chat/.test(bn[4].textContent), 'staf: Menu, Absen, Beranda (tengah), Board, Chat');
  await click(bn[3]); ok(w.STATE.view==='todo' && d.querySelector('.bottom-nav .bn-item.active') && /Board/.test(d.querySelector('.bottom-nav .bn-item.active').textContent), 'tap Board pindah halaman + aktif');
  as('hr',null,'dashboard'); ok(/Karyawan/.test(d.querySelector('.bottom-nav').textContent), 'HR: tombol Karyawan');
  ok(/APP_VERSION = 'dev'/.test(html) && /class="app-ver"/.test(app()), 'versi aplikasi tampil di menu');
  console.log('\n[Jadwal besok di dashboard]');
  var tmr=new Date(); tmr.setHours(12,0,0,0); tmr=new Date(tmr.getTime()+86400000); var tym=tmr.getFullYear()+'-'+(tmr.getMonth()<9?'0':'')+(tmr.getMonth()+1);
  var d2=new Date(tmr.getTime()+86400000), d2ym=d2.getFullYear()+'-'+(d2.getMonth()<9?'0':'')+(d2.getMonth()+1);
  w.DB.schedules[tym]=w.DB.schedules[tym]||{}; w.DB.schedules[tym].S1={}; w.DB.schedules[tym].S1[tmr.getDate()]={type:'kerja',start:'08:00',end:'16:00'};
  as('staff','S1','dashboard'); var nc=d.querySelector('.nsc-card');
  ok(nc && /Jadwal Besok/.test(nc.textContent) && /08:00/.test(d.querySelector('.nsc-time').textContent) && d.querySelectorAll('.nsc-day').length===7, 'staf: kartu Jadwal Besok (jam masuk + 7 hari ke depan)');
  w.DB.schedules[tym].S1[tmr.getDate()]={type:'libur'}; w.DB.schedules[d2ym]=w.DB.schedules[d2ym]||{}; w.DB.schedules[d2ym].S1=w.DB.schedules[d2ym].S1||{}; w.DB.schedules[d2ym].S1[d2.getDate()]={type:'kerja',start:'14:00',end:'22:00'};
  w.render(); ok(/Libur/.test(d.querySelector('.nsc-time').textContent) && /Jadwal kerja berikutnya/.test(d.querySelector('.nsc-card').textContent) && /14:00/.test(d.querySelector('.nsc-card').textContent), 'besok libur -> tampil jadwal kerja berikutnya');
  as('hod','H1','dashboard'); ok(!!d.querySelector('.nsc-card'), 'HOD juga punya kartu Jadwal Besok');

  console.log('\n[Info aplikasi di Profil]');
  as('staff','S1','my-profile'); ok(/Unduh APK Android/.test(app()) && /releases\/download\/apk-terbaru\/app-debug\.apk/.test(app()) && /Yang Baru/.test(app()) && /Versi di perangkat ini/.test(app()), 'staf: link APK, versi, dan daftar pembaruan di Profil');
  as('hod','H1','my-profile'); ok(/Unduh APK Android/.test(app()), 'HOD: info aplikasi di Profil');
  as('hr',null,'hr-profile'); ok(/Unduh APK Android/.test(app()), 'HR: info aplikasi di Profil');
  await click('[data-action="app-chg-toggle"]'); ok(d.querySelectorAll('.chg').length===w.APP_CHANGELOG.length, 'lihat semua riwayat pembaruan');
  as('hod','H1','dashboard'); ok(w.navItemsFor('hod').some(function(x){ return x.v==='assets'; }), 'HOD punya menu Aset Inventaris');

  console.log('\n[Notifikasi: ikon, waktu, warna]');
  w.DB.notifications=[]; w.addNotification({type:'emp',empId:'S1'},'Pesan HR (Dyah HR): Jangan lupa absen',null,'hrmsg'); w.addNotification({type:'emp',empId:'S1'},'Sudah 8 jam kerja hari ini.','checkin','reminder'); w.addNotification({type:'emp',empId:'S1'},'Tugas baru: Desain feed','todo','task');
  as('staff','S1','dashboard'); w.STATE.notifPanelOpen=true; w.render();
  var its=d.querySelectorAll('.notif-item');
  ok(its.length===3 && d.querySelector('.notif-item.nk-hr .notif-ic svg') && /Pesan HR/.test(d.querySelector('.nk-hr .notif-tag').textContent) && /Dyah HR/.test(d.querySelector('.nk-hr .notif-tag').textContent), 'pesan HR: ikon + label + warna khusus');
  ok(!!d.querySelector('.notif-item.nk-sys') && /Sistem/.test(d.querySelector('.nk-sys .notif-tag').textContent), 'notifikasi sistem diberi warna lain');
  ok(/Hari ini, \d\d:\d\d/.test(d.querySelector('.notif-time').textContent), 'waktu notifikasi (Hari ini, jam:menit)');
  console.log('\n'+pass+' ok, '+fail+' gagal'); process.exit(fail?1:0);
})();

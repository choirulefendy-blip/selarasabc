/* Tes: Aset Inventaris, Notifikasi Terjadwal, panduan iPhone, sidebar. */
var fs=require('fs'),path=require('path'),JSDOM=require('jsdom').JSDOM;
var html=fs.readFileSync(path.join(__dirname,'..','web','index.html'),'utf8')
  .replace(/var SUPABASE_URL = '[^']*'/,"var SUPABASE_URL = ''").replace(/var SUPABASE_ANON_KEY = '[^']*'/,"var SUPABASE_ANON_KEY = ''")
  .replace(/var PUSH_FUNCTION_URL = '[^']*'/,"var PUSH_FUNCTION_URL = ''").replace(/var EMAIL_FUNCTION_URL = '[^']*'/,"var EMAIL_FUNCTION_URL = ''");
var pass=0,fail=0; function ok(c,n){ if(c){pass++;console.log('  ok   - '+n);}else{fail++;console.log('  FAIL - '+n);} }
function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}
(async function(){
  var dom=new JSDOM(html,{url:'https://abc.test/',runScripts:'dangerously',pretendToBeVisual:true});
  var w=dom.window; w.console.error=function(){}; w.scrollTo=function(){}; await sleep(400);
  var d=w.document; function app(){ return d.getElementById('app').innerHTML; }
  function emp(id,name,dept){ return {id:id,empCode:id,name:name,position:'Staff',department:dept,properties:['Kaly'],joinDate:'2025-01-01',dateOfBirth:'1995-01-01',gender:'Laki-laki',baseSalary:1,mealAllowance:0,transportAllowance:0,address:'',phone:'',email:'',username:id,password:'p',active:true}; }
  w.DB.employees=[emp('H1','Hana HOD','Marketing'),emp('S1','Sari Staf','Marketing'),emp('H2','Budi FO','Front Office'),emp('S2','Sigit FO','Front Office')];
  w.DB.departmentHods={Marketing:['H1'],'Front Office':['H2']};
  function as(role,id,view){ w.SESSION= role==='hr'?{role:'hr',empId:null,hrAccountId:null}:{role:role,empId:id}; w.STATE.view=view; w.render(); }
  async function click(sel){ var el=typeof sel==='string'?d.querySelector(sel):sel; if(!el) throw new Error('tidak ada: '+sel); el.dispatchEvent(new w.MouseEvent('click',{bubbles:true})); await sleep(80); }
  function setv(id,v){ var el=d.getElementById(id); el.value=v; el.dispatchEvent(new w.Event('input',{bubbles:true})); el.dispatchEvent(new w.Event('change',{bubbles:true})); }

  console.log('\n[Aset Inventaris]');
  as('hod','H1','assets'); ok(!!d.querySelector('[data-action="as-new"]') && /Total Aset/.test(app()), 'HOD membuka Aset Inventaris');
  await click('[data-action="as-new"]'); setv('as_name','AC Split 1 PK Lobby'); setv('as_cat','Elektronik'); setv('as_brand','Daikin'); setv('as_serial','SN123');
  setv('as_holder','S1'); setv('as_pdate','2024-10-31'); setv('as_price','4000000'); setv('as_life','4'); setv('as_service','2020-01-01');
  await click('[data-action="as-save"]'); await sleep(100);
  var a=(w.DB.assets||[])[0];
  ok(a && a.code==='AST-MAR-0001' && a.dept==='Marketing' && a.holderEmpId==='S1' && a.history.length===1, 'aset tersimpan dengan kode otomatis + riwayat');
  var bv=w.assetBookValue(a); ok(bv>1900000 && bv<2100000, 'nilai buku penyusutan garis lurus (~50% setelah 2 th)');
  ok(w.assetAttention(a).indexOf('Servis jatuh tempo')!==-1, 'servis jatuh tempo terdeteksi');
  ok(w.DB.notifications.some(function(n){ return n.audience.empId==='H1' && /Jadwal servis aset/.test(n.message); }), 'notifikasi servis ke HOD');
  await click('[data-action="as-detail"]'); ok(/AST-MAR-0001/.test(d.getElementById('modalRoot').innerHTML) && /Riwayat/.test(d.getElementById('modalRoot').innerHTML), 'detail aset terbuka');
  setv('ash_type','Perbaikan'); setv('ash_text','Ganti kapasitor'); setv('ash_cost','250000'); await click('[data-action="as-log"]');
  ok(a.history.length===2 && a.history[1].cost===250000, 'catat perbaikan + biaya');
  await click('[data-action="as-edit"]'); setv('as_holder','H1'); setv('as_cond','rusak_ringan'); await click('[data-action="as-save"]'); await sleep(80);
  ok(/Pemegang: Sari Staf → Hana HOD/.test(a.history[a.history.length-1].text) && /Kondisi: Baik → Rusak Ringan/.test(a.history[a.history.length-1].text), 'mutasi pemegang & kondisi tercatat di riwayat');
  as('hod','H2','assets'); ok(!/AC Split/.test(app()), 'HOD departemen lain tidak melihat aset Marketing');
  as('hr',null,'assets'); ok(/AC Split/.test(app()), 'HR melihat semua aset');
  setv('asf_cond','baik'); ok(!/AC Split/.test(app()), 'filter kondisi bekerja'); setv('asf_cond','');
  as('staff','S1','assets'); ok(!d.querySelector('[data-action="as-new"]'), 'staf tidak punya akses');
  var saved=null; w.XLSX={utils:{book_new:function(){return {s:[]};},aoa_to_sheet:function(r){return r;},book_append_sheet:function(b,s,n){b.s.push({n:n,r:s});}},writeFile:function(b){saved=b;}};
  as('hr',null,'assets'); await click('[data-action="as-xlsx"]'); ok(saved && saved.s[0].r.length===2 && saved.s[1].r.length>=4, 'unduh Excel daftar aset + riwayat');

  console.log('\n[Notifikasi terjadwal]');
  as('hr',null,'notif-settings'); setv('nb_target','all'); setv('nb_msg','Isi timesheet ya'); setv('nb_freq','monthly');
  ok(d.querySelector('[data-nsf="monthly"]').style.display==='' && d.querySelector('[data-nsf="once"]').style.display==='none', 'kolom jadwal muncul sesuai pilihan');
  setv('nb_mday','15'); setv('nb_time','09:00'); await click('[data-action="notif-broadcast-send"]');
  var ns=(w.DB.notifSchedules||[])[0]; ok(ns && ns.freq==='monthly' && ns.monthDay===15 && /Setiap tanggal 15/.test(app()), 'jadwal bulanan tersimpan & tampil');
  ns.createdAt='2026-01-01T00:00:00Z';
  var t15=Date.UTC(2026,10,15,2,1); /* 15 Nov 09:01 WIB */
  var before=w.DB.notifications.length; ok(w.runDueSchedules(t15)===1 && w.DB.notifications.length-before===4, 'tanggal 15 jam 09:01 -> terkirim ke 4 karyawan');
  ok(w.runDueSchedules(t15+600000)===0, 'tidak terkirim dua kali di hari yang sama');
  ok(w.runDueSchedules(Date.UTC(2026,10,16,2,1))===0 && w.runDueSchedules(Date.UTC(2026,11,15,1,0))===0 && w.runDueSchedules(Date.UTC(2026,11,15,2,0))===1, 'bulan berikutnya terkirim lagi tepat jamnya');
  var dly={freq:'daily',time:'07:30',target:'hod',message:'x',createdAt:'2026-01-01T00:00:00Z'};
  ok(w.nsDueKey(dly,Date.UTC(2026,10,3,0,29))===null && w.nsDueKey(dly,Date.UTC(2026,10,3,0,31))==='2026-11-03', 'harian: jam 07:30 WIB');
  var mo={freq:'monthly',monthDay:31,time:'08:00',target:'all',message:'x',createdAt:'2026-01-01T00:00:00Z'};
  ok(w.nsDueKey(mo,Date.UTC(2026,10,30,1,5))==='2026-11-30', 'tanggal 31 di bulan 30 hari -> akhir bulan');
  await click('[data-action="ns-toggle"]'); ok(ns.active===false && w.runDueSchedules(Date.UTC(2027,0,15,3,0))===0, 'jadwal bisa dijeda');
  var sc=await import(path.join(__dirname,'..','scripts','run-schedules.mjs'));
  ok(sc.nsDueKey(dly,Date.UTC(2026,10,3,0,31))===w.nsDueKey(dly,Date.UTC(2026,10,3,0,31)) && sc.nsDueKey(mo,Date.UTC(2026,10,30,1,5))==='2026-11-30', 'runner server = logika aplikasi');

  console.log('\n[iPhone & sidebar]');
  Object.defineProperty(w.navigator,'userAgent',{value:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit Safari',configurable:true});
  as('staff','S1','dashboard'); ok(/Pasang ABC Selaras di iPhone/.test(app()), 'iPhone di Safari: panduan Tambah ke Layar Utama');
  await click('[data-action="ios-guide-dismiss"]'); ok(!/Pasang ABC Selaras di iPhone/.test(app()), 'panduan bisa ditutup');
  as('staff','S1','notif-settings'); ok(/Tambah ke Layar Utama/.test(app()), 'panduan juga di Pengaturan Notifikasi');
  ok(/\.sidebar\{position:fixed;[^}]*overflow-y:auto/.test(html), 'sidebar HP bisa di-scroll');
  console.log('\n'+pass+' ok, '+fail+' gagal'); process.exit(fail?1:0);
})();

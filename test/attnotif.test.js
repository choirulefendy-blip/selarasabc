/* Tes: notifikasi absen staf ke HR & HOD + pengaturannya + "belum absen" (server). */
var fs=require('fs'),path=require('path'),JSDOM=require('jsdom').JSDOM;
var html=fs.readFileSync(path.join(__dirname,'..','web','index.html'),'utf8')
  .replace(/var SUPABASE_URL = '[^']*'/,"var SUPABASE_URL = ''").replace(/var SUPABASE_ANON_KEY = '[^']*'/,"var SUPABASE_ANON_KEY = ''")
  .replace(/var PUSH_FUNCTION_URL = '[^']*'/,"var PUSH_FUNCTION_URL = ''").replace(/var EMAIL_FUNCTION_URL = '[^']*'/,"var EMAIL_FUNCTION_URL = ''");
var pass=0,fail=0; function ok(c,n){ if(c){pass++;console.log('  ok   - '+n);}else{fail++;console.log('  FAIL - '+n);} }
function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}
(async function(){
  var dom=new JSDOM(html,{url:'https://abc.test/',runScripts:'dangerously',pretendToBeVisual:true});
  var w=dom.window; w.console.error=function(){}; w.scrollTo=function(){}; await sleep(400);
  var d=w.document;
  function emp(id,name,dept){ return {id:id,empCode:id,name:name,position:'Staff',department:dept,properties:[],joinDate:'2025-01-01',active:true,username:id,password:'p'}; }
  w.DB.employees=[emp('H1','Hana HOD','Front Office'),emp('F1','Fani','Front Office'),emp('K1','Koki','Kitchen')];
  w.DB.departmentHods={'Front Office':['H1']}; w.DB.officeLocations=[]; w.DB.settings.gracePeriodMinutes=0; w.DB.settings.flexDepts=[];
  var ym='2026-10'; w.DB.schedules[ym]={F1:{1:{type:'kerja',start:'08:00',end:'16:00'},2:{type:'kerja',start:'08:00',end:'16:00'}}}; w.DB.attendance[ym]={F1:{1:{checkIn:'07:55'},2:{checkIn:'08:20'}}};
  function forA(a){ return w.DB.notifications.filter(function(n){ return a==='hr' ? n.audience.type==='hr' : n.audience.empId===a; }); }

  console.log('\n[Bawaan]');
  w.DB.notifications=[]; w.raiseAttendanceAlerts('F1',ym,1,'in','07:55');
  ok(forA('hr').length===0 && forA('H1').length===0, 'absen masuk tepat waktu: bawaan tidak ramai (mati)');
  w.DB.notifications=[]; w.raiseAttendanceAlerts('F1',ym,2,'in','08:20');
  ok(forA('hr').length===1 && /TELAT 20/.test(forA('hr')[0].message) && forA('H1').length===1 && forA('H1')[0].link==='hod-attendance', 'telat: HR & HOD departemen diberi tahu');
  w.DB.notifications=[]; w.raiseAttendanceAlerts('K1',ym,2,'in','08:20');
  ok(forA('H1').length===0, 'HOD tidak menerima absen departemen lain');

  console.log('\n[Pengaturan]');
  w.SESSION={role:'hod',empId:'H1'}; w.STATE.view='notif-settings'; w.render();
  ok(/Notifikasi Absen Staf/.test(d.getElementById('app').textContent) && /Front Office/.test(d.getElementById('app').textContent), 'HOD: kartu Notifikasi Absen Staf');
  var sw=d.querySelector('[data-action="toggle-notif-pref"][data-key="attIn"]');
  ok(sw && !sw.classList.contains('on'), 'Setiap absen masuk: bawaan mati');
  sw.dispatchEvent(new w.MouseEvent('click',{bubbles:true})); await sleep(100);
  ok(w.getNotifPrefs({type:'emp',empId:'H1'}).attIn===true && d.querySelector('[data-action="toggle-notif-pref"][data-key="attIn"]').classList.contains('on'), 'HOD menyalakan "Setiap absen masuk"');
  w.DB.notifications=[]; w.raiseAttendanceAlerts('F1',ym,1,'in','07:55');
  ok(forA('H1').length===1 && /absen masuk pukul 07:55 · tepat waktu/.test(forA('H1')[0].message) && forA('hr').length===0, 'HOD dapat notifikasi setiap absen masuk, HR tetap tidak (pengaturan masing-masing)');
  d.querySelector('[data-action="toggle-notif-pref"][data-key="late"]').dispatchEvent(new w.MouseEvent('click',{bubbles:true})); await sleep(100);
  w.DB.notifications=[]; w.raiseAttendanceAlerts('F1',ym,2,'in','08:20');
  ok(forA('H1').length===1 && /✅.*telat 20 menit/.test(forA('H1')[0].message) && !/TELAT/.test(forA('H1')[0].message) && forA('hr').length===1 && /TELAT/.test(forA('hr')[0].message), 'telat dimatikan HOD: HOD hanya dapat info absen masuk (telat 20 mnt), HR tetap dapat TELAT');
  w.SESSION={role:'hr',empId:null,hrAccountId:null}; w.render();
  ok(!!d.querySelector('[data-action="toggle-notif-pref"][data-key="attOut"]'), 'HR: pengaturan absen pulang');
  d.querySelector('[data-action="toggle-notif-pref"][data-key="attOut"]').dispatchEvent(new w.MouseEvent('click',{bubbles:true})); await sleep(100);
  w.DB.attendance[ym].F1[1].checkOut='16:05'; w.DB.notifications=[]; w.raiseAttendanceAlerts('F1',ym,1,'out','16:05');
  ok(forA('hr').length===1 && /absen pulang pukul 16:05 · masuk 07:55, kerja 8j 10m/.test(forA('hr')[0].message), 'HR: notifikasi absen pulang + lama kerja');

  console.log('\n[Server: belum absen]');
  var mod=await import(path.join(__dirname,'..','scripts','run-schedules.mjs'));
  function db(){ return {employees:[{id:'H1',name:'Hana',department:'FO',active:true},{id:'A',name:'Andi',department:'FO',active:true},{id:'B',name:'Budi',department:'FO',active:true},{id:'C',name:'Cici',department:'FO',active:true}],
    departmentHods:{FO:['H1']}, schedules:{'2026-11':{A:{2:{type:'kerja',start:'08:00',end:'16:00'}},B:{2:{type:'kerja',start:'08:00',end:'16:00'}},C:{2:{type:'kerja',start:'08:00',end:'16:00'}}}},
    attendance:{'2026-11':{C:{2:{checkIn:'07:50'}}}}, notifications:[]}; }
  var t0=Date.UTC(2026,10,2,1,0)/*08:00 WIB*/;
  var x=db(); ok(mod.runAttMissing(x, t0+20*60000).length===0, 'belum 30 menit: tidak dikirim');
  var r=mod.runAttMissing(x, t0+35*60000);
  var hr=r.filter(function(q){ return q.empId==='hr'; })[0], hod=r.filter(function(q){ return q.empId==='H1'; })[0];
  ok(hr && /2 staf/.test(hr.text) && /Andi/.test(hr.text) && /Budi/.test(hr.text) && !/Cici/.test(hr.text), 'HR: 1 notifikasi berisi daftar staf belum absen (yang sudah absen tidak)');
  ok(hod && r.some(function(q){ return q.empId==='A' && /belum absen masuk/.test(q.text); }), 'HOD & staf ybs diberi tahu');
  ok(mod.runAttMissing(x, t0+45*60000).length===0, 'tidak dikirim dua kali');
  var y=db(); y.notifPrefs={hr:{attMissing:false}}; ok(!mod.runAttMissing(y, t0+35*60000).some(function(q){ return q.empId==='hr'; }), 'menghormati pengaturan "Staf belum absen"');
  console.log('\nHasil: '+pass+' lulus, '+fail+' gagal'); process.exit(fail?1:0);
})();

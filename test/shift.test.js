/* Tes: pengingat 30 menit sebelum shift (APK lokal, toast, server). */
var fs=require('fs'),path=require('path'),JSDOM=require('jsdom').JSDOM;
var html=fs.readFileSync(path.join(__dirname,'..','web','index.html'),'utf8')
  .replace(/var SUPABASE_URL = '[^']*'/,"var SUPABASE_URL = ''").replace(/var SUPABASE_ANON_KEY = '[^']*'/,"var SUPABASE_ANON_KEY = ''")
  .replace(/var PUSH_FUNCTION_URL = '[^']*'/,"var PUSH_FUNCTION_URL = ''").replace(/var EMAIL_FUNCTION_URL = '[^']*'/,"var EMAIL_FUNCTION_URL = ''");
var pass=0,fail=0; function ok(c,n){ if(c){pass++;console.log('  ok   - '+n);}else{fail++;console.log('  FAIL - '+n);} }
function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}
function ymOf(d){ return d.getFullYear()+'-'+(d.getMonth()<9?'0':'')+(d.getMonth()+1); }
(async function(){
  var dom=new JSDOM(html,{url:'https://abc.test/',runScripts:'dangerously',pretendToBeVisual:true});
  var w=dom.window; w.console.error=function(){}; w.scrollTo=function(){}; await sleep(400);
  w.DB.employees=[{id:'S1',empCode:'ABC-S1',name:'Sari',position:'Staff',department:'Marketing',properties:[],joinDate:'2025-01-01',active:true,username:'s1',password:'p'}];
  var base=new Date(); base.setHours(12,0,0,0); w.DB.schedules={};
  for(var i=0;i<9;i++){ var d=new Date(base.getTime()+i*864e5), ym=ymOf(d); w.DB.schedules[ym]=w.DB.schedules[ym]||{}; w.DB.schedules[ym].S1=w.DB.schedules[ym].S1||{};
    w.DB.schedules[ym].S1[d.getDate()]= i===2?{type:'libur'}:{type:'kerja',start:'23:50',end:'07:00',shift:'Malam'}; }
  w.SESSION={role:'staff',empId:'S1'}; w.STATE.loaded=true;

  console.log('\n[Rencana pengingat]');
  var plan=w.shiftRemPlan('S1',Date.now());
  ok(plan.length===7, '7 shift kerja dalam 8 hari (1 libur dilewati)');
  ok(plan.every(function(p){ return p.startMs-p.atMs===30*60000; }), 'pengingat tepat 30 menit sebelum mulai');

  console.log('\n[APK: notifikasi lokal]');
  var scheduled=[], cancelled=0;
  w.isNativeApp=function(){ return true; };
  w.Capacitor={Plugins:{LocalNotifications:{schedule:function(o){ scheduled=scheduled.concat(o.notifications); }, cancel:function(){ cancelled++; }, createChannel:function(){}, addListener:function(){}}}};
  w.shiftReminderSync();
  ok(scheduled.length>=6 && scheduled.every(function(n){ return /30 menit/.test(n.title) && /absen masuk/.test(n.body) && n.extra.link==='checkin'; }), 'notifikasi lokal dijadwalkan untuk hari-hari kerja ('+scheduled.length+')');
  ok(cancelled===1, 'jadwal lama dibatalkan dulu (tidak dobel)');
  ok(w.DB.shiftRemNative.S1===w.todayISO(), 'server diberi tanda: HP ini pakai pengingat lokal');
  var n0=scheduled.length; w.shiftReminderSync(); ok(scheduled.length===n0, 'tidak dijadwalkan ulang bila tidak ada perubahan');
  w.DB.notifPrefs={emp:{S1:{shift:false}}}; scheduled=[]; w.shiftReminderSync();
  ok(scheduled.length===0 && cancelled===2, 'kategori "Pengingat shift" dimatikan -> semua dibatalkan');
  w.DB.notifPrefs={};

  console.log('\n[Aplikasi terbuka: toast]');
  w.isNativeApp=function(){ return false; }; w.Capacitor=undefined;
  var t=new Date(); t.setHours(12,0,0,0); var tym=ymOf(t), soon=new Date(Date.now()+20*60000);
  var hh=('0'+soon.getHours()).slice(-2)+':'+('0'+soon.getMinutes()).slice(-2);
  var sameDay = soon.getDate()===new Date().getDate();
  if(sameDay){
    w.DB.schedules[tym].S1[t.getDate()]={type:'kerja',start:hh,end:'23:59'};
    var toasts=[]; var ot=w.toast; w.toast=function(m){ toasts.push(m); };
    w.shiftReminderSync(); w.shiftReminderSync();
    ok(toasts.length===1 && /Shift dimulai pukul/.test(toasts[0]), 'dalam 30 menit sebelum shift -> toast sekali');
    w.DB.attendance[tym]=w.DB.attendance[tym]||{}; w.DB.attendance[tym].S1={}; w.DB.attendance[tym].S1[t.getDate()]={checkIn:'08:00'};
    try{ w.localStorage.clear(); }catch(e){} toasts=[]; w.shiftReminderSync();
    ok(toasts.length===0, 'sudah absen masuk -> tidak diingatkan');
    w.toast=ot;
  } else { ok(true,'(toast dilewati: dekat tengah malam)'); ok(true,'(dilewati)'); }
  ok(w.NOTIF_CATS_EMP.some(function(c){ return c.k==='shift'; }), 'ada saklar "Pengingat shift" di Pengaturan Notifikasi');

  console.log('\n[Server (GitHub Action)]');
  var mod=await import(path.join(__dirname,'..','scripts','run-schedules.mjs'));
  var start=Date.UTC(2026,10,2,2,0)/*09:00 WIB*/;
  function db(){ return {employees:[{id:'A',active:true},{id:'B',active:true},{id:'C',active:true}],
    schedules:{'2026-11':{A:{2:{type:'kerja',start:'09:00',end:'17:00'}},B:{2:{type:'kerja',start:'09:00',end:'17:00'}},C:{2:{type:'kerja',start:'09:00',end:'17:00'}}}},
    attendance:{'2026-11':{C:{2:{checkIn:'08:20'}}}}, shiftRemNative:{B:'2026-11-01'}, notifications:[]}; }
  var x=db(), r=mod.runShiftReminders(x, start-20*60000);
  ok(r.length===2 && x.notifications.length===2, '20 menit sebelum: 2 orang diingatkan (C sudah absen)');
  ok(r.find(function(q){return q.empId==='A';}).push===true && r.find(function(q){return q.empId==='B';}).push===false, 'pengguna APK tidak dapat push dobel (cukup lokal), lainnya dapat push');
  ok(/pekerjaan akan dimulai pukul 09:00/.test(x.notifications[0].message) && /absen masuk/.test(x.notifications[0].message), 'isi pesan');
  ok(mod.runShiftReminders(x, start-10*60000).length===0, 'tidak dikirim dua kali');
  ok(mod.runShiftReminders(db(), start-40*60000).length===0 && mod.runShiftReminders(db(), start+60000).length===0, 'di luar jendela 30 menit -> tidak dikirim');
  var y=db(); y.notifPrefs={emp:{A:{shift:false}}}; ok(mod.runShiftReminders(y, start-20*60000).every(function(q){ return q.empId!=='A'; }), 'menghormati saklar pengingat shift');
  var z={employees:[{id:'A',active:true}],schedules:{'2026-11':{A:{3:{type:'kerja',start:'00:15',end:'08:00'}}}}};
  ok(mod.runShiftReminders(z, Date.UTC(2026,10,2,16,50)/*23:50 WIB tgl 2*/).length===1, 'shift dini hari (00:15) diingatkan 23:45 malam sebelumnya');

  console.log('\nHasil: '+pass+' lulus, '+fail+' gagal'); process.exit(fail?1:0);
})();

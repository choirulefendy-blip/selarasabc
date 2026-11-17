/* Tes: saveDB menggabungkan data server dulu — absen orang lain tidak tertimpa. */
var fs=require('fs'),path=require('path'),JSDOM=require('jsdom').JSDOM;
var html=fs.readFileSync(path.join(__dirname,'..','web','index.html'),'utf8')
  .replace(/var SUPABASE_URL = '[^']*'/,"var SUPABASE_URL = ''").replace(/var SUPABASE_ANON_KEY = '[^']*'/,"var SUPABASE_ANON_KEY = ''");
var pass=0,fail=0; function ok(c,n){ if(c){pass++;console.log('  ok   - '+n);}else{fail++;console.log('  FAIL - '+n);} }
function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}
(async function(){
  var dom=new JSDOM(html,{url:'https://abcselaras.my.id/web/',runScripts:'dangerously',pretendToBeVisual:true});
  var w=dom.window; w.console.error=function(){}; w.scrollTo=function(){}; await sleep(400);
  var SERVER={};
  w.BACKEND='supabase';
  w.hasRemoteStorage=function(){ return true; };
  w.remoteGet=function(k){ return Promise.resolve(SERVER[k]!==undefined?{value:SERVER[k]}:null); };
  w.storageSet=function(k,v){ SERVER[k]=v; return Promise.resolve({key:k,value:v}); };
  w.STATE.offline=false; w.STATE.loadError=false; w.STATE.loaded=true;
  w.SESSION={role:'staff',empId:'B'};
  var ym='2026-11', day='17';
  // Device A sudah menyimpan absen MOCH (emp 'A') ke server
  w.DB.employees=[{id:'A',name:'MOCH CHOIRUL EFENDI',username:'moch',active:true,department:'Marketing'},{id:'B',name:'Budi',username:'budi',active:true,department:'Marketing'}];
  var base={employees:w.DB.employees, attendance:{}, todos:[], notifications:[], announcements:[], activityLog:[]};
  base.attendance[ym]={A:{}}; base.attendance[ym].A[day]={checkIn:'08:00', condition:'sehat'};
  SERVER.hrdb=JSON.stringify(base);
  // Device B lokal: TIDAK punya absen MOCH (salinan lama), lalu menyimpan sesuatu (mis. absennya sendiri)
  w.DB.attendance={}; w.DB.attendance[ym]={B:{}}; w.DB.attendance[ym].B[day]={checkIn:'08:05', condition:'sehat'};
  await w.saveDB(true);
  var srv=JSON.parse(SERVER.hrdb);
  ok(srv.attendance[ym] && srv.attendance[ym].A && srv.attendance[ym].A[day] && srv.attendance[ym].A[day].checkIn==='08:00', 'absen MOCH (perangkat lain) tidak tertimpa saat device B menyimpan');
  ok(srv.attendance[ym].B && srv.attendance[ym].B[day].checkIn==='08:05', 'absen device B sendiri juga tersimpan');

  console.log('\nHASIL: '+pass+' lulus, '+fail+' gagal');
  process.exit(fail?1:0);
})().catch(function(e){ console.error(e); process.exit(1); });

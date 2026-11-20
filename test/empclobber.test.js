/* Tes: data karyawan tidak hilang tertimpa antar perangkat (tambah/hapus/ubah). */
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
  w.SESSION={role:'hr',empId:null};

  function baseDB(emps, del){
    return {employees:emps, deletedEmployees:del||{}, attendance:{}, todos:[], notifications:[], announcements:[],
      activityLog:[], leaveRequests:[], overtimeRequests:[], formRequests:[], kpiRecords:[]};
  }

  console.log('\n[Tambah karyawan dari perangkat lain]');
  // Server (device A) sudah berisi karyawan baru "ERIC" (ditambah device A, punya updatedAt)
  var A={id:'A',name:'ADHYTIA',username:'adhy',active:true,department:'Marketing',updatedAt:'2026-11-19T10:00:00.000Z'};
  var ERIC={id:'E_new',name:'ERIC DWI ILHAM',username:'eric',active:true,department:'Kitchen',empCode:'KLY-26-0000-052',updatedAt:'2026-11-19T12:00:00.000Z'};
  SERVER.hrdb=JSON.stringify(baseDB([A,ERIC]));
  // Device B (salinan lama) HANYA punya ADHYTIA, lalu menyimpan sesuatu
  w.DB.employees=[{id:'A',name:'ADHYTIA',username:'adhy',active:true,department:'Marketing',updatedAt:'2026-11-19T10:00:00.000Z'}];
  w.DB.deletedEmployees={};
  await w.saveDB(true);
  var srv=JSON.parse(SERVER.hrdb);
  ok(srv.employees.some(function(e){ return e.id==='E_new'; }), 'karyawan baru (ERIC) dari perangkat lain tidak hilang saat device B menyimpan');
  ok(w.DB.employees.some(function(e){ return e.id==='E_new'; }), 'device B ikut menerima ERIC setelah sinkron');

  console.log('\n[Hapus karyawan (tombstone) tidak hidup lagi]');
  // Server: ADHYTIA ada, dan C sudah dihapus (tombstone)
  SERVER.hrdb=JSON.stringify(baseDB([A], {C_del:'2026-11-19T13:00:00.000Z'}));
  // Device B lama masih memegang C
  w.DB.employees=[{id:'A',name:'ADHYTIA',username:'adhy',active:true,department:'Marketing',updatedAt:'2026-11-19T10:00:00.000Z'},
                  {id:'C_del',name:'KARYAWAN LAMA',username:'lama',active:true,department:'Service',updatedAt:'2026-11-18T09:00:00.000Z'}];
  w.DB.deletedEmployees={};
  await w.saveDB(true);
  srv=JSON.parse(SERVER.hrdb);
  ok(!srv.employees.some(function(e){ return e.id==='C_del'; }), 'karyawan yang sudah dihapus tidak dihidupkan lagi oleh perangkat lama');
  ok(srv.deletedEmployees && srv.deletedEmployees.C_del, 'tombstone penghapusan ikut tersimpan');

  console.log('\n[Ubah karyawan: versi terbaru menang]');
  // Server punya versi BARU (nama diperbaiki, updatedAt lebih baru)
  SERVER.hrdb=JSON.stringify(baseDB([{id:'A',name:'ADHYTIA AGUNG SURYA PRATAMA',username:'adhy',active:true,department:'Marketing',updatedAt:'2026-11-19T15:00:00.000Z'}]));
  // Device B lama punya nama lama (updatedAt lebih tua), lalu menyimpan
  w.DB.employees=[{id:'A',name:'ADHYTIA',username:'adhy',active:true,department:'Marketing',updatedAt:'2026-11-19T10:00:00.000Z'}];
  w.DB.deletedEmployees={};
  await w.saveDB(true);
  srv=JSON.parse(SERVER.hrdb);
  var aSrv=srv.employees.find(function(e){ return e.id==='A'; });
  ok(aSrv && aSrv.name==='ADHYTIA AGUNG SURYA PRATAMA', 'perubahan terbaru karyawan tidak kembali ke versi lama');

  console.log('\n[Pengajuan cuti baru dari perangkat lain tidak hilang]');
  var bLeave=baseDB([A]); bLeave.leaveRequests=[{id:'L_new',empId:'A',status:'pending_hr',submittedAt:'2026-11-19T16:00:00.000Z'}];
  SERVER.hrdb=JSON.stringify(bLeave);
  w.DB.employees=[A]; w.DB.deletedEmployees={}; w.DB.leaveRequests=[]; // device B tidak punya pengajuan itu
  await w.saveDB(true);
  srv=JSON.parse(SERVER.hrdb);
  ok((srv.leaveRequests||[]).some(function(r){ return r.id==='L_new'; }), 'pengajuan cuti baru dari perangkat lain tidak tertimpa');

  console.log('\nHASIL: '+pass+' lulus, '+fail+' gagal');
  process.exit(fail?1:0);
})().catch(function(e){ console.error(e); process.exit(1); });

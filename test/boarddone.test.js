/* Tes: kartu Board pindah ke Done tetap tersimpan (anti-clobber antar perangkat). */
var fs=require('fs'),path=require('path'),JSDOM=require('jsdom').JSDOM;
var html=fs.readFileSync(path.join(__dirname,'..','web','index.html'),'utf8')
  .replace(/var SUPABASE_URL = '[^']*'/,"var SUPABASE_URL = ''").replace(/var SUPABASE_ANON_KEY = '[^']*'/,"var SUPABASE_ANON_KEY = ''");
var pass=0,fail=0; function ok(c,n){ if(c){pass++;console.log('  ok   - '+n);}else{fail++;console.log('  FAIL - '+n);} }
function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}
(async function(){
  var dom=new JSDOM(html,{url:'https://abcselaras.my.id/web/',runScripts:'dangerously',pretendToBeVisual:true});
  var w=dom.window; w.console.error=function(){}; w.scrollTo=function(){}; await sleep(400);
  var SERVER={};
  w.hasRemoteStorage=function(){ return false; };
  w.storageGet=function(k){ return Promise.resolve(SERVER[k]!==undefined?{value:SERVER[k]}:null); };
  w.storageSet=function(k,v){ SERVER[k]=v; return Promise.resolve(true); };
  w.STATE.offline=false; w.STATE.loadError=false; w.STATE.loaded=true;
  w.DB.employees=[{id:'S1',name:'Sari',username:'sari',active:true,department:'Marketing',position:'Staff'}];
  w.DB.departmentHods={Marketing:['H1']};
  w.SESSION={role:'hr',empId:null};
  var t0='2026-11-14T03:00:00.000Z';
  w.DB.todos=[{id:'T1',ownerId:'S1',title:'Kartu',status:'doing',createdById:'hr',createdAt:t0,updatedAt:t0}];
  await w.saveDB();

  console.log('\n[Pindah ke Done]');
  await w.todoPersistStatus(w.getTodoById('T1'), 'done');
  ok(JSON.parse(SERVER.hrdb).todos[0].status==='done', 'status Done tersimpan di server');
  // simulasi refresh
  var DB2=JSON.parse(SERVER.hrdb); w.DB=DB2; w.runDBMigrations();
  ok(w.DB.todos[0].status==='done', 'setelah refresh tetap Done');

  console.log('\n[Anti-clobber: server sempat punya salinan lama lebih baru]');
  // perangkat lain menulis todo masih "doing" dengan timestamp LEBIH BARU
  var srv=JSON.parse(SERVER.hrdb); srv.todos[0].status='doing'; srv.todos[0].updatedAt='2026-11-14T09:00:00.000Z'; SERVER.hrdb=JSON.stringify(srv);
  // user memindah ke Done lagi; persist harus merge lalu menang & terverifikasi
  await w.todoPersistStatus(w.getTodoById('T1'), 'done');
  ok(JSON.parse(SERVER.hrdb).todos[0].status==='done', 'perubahan Done menang walau server sempat punya salinan "doing" lebih baru');
  var DB3=JSON.parse(SERVER.hrdb); w.DB=DB3; w.runDBMigrations();
  ok(w.DB.todos[0].status==='done', 'refresh setelah anti-clobber tetap Done');

  console.log('\nHASIL: '+pass+' lulus, '+fail+' gagal');
  process.exit(fail?1:0);
})().catch(function(e){ console.error(e); process.exit(1); });

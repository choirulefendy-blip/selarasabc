/* Tes tombol Back & refresh tetap di halaman terakhir. */
var fs=require('fs'),path=require('path'),JSDOM=require('jsdom').JSDOM;
var html=fs.readFileSync(path.join(__dirname,'..','web','index.html'),'utf8')
  .replace(/var SUPABASE_URL = '[^']*'/,"var SUPABASE_URL = ''").replace(/var SUPABASE_ANON_KEY = '[^']*'/,"var SUPABASE_ANON_KEY = ''");
var pass=0,fail=0; function ok(c,n){ if(c){pass++;console.log('  ok   - '+n);}else{fail++;console.log('  FAIL - '+n);} }
function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}
(async function(){
  var dom=new JSDOM(html,{url:'https://abc.test/web/',runScripts:'dangerously',pretendToBeVisual:true});
  var w=dom.window; w.console.error=function(){}; w.scrollTo=function(){}; await sleep(500);
  w.DB.employees=[{id:'S1',empCode:'S1',name:'Sari',position:'Staff',department:'Marketing',properties:[],joinDate:'2025-01-01',dateOfBirth:'1995-01-01',gender:'Laki-laki',baseSalary:1,mealAllowance:0,transportAllowance:0,address:'',phone:'',email:'',username:'S1',password:'p',active:true}];
  w.SESSION={role:'staff',empId:'S1'}; w.saveSessionToStorage(); w.STATE.view='dashboard'; w.render();
  ok(w.history.length>=2,'ada entri history penjaga');
  w.STATE.view='todo'; w.render(); w.STATE.view='chat'; w.render();
  w.history.back(); await sleep(60);
  ok(w.STATE.view==='todo','Back dari chat -> kembali ke todo (bukan keluar)');
  w.history.back(); await sleep(60);
  ok(w.STATE.view==='dashboard','Back lagi -> dashboard');
  w.history.back(); await sleep(60);
  ok(w.STATE.view==='dashboard' && w.SESSION.role==='staff','Back di halaman awal -> tetap di app');
  w.STATE.view='todo'; w.STATE.boardTab='rekap'; w.render();
  var saved=JSON.parse(w.localStorage.getItem('abcSelarasView')||'null');
  ok(saved && saved.s.view==='todo' && saved.s.boardTab==='rekap','halaman terakhir tersimpan');
  w.STATE.view='dashboard'; w.STATE.boardTab=null; w.navRestoreView();
  ok(w.STATE.view==='todo' && w.STATE.boardTab==='rekap','refresh: halaman terakhir dipulihkan');
  w.document.getElementById('modalRoot').innerHTML='<div>x</div>'; w.history.back(); await sleep(60);
  ok(w.document.getElementById('modalRoot').innerHTML==='' ,'Back menutup modal dulu');
  console.log('\n'+pass+' ok, '+fail+' gagal'); process.exit(fail?1:0);
})();

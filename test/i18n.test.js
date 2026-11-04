/* Tes: bahasa Inggris (pengaturan di Profil Saya). */
var fs=require('fs'),path=require('path'),JSDOM=require('jsdom').JSDOM;
var html=fs.readFileSync(path.join(__dirname,'..','web','index.html'),'utf8').replace(/var SUPABASE_URL = '[^']*'/,"var SUPABASE_URL = ''").replace(/var SUPABASE_ANON_KEY = '[^']*'/,"var SUPABASE_ANON_KEY = ''").replace(/var PUSH_FUNCTION_URL = '[^']*'/,"var PUSH_FUNCTION_URL = ''");
var pass=0,fail=0; function ok(c,n){ if(c){pass++;console.log('  ok   - '+n);}else{fail++;console.log('  FAIL - '+n);} }
function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}
(async function(){
  var dom=new JSDOM(html,{url:'https://abcselaras.my.id/web/',runScripts:'dangerously',pretendToBeVisual:true});
  var w=dom.window; w.console.error=function(){}; w.scrollTo=function(){}; await sleep(400);
  var d=w.document; function app(){ return d.getElementById('app').textContent; }
  w.DB.employees=[{id:'S1',name:'Sari Juni',department:'Marketing',position:'Content Creator',active:true,username:'sari',joinDate:'2024-03-01'}];
  w.SESSION={role:'staff',empId:'S1'}; w.STATE.view='my-profile'; w.render(); await sleep(30);
  ok(/Bahasa \/ Language/.test(app()) && /Data Kepegawaian/.test(app()), 'default Bahasa Indonesia, kartu bahasa di Profil');
  d.querySelector('[data-action="set-lang"][data-lang="en"]').click(); await sleep(60);
  ok(w.DB.employees[0].lang==='en' && d.documentElement.lang==='en', 'pilih English tersimpan di akun');
  ok(/Employment Data/.test(app()) && /Personal Data/.test(app()) && /Join Date/.test(app()) && !/Data Kepegawaian/.test(app()), 'teks Profil jadi English');
  ok(/1 March 2024/.test(app()), 'nama bulan diterjemahkan');
  ok(/Sari Juni/.test(app()), 'nama orang tidak ikut diterjemahkan');
  w.STATE.view='dashboard'; w.render(); await sleep(60);
  ok(/My Profile|Announcements|Attendance/.test(d.body.textContent), 'menu sidebar English');
  w.toast('Profil disimpan.'); await sleep(30);
  ok(/Profile saved\./.test(d.getElementById('toastEl').textContent), 'toast diterjemahkan');
  w.STATE.view='my-profile'; w.render(); await sleep(30);
  d.querySelector('[data-action="set-lang"][data-lang="id"]').click(); await sleep(60);
  ok(/Data Kepegawaian/.test(app()) && d.documentElement.lang==='id', 'kembali ke Bahasa Indonesia');
  console.log('\n'+pass+' lulus, '+fail+' gagal'); process.exit(fail?1:0);
})();

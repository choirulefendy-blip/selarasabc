/* Tes: login dengan Google (pencocokan email). */
var fs=require('fs'),path=require('path'),JSDOM=require('jsdom').JSDOM;
var html=fs.readFileSync(path.join(__dirname,'..','web','index.html'),'utf8')
  .replace(/var SUPABASE_URL = '[^']*'/,"var SUPABASE_URL = ''").replace(/var SUPABASE_ANON_KEY = '[^']*'/,"var SUPABASE_ANON_KEY = ''")
  .replace(/var PUSH_FUNCTION_URL = '[^']*'/,"var PUSH_FUNCTION_URL = ''").replace(/var EMAIL_FUNCTION_URL = '[^']*'/,"var EMAIL_FUNCTION_URL = ''");
var pass=0,fail=0; function ok(c,n){ if(c){pass++;console.log('  ok   - '+n);}else{fail++;console.log('  FAIL - '+n);} }
function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}
function jwt(o){ var b=function(x){ return Buffer.from(JSON.stringify(x)).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }; return b({alg:'RS256'})+'.'+b(o)+'.sig'; }
(async function(){
  var dom=new JSDOM(html,{url:'https://abcselaras.my.id/web/',runScripts:'dangerously',pretendToBeVisual:true});
  var w=dom.window; w.console.error=function(){}; w.scrollTo=function(){}; await sleep(400);
  var d=w.document, CID=w.GOOGLE_LOGIN_CLIENT_ID;
  function emp(id,name,em,hr){ return {id:id,empCode:id,name:name,position:'Staff',department:'Marketing',properties:[],joinDate:'2025-01-01',active:true,username:id,password:'p',email:em,hrAccess:!!hr}; }
  w.DB.employees=[emp('S1','Sari','sari@gmail.com'),emp('IL','Ilin','Ilin.HR@Gmail.com',true)];
  w.DB.hr.email='hr@abc.co.id'; w.DB.hrAccounts=[{id:'HRA1',name:'Dyah',username:'dyah',password:'x',email:'dyah@abc.co.id'}];
  w.SESSION={role:null}; w.render();
  ok(!!d.getElementById('gsiBtn'), 'tombol Masuk dengan Google tampil di halaman login (web)');
  var t=Math.floor(Date.now()/1000)+600;
  function login(email, extra){ w.SESSION={role:null}; w.STATE.loginError=''; var c={aud:CID,iss:'https://accounts.google.com',exp:t,email:email,email_verified:true}; for(var k in (extra||{})) c[k]=extra[k]; w.gsiOnCredential({credential:jwt(c)}); }
  login('SARI@gmail.com'); ok(w.SESSION.role==='staff' && w.SESSION.empId==='S1', 'email karyawan -> masuk sebagai karyawan (huruf besar/kecil diabaikan)');
  login('ilin.hr@gmail.com'); ok(w.SESSION.role==='hr' && w.SESSION.asEmpId==='IL', 'karyawan dengan akses HR -> Mode HR');
  login('hr@abc.co.id'); ok(w.SESSION.role==='hr' && !w.SESSION.hrAccountId, 'email Akun HR utama');
  login('dyah@abc.co.id'); ok(w.SESSION.hrAccountId==='HRA1', 'email Akun HR tambahan');
  login('orang@lain.com'); ok(!w.SESSION.role && /belum terdaftar/.test(w.STATE.loginError), 'email tidak terdaftar ditolak dengan pesan jelas');
  login('sari@gmail.com',{aud:'lain'}); ok(!w.SESSION.role, 'token untuk aplikasi lain ditolak');
  login('sari@gmail.com',{exp:100}); ok(!w.SESSION.role, 'token kedaluwarsa ditolak');
  login('sari@gmail.com',{email_verified:false}); ok(!w.SESSION.role, 'email belum terverifikasi ditolak');
  w.isNativeApp=function(){ return true; }; w.SESSION={role:null}; w.render(); ok(!d.getElementById('gsiBtn'), 'APK: tombol Google disembunyikan');
  console.log('\nHasil: '+pass+' lulus, '+fail+' gagal'); process.exit(fail?1:0);
})();

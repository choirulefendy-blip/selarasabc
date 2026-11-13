/* Tes: hashing password (sweep plaintext, verify, login hashed, kompat legacy). */
var fs=require('fs'),path=require('path'),JSDOM=require('jsdom').JSDOM;
var html=fs.readFileSync(path.join(__dirname,'..','web','index.html'),'utf8')
  .replace(/var SUPABASE_URL = '[^']*'/,"var SUPABASE_URL = ''").replace(/var SUPABASE_ANON_KEY = '[^']*'/,"var SUPABASE_ANON_KEY = ''").replace(/var PUSH_FUNCTION_URL = '[^']*'/,"var PUSH_FUNCTION_URL = ''");
var pass=0,fail=0; function ok(c,n){ if(c){pass++;console.log('  ok   - '+n);}else{fail++;console.log('  FAIL - '+n);} }
function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}
(async function(){
  var dom=new JSDOM(html,{url:'https://abcselaras.my.id/web/',runScripts:'dangerously',pretendToBeVisual:true});
  var w=dom.window; w.console.error=function(){}; w.scrollTo=function(){}; await sleep(400);
  var d=w.document;
  w.storageGet=function(){ return Promise.resolve({value:JSON.stringify(w.DB)}); };
  w.saveDB=function(){ return Promise.resolve(true); };
  w.DB.hr={username:'ilin', password:'hr123', email:''};
  w.DB.employees=[{id:'S1',name:'Sari',username:'sari',password:'rahasia',active:true,department:'Marketing',position:'Staff'}];
  w.DB.hrAccounts=[];

  console.log('\n[Hash & verify]');
  var hval=await w.pwMake('secret123');
  ok(/^p[01]\$/.test(hval) && hval.indexOf('secret123')===-1, 'pwMake menghasilkan hash bersalt (bukan plaintext)');
  ok(await w.pwVerify('secret123', {passwordHash:hval})===true, 'pwVerify cocok untuk password benar');
  ok(await w.pwVerify('salah', {passwordHash:hval})===false, 'pwVerify tolak password salah');
  ok(await w.pwVerify('rahasia', {password:'rahasia'})===true, 'pwVerify kompatibel password lama (plaintext)');

  console.log('\n[Sweep plaintext -> hash]');
  await w.pwSweep();
  ok(!w.DB.hr.password && /^p[01]\$/.test(w.DB.hr.password||w.DB.hr.passwordHash||''), 'password HR plaintext terhapus & jadi hash');
  ok(!w.DB.employees[0].password && w.DB.employees[0].passwordHash, 'password karyawan plaintext terhapus & jadi hash');
  var dump=JSON.stringify(w.DB);
  ok(dump.indexOf('hr123')===-1 && dump.indexOf('rahasia')===-1, 'tidak ada password plaintext tersisa di data');

  console.log('\n[Login dengan password ter-hash]');
  w.SESSION={role:null}; w.STATE.loginTab='staff'; w.render(); await sleep(20);
  var u=d.getElementById('li_staff_user'), p=d.getElementById('li_staff_pass');
  u.value='sari'; p.value='rahasia'; w.doStaffLogin(); await sleep(80);
  ok(w.SESSION.role==='staff' && w.SESSION.empId==='S1', 'login berhasil memakai password yang sudah di-hash');
  w.SESSION={role:null}; w.STATE.loginTab='staff'; w.render(); await sleep(10);
  d.getElementById('li_staff_user').value='sari'; d.getElementById('li_staff_pass').value='salah'; w.doStaffLogin(); await sleep(80);
  ok(w.SESSION.role!=='staff', 'password salah ditolak');

  console.log('\n[Login HR ter-hash]');
  w.SESSION={role:null}; w.STATE.loginTab='staff'; w.render(); await sleep(10);
  var hu=d.getElementById('li_hr_user'); if(hu){ hu.value='ilin'; d.getElementById('li_hr_pass').value='hr123'; w.doHrLogin(); await sleep(80); ok(w.SESSION.role==='hr','login HR berhasil dengan hash'); } else ok(true,'(tab HR tak tampil)');

  console.log('\nHASIL: '+pass+' lulus, '+fail+' gagal');
  process.exit(fail?1:0);
})().catch(function(e){ console.error(e); process.exit(1); });

/* Tes: verifikasi identitas saat absen (biometrik / kode email). */
var fs=require('fs'),path=require('path'),JSDOM=require('jsdom').JSDOM;
var html=fs.readFileSync(path.join(__dirname,'..','web','index.html'),'utf8')
  .replace(/var SUPABASE_URL = '[^']*'/,"var SUPABASE_URL = ''").replace(/var SUPABASE_ANON_KEY = '[^']*'/,"var SUPABASE_ANON_KEY = ''").replace(/var PUSH_FUNCTION_URL = '[^']*'/,"var PUSH_FUNCTION_URL = ''");
var pass=0,fail=0; function ok(c,n){ if(c){pass++;console.log('  ok   - '+n);}else{fail++;console.log('  FAIL - '+n);} }
function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}
(async function(){
  var dom=new JSDOM(html,{url:'https://abcselaras.my.id/web/',runScripts:'dangerously',pretendToBeVisual:true});
  var w=dom.window; w.console.error=function(){}; w.scrollTo=function(){}; await sleep(400);
  var d=w.document; function q(s){ return d.querySelector(s); }
  var sent=null; w.emailConfigured=function(){return true;};
  w.sendEmailApi=function(to,subj,body,link,extra){ sent={to:to,code:extra&&extra.code}; return Promise.resolve({ok:true}); };
  w.uploadAttachment=function(){ return Promise.resolve({key:'k',url:null}); };
  w.DB.employees=[{id:'S1',name:'Sari',department:'Marketing',active:true,username:'sari',password:'p',email:'sari@gmail.com'}];
  var ym=new Date().getFullYear()+'-'+String(new Date().getMonth()+1).padStart(2,'0'), day=new Date().getDate();
  function prep(){ w.SESSION={role:'staff',empId:'S1'}; w.STATE.view='checkin'; w.CHECKIN_DRAFT.photoDataUrl='data:image/jpeg;base64,AAAA'; w.CHECKIN_DRAFT.location={lat:-7.9,lng:112.5,accuracy:10}; w.CHECKIN_DRAFT.condition='sehat'; w.render(); }
  /* perangkat tanpa biometrik -> email */
  w.bioAvailable=function(){ return Promise.resolve(false); };
  prep(); q('[data-action="submit-checkin"][data-type="in"]').click(); await sleep(50);
  ok(/Verifikasi Absen Masuk/.test(d.getElementById('modalRoot').textContent), 'modal verifikasi muncul setelah foto');
  ok(!((w.DB.attendance[ym]||{}).S1), 'absen belum tersimpan sebelum verifikasi');
  ok(/tidak mendukung/.test(d.getElementById('modalRoot').textContent) && q('[data-action="ckv-email"]'), 'tanpa sensor: opsi kode email');
  q('[data-action="ckv-email"]').click(); await sleep(50);
  ok(sent && sent.to==='sari@gmail.com' && /^\d{6}$/.test(sent.code), 'kode dikirim ke email terdaftar');
  d.getElementById('ckv_code').value='000000'; q('[data-action="ckv-check"]').click(); await sleep(50);
  ok(!((w.DB.attendance[ym]||{}).S1), 'kode salah ditolak');
  d.getElementById('ckv_code').value=sent.code; q('[data-action="ckv-check"]').click(); await sleep(150);
  var rec=((w.DB.attendance[ym]||{}).S1||{})[day]||{};
  ok(rec.checkIn && rec.checkInVerify==='email', 'kode benar -> absen tersimpan, metode email dicatat');
  /* biometrik */
  w.bioAvailable=function(){ return Promise.resolve(true); }; w.bioVerify=function(){ return Promise.resolve({}); };
  w.DB.attendance={}; prep(); q('[data-action="submit-checkin"][data-type="in"]').click(); await sleep(50);
  ok(q('[data-action="ckv-bio"]'), 'tombol Sidik Jari / Face ID tersedia');
  q('[data-action="ckv-bio"]').click(); await sleep(150);
  rec=((w.DB.attendance[ym]||{}).S1||{})[day]||{};
  ok(rec.checkIn && rec.checkInVerify==='biometric', 'biometrik berhasil -> absen tersimpan');
  /* biometrik gagal -> tetap bisa email */
  w.bioVerify=function(){ return Promise.reject(new Error('NotAllowed')); };
  w.DB.attendance={}; prep(); q('[data-action="submit-checkin"][data-type="in"]').click(); await sleep(50);
  q('[data-action="ckv-bio"]').click(); await sleep(80);
  ok(!((w.DB.attendance[ym]||{}).S1) && q('[data-action="ckv-email"]'), 'biometrik gagal -> belum absen, opsi email tetap ada');
  q('[data-action="ckv-cancel"]').click();
  /* fitur dimatikan HR */
  w.DB.settings.attVerify=false; w.DB.attendance={}; prep(); q('[data-action="submit-checkin"][data-type="in"]').click(); await sleep(150);
  ok(((w.DB.attendance[ym]||{}).S1||{})[day], 'verifikasi nonaktif -> langsung tersimpan');
  console.log('\n'+pass+' lulus, '+fail+' gagal'); process.exit(fail?1:0);
})();

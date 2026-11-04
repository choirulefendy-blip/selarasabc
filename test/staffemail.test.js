var fs=require('fs'),path=require('path'),JSDOM=require('jsdom').JSDOM;
var html=fs.readFileSync(path.join(__dirname,'..','web','index.html'),'utf8')
  .replace(/var SUPABASE_URL = '[^']*'/,"var SUPABASE_URL = ''").replace(/var SUPABASE_ANON_KEY = '[^']*'/,"var SUPABASE_ANON_KEY = ''").replace(/var PUSH_FUNCTION_URL = '[^']*'/,"var PUSH_FUNCTION_URL = ''");
var pass=0,fail=0; function ok(c,n){ if(c){pass++;console.log('  ok   - '+n);}else{fail++;console.log('  FAIL - '+n);} }
function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}
(async function(){
  var dom=new JSDOM(html,{url:'https://abcselaras.my.id/web/',runScripts:'dangerously',pretendToBeVisual:true});
  var w=dom.window; w.console.error=function(){}; w.scrollTo=function(){}; w.HTMLElement.prototype.scrollIntoView=function(){}; await sleep(400);
  var d=w.document, sent=[]; w.emailConfigured=function(){return true;};
  w.sendEmailApi=function(to,s,b,l,x){ sent.push({to:to,code:x&&x.code}); return Promise.resolve({ok:true}); };
  w.DB.employees=[{id:'S1',name:'Sari',department:'Marketing',active:true,username:'sari',password:'p',email:''},{id:'S2',name:'Budi',active:true,email:'budi@gmail.com'}];
  w.SESSION={role:'staff',empId:'S1'}; w.STATE.view='my-profile'; w.render();
  ok(d.getElementById('eg_email'), 'staff tanpa email langsung lihat kolom isi email');
  d.getElementById('eg_email').value='budi@gmail.com'; d.querySelector('[data-action="eg-save"]').click(); await sleep(50);
  ok(!w.DB.employees[0].email, 'email milik orang lain ditolak');
  d.getElementById('eg_email').value='sari@gmail.com'; d.querySelector('[data-action="eg-save"]').click(); await sleep(150);
  ok(w.DB.employees[0].email==='sari@gmail.com', 'staff bisa menyimpan email sendiri');
  ok(sent.length && sent[0].to==='sari@gmail.com', 'kode verifikasi otomatis dikirim');
  ok(w.DB.notifications.some(function(n){ return n.audience.type==='hr' && /Sari menambahkan email/.test(n.message); }), 'HR diberi tahu');
  d.getElementById('eg_code').value=sent[0].code; d.querySelector('[data-action="eg-verify"]').click(); await sleep(100);
  ok(w.empEmailVerified(w.DB.employees[0]), 'kode benar -> email terverifikasi');
  d.querySelector('[data-action="eg-edit-jump"]').click(); await sleep(20);
  ok(d.getElementById('eg_email'), 'tombol Ubah di Data Pribadi membuka kolom email');
  console.log('\n'+pass+' lulus, '+fail+' gagal'); process.exit(fail?1:0);
})();

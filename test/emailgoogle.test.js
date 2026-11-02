/* Tes: Profil Akun Google & Email (centang hijau, verifikasi kode, notifikasi email). */
var fs=require('fs'),path=require('path'),JSDOM=require('jsdom').JSDOM;
var html=fs.readFileSync(path.join(__dirname,'..','web','index.html'),'utf8')
  .replace(/var SUPABASE_URL = '[^']*'/,"var SUPABASE_URL = ''").replace(/var SUPABASE_ANON_KEY = '[^']*'/,"var SUPABASE_ANON_KEY = ''")
  .replace(/var PUSH_FUNCTION_URL = '[^']*'/,"var PUSH_FUNCTION_URL = ''");
var pass=0,fail=0; function ok(c,n){ if(c){pass++;console.log('  ok   - '+n);}else{fail++;console.log('  FAIL - '+n);} }
function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}
function jwt(o){ var b=function(x){ return Buffer.from(JSON.stringify(x)).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }; return b({alg:'RS256'})+'.'+b(o)+'.sig'; }
(async function(){
  var dom=new JSDOM(html,{url:'https://abcselaras.my.id/web/',runScripts:'dangerously',pretendToBeVisual:true});
  var w=dom.window; w.console.error=function(){}; w.scrollTo=function(){}; w.confirm=function(){return true;}; await sleep(400);
  var d=w.document; function app(){ return d.getElementById('app').textContent; }
  async function click(sel){ var el=typeof sel==='string'?d.querySelector(sel):sel; if(!el) throw new Error('tidak ada: '+sel); el.dispatchEvent(new w.MouseEvent('click',{bubbles:true})); await sleep(150); }
  function emp(id,name,em){ return {id:id,empCode:id,name:name,position:'Staff',department:'Marketing',properties:[],joinDate:'2025-01-01',active:true,username:id,password:'p',email:em}; }
  w.DB.employees=[emp('S1','Sari','sari@gmail.com'),emp('S2','Sigit','')];
  /* email aktif (palsu): tangkap panggilan */
  var sent=[]; w.emailConfigured=function(){ return true; };
  w.fetch=function(u,o){ if(/send-email/.test(u)){ sent.push(JSON.parse(o.body)); return Promise.resolve({ok:true,status:200,json:function(){ return Promise.resolve({ok:true}); }}); } return Promise.reject(new Error('x')); };
  w.SESSION={role:'staff',empId:'S1'}; w.STATE.view='my-profile'; w.render();
  ok(/Akun Google & Email/.test(app()) && /sari@gmail.com/.test(app()) && /Belum terverifikasi/.test(app()), 'Profil: email Google tampil, belum terverifikasi');
  ok(!!d.getElementById('gsiLinkBtn') && !!d.querySelector('[data-action="eg-send"]'), 'pilihan: hubungkan Google atau kirim kode');
  ok(d.querySelector('[data-action="eg-notif"]').disabled, 'notifikasi email terkunci sebelum verifikasi');
  await click('[data-action="eg-send"]'); await sleep(100);
  var code=sent[0] && sent[0].code;
  ok(sent.length===1 && sent[0].to==='sari@gmail.com' && sent[0].kind==='code' && /^\d{6}$/.test(code), 'kode 6 digit dikirim ke email');
  d.getElementById('eg_code').value='000000'; await click('[data-action="eg-verify"]'); await sleep(80);
  ok(!w.empEmailVerified(w.getEmployee('S1')), 'kode salah ditolak');
  d.getElementById('eg_code').value=code; await click('[data-action="eg-verify"]'); await sleep(150);
  var s1=w.getEmployee('S1');
  ok(w.empEmailVerified(s1) && s1.emailNotif===true && !!d.querySelector('.eg-check'), 'kode benar: centang hijau + notifikasi email aktif');
  sent=[]; w.addNotification({type:'emp',empId:'S1'},'HR memberi tugas baru: Laporan.','todo','todo'); await sleep(50);
  ok(sent.length===1 && sent[0].to==='sari@gmail.com' && /Laporan/.test(sent[0].body) && /abcselaras\.my\.id\/web\/#todo/.test(sent[0].url), 'notifikasi ikut dikirim ke email (dengan tautan)');
  await click('[data-action="eg-notif"]'); sent=[]; w.addNotification({type:'emp',empId:'S1'},'Tes','todo','todo'); await sleep(50);
  ok(sent.length===0, 'bisa dimatikan');
  sent=[]; w.addNotification({type:'emp',empId:'S2'},'Tes','todo','todo'); await sleep(50); ok(sent.length===0, 'karyawan tanpa email terverifikasi tidak dikirimi email');
  /* ubah email -> verifikasi hilang */
  await click('[data-action="eg-edit"]'); d.getElementById('eg_email').value='sari.baru@gmail.com'; await click('[data-action="eg-save"]');
  ok(!w.empEmailVerified(w.getEmployee('S1')) && !w.getEmployee('S1').emailNotif, 'ganti email: wajib verifikasi ulang');
  /* hubungkan Google */
  w.GSI.mode='link'; var t=Math.floor(Date.now()/1000)+600;
  w.gsiOnLink({credential:jwt({aud:w.GOOGLE_LOGIN_CLIENT_ID,iss:'accounts.google.com',exp:t,email:'sari.baru@gmail.com',email_verified:true})}); await sleep(100);
  ok(w.empGoogleLinked(w.getEmployee('S1')) && /Tersambung Google/.test(app()), 'hubungkan Google: status "Tersambung Google" (centang hijau)');
  w.SESSION={role:'staff',empId:'S2'}; w.render();
  w.gsiOnLink({credential:jwt({aud:w.GOOGLE_LOGIN_CLIENT_ID,iss:'accounts.google.com',exp:t,email:'sari.baru@gmail.com',email_verified:true})}); await sleep(100);
  ok(!w.empGoogleLinked(w.getEmployee('S2')), 'email Google yang sudah dipakai orang lain ditolak');
  /* login Google menandai tersambung */
  w.getEmployee('S2').email='sigit@gmail.com'; w.SESSION={role:null}; w.GSI.mode='login';
  w.gsiOnCredential({credential:jwt({aud:w.GOOGLE_LOGIN_CLIENT_ID,iss:'https://accounts.google.com',exp:t,email:'sigit@gmail.com',email_verified:true})});
  ok(w.SESSION.empId==='S2' && w.empGoogleLinked(w.getEmployee('S2')), 'login dengan Google otomatis menandai akun tersambung');
  console.log('\nHasil: '+pass+' lulus, '+fail+' gagal'); process.exit(fail?1:0);
})();

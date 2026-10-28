/* Tes FCM: sisi aplikasi (plugin Capacitor tiruan) + logika Edge Function (tanda tangan JWT, kirim, hapus token mati). */
var fs = require('fs'), path = require('path'), crypto = require('crypto'), os = require('os');
var JSDOM = require('jsdom').JSDOM;
var pass = 0, fail = 0;
function ok(c, n){ if(c){ pass++; console.log('  ok   - '+n); } else { fail++; console.log('  FAIL - '+n); } }
function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
var html = fs.readFileSync(path.join(__dirname, '..', 'web', 'index.html'), 'utf8')
  .replace(/var SUPABASE_URL = '[^']*'/, "var SUPABASE_URL = ''").replace(/var SUPABASE_ANON_KEY = '[^']*'/, "var SUPABASE_ANON_KEY = ''")
  .replace(/var PUSH_FUNCTION_URL = '[^']*'/, "var PUSH_FUNCTION_URL = ''").replace(/var EMAIL_FUNCTION_URL = '[^']*'/, "var EMAIL_FUNCTION_URL = ''");

(async function(){
  console.log('\n[FCM di aplikasi]');
  ok(/var FCM_ENABLED = false;/.test(html), 'repo/web: FCM_ENABLED default false (aman untuk browser & Pages)');

  var listeners = {}, calls = [], permState = 'prompt';
  var PN = {
    checkPermissions: function(){ return Promise.resolve({receive: permState}); },
    requestPermissions: function(){ permState = 'granted'; return Promise.resolve({receive:'granted'}); },
    register: function(){ calls.push('register'); setTimeout(function(){ listeners.registration && listeners.registration({value:'tok_'+'x'.repeat(40)}); }, 20); return Promise.resolve(); },
    addListener: function(ev, fn){ listeners[ev] = fn; return Promise.resolve({remove:function(){}}); },
    createChannel: function(c){ calls.push('channel:'+c.id); return Promise.resolve(); }
  };
  var dom = new JSDOM(html, {url:'https://abc.test/', runScripts:'dangerously', pretendToBeVisual:true, beforeParse: function(win){
    win.Capacitor = {isNativePlatform:function(){ return true; }, Plugins:{PushNotifications:PN, LocalNotifications:{checkPermissions:function(){ return Promise.resolve({display:'granted'}); }, requestPermissions:function(){ return Promise.resolve({display:'granted'}); }, schedule:function(){}}}};
  }});
  var w = dom.window; w.console.error = function(){}; w.scrollTo = function(){};
  await sleep(400);
  var fetches = [];
  w.fetch = function(u, o){ fetches.push({url:String(u), body:o && o.body}); return Promise.resolve({ok:true, status:200, json:function(){ return Promise.resolve([]); }}); };
  w.SUPABASE_URL = 'https://x.supabase.co'; w.SUPABASE_ANON_KEY = 'anon';
  w.DB.employees.push({id:'E1',empCode:'ABC-1',name:'Budi',position:'Staff',department:'Marketing Communication',properties:[],joinDate:'2025-01-01',dateOfBirth:'1995-01-01',gender:'Laki-laki',baseSalary:1,mealAllowance:0,transportAllowance:0,address:'',phone:'',email:'',username:'budi',password:'pw',active:true});

  w.FCM_ENABLED = false; w.SESSION = {role:'staff', empId:'E1'}; w.render(); await sleep(100);
  ok(calls.length===0, 'FCM_ENABLED=false: tidak mendaftar apa pun');

  w.FCM_ENABLED = true; w.render(); await sleep(200);
  ok(calls.indexOf('register')!==-1 && calls.indexOf('channel:selaras_default')!==-1, 'login di app Android: minta izin, buat channel, register FCM');
  var reg = fetches.filter(function(f){ return f.url.indexOf('/rpc/register_fcm_token')!==-1; })[0];
  ok(reg && JSON.parse(reg.body).p_recipient==='E1' && JSON.parse(reg.body).p_token.indexOf('tok_')===0, 'token dikirim ke server dengan penerima = ID karyawan');
  var n = fetches.length; w.render(); await sleep(50);
  ok(fetches.filter(function(f){ return f.url.indexOf('register_fcm_token')!==-1; }).length===1, 'render ulang tidak mendaftar berulang');
  /* ganti akun di HP yang sama */
  w.SESSION = {role:'hr', empId:null, hrAccountId:null}; w.render(); await sleep(100);
  var regs = fetches.filter(function(f){ return f.url.indexOf('register_fcm_token')!==-1; });
  ok(regs.length===2 && JSON.parse(regs[1].body).p_recipient==='hr', 'ganti akun (HR): token dipindah ke penerima "hr"');
  /* ketuk notifikasi */
  w.STATE.view = 'dashboard'; listeners.pushNotificationActionPerformed({notification:{data:{url:'#chat'}}}); await sleep(50);
  ok(w.STATE.view==='chat', 'ketuk notifikasi membuka halaman tujuan (#chat)');
  listeners.pushNotificationActionPerformed({notification:{data:{url:'#halaman-tidak-ada'}}}); await sleep(30);
  ok(w.STATE.view==='chat', 'tautan tidak dikenal diabaikan');
  /* logout */
  fetches.length = 0;
  w.document.body.insertAdjacentHTML('beforeend', '<button id="lo" data-action="logout"></button>');
  w.document.getElementById('lo').dispatchEvent(new w.MouseEvent('click', {bubbles:true})); await sleep(100);
  ok(fetches.some(function(f){ return f.url.indexOf('/rpc/unregister_fcm_token')!==-1; }), 'logout: token dilepas dari akun (HP bersama tidak menerima notifikasi akun lama)');
  /* di browser biasa */
  var dom2 = new JSDOM(html, {url:'https://abc.test/', runScripts:'dangerously'}); var w2 = dom2.window; await sleep(300);
  w2.FCM_ENABLED = true; w2.SUPABASE_URL='https://x'; w2.SUPABASE_ANON_KEY='k';
  ok(w2.fcmAvailable()===false, 'browser biasa: FCM tidak aktif');

  console.log('\n[Edge Function send-push]');
  var ts = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'functions', 'send-push', 'index.ts'), 'utf8');
  var a = ts.indexOf('const enc = new TextEncoder();'), b = ts.indexOf('/* --------------------------------- Handler');
  ok(a>0 && b>a, 'bagian FCM ditemukan di index.ts');
  var kp = crypto.generateKeyPairSync('rsa', {modulusLength:2048});
  var sa = {project_id:'proj-123', client_email:'svc@proj-123.iam.gserviceaccount.com', private_key: kp.privateKey.export({type:'pkcs8', format:'pem'})};
  var mod = 'let fcmSa: any = ' + JSON.stringify(sa) + ';\n' + ts.slice(a, b) + '\nexport { getFcmAccessToken, sendFcm, isDeadToken };\n';
  var tmp = path.join(os.tmpdir(), 'fcm_mod_'+Date.now()+'.mts'); fs.writeFileSync(tmp, mod);
  var M = await import(tmp);
  var seen = [];
  globalThis.fetch = async function(u, o){
    seen.push({u:String(u), o:o});
    if(String(u).indexOf('oauth2.googleapis.com')!==-1) return {ok:true, status:200, json:async function(){ return {access_token:'AT123', expires_in:3600}; }};
    var tok = JSON.parse(o.body).message.token;
    if(tok==='dead') return {ok:false, status:404, json:async function(){ return {error:{status:'NOT_FOUND', message:'x', details:[{errorCode:'UNREGISTERED'}]}}; }};
    if(tok==='bad') return {ok:false, status:400, json:async function(){ return {error:{status:'INVALID_ARGUMENT', message:'The registration token is not a valid FCM registration token', details:[{errorCode:'INVALID_ARGUMENT'}]}}; }};
    if(tok==='authfail') return {ok:false, status:403, json:async function(){ return {error:{message:'forbidden'}}; }};
    return {ok:true, status:200, json:async function(){ return {name:'ok'}; }};
  };
  var at = await M.getFcmAccessToken();
  ok(at==='AT123', 'access token OAuth didapat');
  var form = String(seen[0].o.body); var jwt = new URLSearchParams(form).get('assertion').split('.');
  var okSig = crypto.verify('RSA-SHA256', Buffer.from(jwt[0]+'.'+jwt[1]), kp.publicKey, Buffer.from(jwt[2].replace(/-/g,'+').replace(/_/g,'/'), 'base64'));
  var claim = JSON.parse(Buffer.from(jwt[1], 'base64url').toString());
  ok(okSig, 'JWT service account bertanda tangan RS256 valid');
  ok(claim.iss===sa.client_email && claim.scope==='https://www.googleapis.com/auth/firebase.messaging' && claim.aud==='https://oauth2.googleapis.com/token', 'klaim JWT benar (iss/scope/aud)');
  await M.getFcmAccessToken(); ok(seen.length===1, 'access token di-cache (tidak minta ulang)');
  var r1 = await M.sendFcm('good', at, 'Judul', 'Isi', '#chat');
  var sent = JSON.parse(seen[seen.length-1].o.body).message;
  ok(r1.ok && seen[seen.length-1].u==='https://fcm.googleapis.com/v1/projects/proj-123/messages:send', 'kirim ke endpoint FCM v1 project yang benar');
  ok(sent.notification.title==='Judul' && sent.data.url==='#chat' && sent.android.notification.channel_id==='selaras_default' && sent.android.priority==='HIGH', 'payload: judul, data.url, channel, prioritas tinggi');
  ok((await M.sendFcm('dead', at, 't', 'b', '#')).dead===true, 'token UNREGISTERED ditandai mati (akan dihapus)');
  ok((await M.sendFcm('bad', at, 't', 'b', '#')).dead===true, 'token tidak valid ditandai mati');
  var rf = await M.sendFcm('authfail', at, 't', 'b', '#'); ok(rf.ok===false && rf.dead===false, 'galat izin (403) TIDAK menghapus token');

  console.log('\n[SQL]');
  var sql = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'fcm.sql'), 'utf8');
  var schema = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'schema.sql'), 'utf8');
  ok(/enable row level security/.test(sql) && !/create policy/.test(sql), 'fcm_tokens: RLS aktif tanpa policy anon');
  ok(/security definer/.test(sql) && /grant execute on function register_fcm_token/.test(sql), 'RPC register/unregister tersedia untuk anon');
  ok(schema.indexOf('register_fcm_token')!==-1, 'schema.sql ikut memuat tabel FCM');

  console.log('\nHASIL: '+pass+' lulus, '+fail+' gagal');
  process.exit(fail?1:0);
})().catch(function(e){ console.error('TES CRASH', e); process.exit(2); });

/* Tes: ikon/logo baru, foto profil Google, gambar layar memuat yang bisa diganti, banner khusus HP + aksi ketuk. */
var fs = require('fs'), path = require('path'), JSDOM = require('jsdom').JSDOM;
var html = fs.readFileSync(path.join(__dirname, '..', 'web', 'index.html'), 'utf8')
  .replace(/var SUPABASE_URL = '[^']*'/, "var SUPABASE_URL = ''").replace(/var SUPABASE_ANON_KEY = '[^']*'/, "var SUPABASE_ANON_KEY = ''")
  .replace(/var PUSH_FUNCTION_URL = '[^']*'/, "var PUSH_FUNCTION_URL = ''").replace(/var EMAIL_FUNCTION_URL = '[^']*'/, "var EMAIL_FUNCTION_URL = ''");
var pass = 0, fail = 0;
function ok(c, n){ if(c){ pass++; console.log('  ok   - '+n); } else { fail++; console.log('  FAIL - '+n); } }
function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
(async function(){
  var dom = new JSDOM(html, {url:'https://abcselaras.my.id/web/', runScripts:'dangerously', pretendToBeVisual:true});
  var w = dom.window; w.console.error = function(){}; w.scrollTo = function(){}; await sleep(400);
  var d = w.document;
  function app(){ return d.getElementById('app'); }
  w.saveDB = function(){ return Promise.resolve(); };
  w.DB.employees = [{id:'S1', empCode:'S1', name:'Sari Ayu', username:'sari', department:'Marketing', position:'Staff', properties:['Briggs Inn'], active:true}];

  console.log('\n[Ikon aplikasi baru]');
  var web = path.join(__dirname,'..','web');
  ['icon-192.png','icon-512.png','icon-512-maskable.png','apple-touch-icon.png','favicon-32.png'].forEach(function(f){ ok(fs.existsSync(path.join(web,f)), 'ada '+f); });
  ok(!!d.querySelector('link[rel="apple-touch-icon"][href^="apple-touch-icon.png"]'), 'iOS: apple-touch-icon memakai logo baru');
  var man = JSON.parse(fs.readFileSync(path.join(web,'manifest.json'),'utf8'));
  ok(man.icons.every(function(i){ return /\?v=3$/.test(i.src); }), 'manifest: ikon versi baru (cache dibuang)');
  ok(/#4E68FF/i.test(fs.readFileSync(path.join(__dirname,'..','mobile','android','app','src','main','res','drawable','ic_launcher_bg.xml'),'utf8')), 'Android: latar ikon launcher biru baru');

  console.log('\n[Foto profil Google]');
  ok(w.googlePhotoUrl('https://lh3.googleusercontent.com/a/abc=s96-c')==='https://lh3.googleusercontent.com/a/abc=s256-c', 'URL foto Google dipakai (resolusi 256)');
  ok(w.googlePhotoUrl('https://evil.example.com/x.png')==='' && w.googlePhotoUrl('javascript:alert(1)')==='', 'URL selain googleusercontent ditolak');
  var e = w.getEmployee('S1'); w.setGooglePhoto(e, 'https://lh3.googleusercontent.com/a/abc=s96-c');
  ok(/googleusercontent/.test(w.avatarInner(e)) && /no-referrer/.test(w.avatarInner(e)), 'tanpa foto profil: avatar memakai foto Google');
  e.photoKey = 'ph_1.jpg';
  ok(!/googleusercontent/.test(w.avatarInner(e)), 'foto profil sendiri tetap diutamakan');
  delete e.photoKey;

  console.log('\n[Layar memuat]');
  w.STATE.loaded = false; w.render();
  ok(!d.querySelector('.loading-dot') && /icon-192\.png/.test((app().querySelector('.loading-img')||{}).getAttribute('src')||''), 'titik diganti logo (bawaan)');
  w.STATE.loaded = true;
  w.DB.settings.loadingImage = {src:'data:image/png;base64,AAAA', mode:'full'};
  w.SESSION = {role:'hr', empId:null, hrAccountId:null}; w.STATE.view = 'settings'; w.render();
  ok(/Gambar Layar Memuat/.test(app().textContent) && !!d.querySelector('[data-action="save-loading-image"]'), 'HR: kartu ganti gambar layar memuat di Pengaturan');
  ok(/data:image\/png/.test(w.localStorage.getItem('abcsel_loading_img')||''), 'gambar disimpan di perangkat (tampil sebelum data termuat)');
  w.DB.settings = {}; w.STATE.loaded = false; w.render();
  var li = app().querySelector('.loading-img');
  ok(li && /^data:image\/png/.test(li.getAttribute('src')) && app().querySelector('.loading-screen.is-full'), 'saat buka berikutnya: gambar khusus + mode penuh layar');
  w.STATE.loaded = true; w.DB.settings = w.DB.settings||{}; w.DB.settings.loadingImage = {src:'data:image/png;base64,AAAA', mode:'logo'};
  w.render(); d.querySelector('[data-action="reset-loading-image"]').dispatchEvent(new w.MouseEvent('click',{bubbles:true})); await sleep(30);
  ok(!w.DB.settings.loadingImage && !w.localStorage.getItem('abcsel_loading_img'), 'bisa dikembalikan ke logo bawaan');

  console.log('\n[Banner: hanya di HP + aksi ketuk]');
  ok(/@media\(min-width:861px\)\{ \.banner-wrap\{display:none !important;\}/.test(html), 'web (desktop): banner disembunyikan');
  ok(/html\.native-app \.banner-wrap\{display:block !important;\}/.test(html), 'aplikasi (tablet sekalipun): banner tetap tampil');
  w.STATE.view = 'banners'; w.render();
  ok(!d.querySelector('[data-action="banner-preview-mode"]') && !d.getElementById('bn_file') && !!d.getElementById('bn_file_mob'), 'editor: pratinjau & gambar khusus aplikasi saja');
  var sel = d.getElementById('bn_tap');
  ok(sel && sel.options.length===3 && !!d.getElementById('bn_tap_view') && !!d.getElementById('bn_tap_url'), 'opsi saat diketuk: tidak ada / halaman aplikasi / link');
  sel.value = 'url'; sel.dispatchEvent(new w.Event('change',{bubbles:true}));
  ok(d.querySelector('.bn-tap-row[data-tap="url"]').style.display==='' && d.querySelector('.bn-tap-row[data-tap="view"]').style.display==='none', 'kolom link muncul saat pilih "Buka link"');
  d.getElementById('bn_title').value = 'Promo'; d.getElementById('bn_tap_url').value = 'bukan-link';
  var toasts = []; w.toast = function(m){ toasts.push(m); };
  d.querySelector('[data-action="save-banner"]').dispatchEvent(new w.MouseEvent('click',{bubbles:true})); await sleep(30);
  ok(/link yang valid/.test(toasts.join('|')) && !(w.DB.banners||[]).some(function(b){ return b.title==='Promo'; }), 'link tidak valid ditolak');
  d.getElementById('bn_tap_url').value = 'https://abchospitality.co.id/article/';
  d.querySelector('[data-action="save-banner"]').dispatchEvent(new w.MouseEvent('click',{bubbles:true})); await sleep(60);
  var bn = (w.DB.banners||[]).filter(function(b){ return b.title==='Promo'; })[0];
  ok(bn && bn.tapType==='url' && bn.tapUrl==='https://abchospitality.co.id/article/', 'banner tersimpan dengan aksi link');
  w.DB.banners = [{id:'B1', title:'Jadwal', active:true, color:'blue', tapType:'view', tapView:'my-schedule', tapCta:'Cek jadwal'}, {id:'B2', title:'Web', active:true, color:'blue', tapType:'url', tapUrl:'https://abchospitality.co.id/'}];
  w.SESSION = {role:'staff', empId:'S1'}; w.STATE.view = 'dashboard'; w.render();
  var s1 = d.querySelector('.banner-slide[data-id="B1"]');
  ok(!/INFO ABC SELARAS/i.test(d.querySelector('.banner-wrap').textContent), 'label "INFO ABC SELARAS" tidak tampil di banner');
  ok(s1 && s1.getAttribute('data-action')==='banner-tap' && /Cek jadwal/.test(s1.textContent), 'slide bisa diketuk + teks tombol tampil');
  s1.dispatchEvent(new w.MouseEvent('click',{bubbles:true})); await sleep(30);
  ok(w.STATE.view==='my-schedule', 'ketuk banner: membuka halaman Jadwal Saya');
  var opened = null; w.open = function(u){ opened = u; return {}; };
  w.STATE.view = 'dashboard'; w.render();
  d.querySelector('.banner-slide[data-id="B2"]').dispatchEvent(new w.MouseEvent('click',{bubbles:true})); await sleep(30);
  ok(opened==='https://abchospitality.co.id/', 'ketuk banner: membuka link');
  ok(w.bannerTapInfo({tapType:'url', tapUrl:'javascript:alert(1)'})===null, 'link berbahaya (javascript:) diabaikan');
  w.SESSION = {role:'hr', empId:null, hrAccountId:null};
  ok(w.bannerTargetView('leave-request')==='leave-approval', 'HR: tujuan disesuaikan ke halaman persetujuan');

  console.log('\nHASIL: '+pass+' lulus, '+fail+' gagal'); process.exit(fail ? 1 : 0);
})();

/* Tes: tombol Back (navBack/__abcBack), sidebar tanpa tombol X, foto grup. */
var fs=require('fs'),path=require('path'),JSDOM=require('jsdom').JSDOM;
var html=fs.readFileSync(path.join(__dirname,'..','web','index.html'),'utf8')
  .replace(/var SUPABASE_URL = '[^']*'/,"var SUPABASE_URL = ''").replace(/var SUPABASE_ANON_KEY = '[^']*'/,"var SUPABASE_ANON_KEY = ''").replace(/var PUSH_FUNCTION_URL = '[^']*'/,"var PUSH_FUNCTION_URL = ''");
var pass=0,fail=0; function ok(c,n){ if(c){pass++;console.log('  ok   - '+n);}else{fail++;console.log('  FAIL - '+n);} }
function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}
(async function(){
  var dom=new JSDOM(html,{url:'https://abc.test/',runScripts:'dangerously',pretendToBeVisual:true});
  var w=dom.window; w.console.error=function(){}; w.scrollTo=function(){}; w.innerWidth=390; await sleep(400);
  var d=w.document;
  function emp(id,name){ return {id:id,empCode:id,name:name,position:'Staff',department:'Marketing',properties:[],joinDate:'2025-01-01',baseSalary:1,active:true,username:id,password:'p'}; }
  w.DB.employees=[emp('A','Andi'),emp('B','Budi')];
  w.SESSION={role:'staff',empId:'A'}; w.STATE.view='dashboard'; w.render();
  console.log('\n[Tombol Back]');
  w.STATE.view='chat'; w.render(); w.STATE.chatWith='B'; w.render(); w.STATE.personId='B'; w.STATE.view='person'; w.render();
  ok(w.__abcBack()==='ok' && w.STATE.view==='chat' && w.STATE.chatWith==='B', 'profil -> Back -> kembali ke chat Budi');
  ok(w.__abcBack()==='ok' && w.STATE.view==='chat' && !w.STATE.chatWith, 'chat Budi -> Back -> daftar chat');
  ok(w.__abcBack()==='ok' && w.STATE.view==='dashboard', 'daftar chat -> Back -> dashboard');
  w.openModal('<div>x</div>'); ok(w.__abcBack()==='ok' && !d.getElementById('modalRoot').innerHTML, 'popup terbuka -> Back menutup popup dulu');
  w.STATE.sidebarOpen=true; w.render(); ok(w.__abcBack()==='ok' && !w.STATE.sidebarOpen, 'sidebar terbuka -> Back menutup sidebar');
  ok(w.__abcBack()==='no', 'di halaman awal -> "no" (APK diminimalkan, tidak ditutup)');
  ok(/moveTaskToBack/.test(fs.readFileSync(path.join(__dirname,'..','mobile','android','app','src','main','java','id','abchospitality','selaras','MainActivity.java'),'utf8')), 'APK: Back di halaman awal meminimalkan aplikasi');
  console.log('\n[Sidebar]');
  w.STATE.sidebarOpen=true; w.render();
  ok(!d.querySelector('.sidebar-close') && !!d.querySelector('.sidebar-backdrop'), 'tanpa tombol X, ada area gelap di luar sidebar');
  d.querySelector('.sidebar-backdrop').dispatchEvent(new w.MouseEvent('click',{bubbles:true})); await sleep(50);
  ok(!w.STATE.sidebarOpen, 'ketuk area luar menutup sidebar');
  w.STATE.sidebarOpen=true; w.render();
  function touch(type,x,y){ var ev=new w.Event(type,{bubbles:true}); ev.touches=[{clientX:x,clientY:y}]; ev.changedTouches=[{clientX:x,clientY:y}]; d.dispatchEvent(ev); }
  touch('touchstart',200,300); touch('touchend',80,305); await sleep(30);
  ok(!w.STATE.sidebarOpen, 'geser ke kiri menutup sidebar');
  touch('touchstart',8,300); touch('touchend',150,300); await sleep(30);
  ok(w.STATE.sidebarOpen, 'geser dari tepi kiri membuka sidebar');
  console.log('\n[Foto grup]');
  w.STATE.sidebarOpen=false; w.uploadAttachment=function(p,du){ return Promise.resolve({key:p,url:'https://x/'+p}); }; w.compressSquare=function(){ return Promise.resolve('data:image/jpeg;base64,AA'); };
  w.DB.chatGroups=[{id:'G1',name:'Tim',members:['A','B'],admins:['A'],createdBy:'A',createdAt:new Date().toISOString()}];
  w.chatReset(); w.STATE.view='chat'; w.STATE.chatWith='g:G1'; w.render();
  d.querySelector('.chat-head-main').dispatchEvent(new w.MouseEvent('click',{bubbles:true})); await sleep(50);
  ok(!!d.querySelector('[data-action="chat-group-photo"]'), 'admin: tombol Ganti/Tambah Foto Grup');
  await w.chatGroupSetPhoto(w.DB.chatGroups[0], new w.File(['x'],'g.jpg',{type:'image/jpeg'})); await sleep(60);
  ok(w.DB.chatGroups[0].photoUrl && /<img/.test(w.chatGroupAvatar(w.DB.chatGroups[0],40)), 'foto grup tersimpan & tampil sebagai avatar grup');
  console.log('\n'+pass+' ok, '+fail+' gagal'); process.exit(fail?1:0);
})();

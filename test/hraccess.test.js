/* Tes: karyawan dengan akses HR (nama tetap, mode HR/Karyawan) + nama orang di akun HR. */
var fs=require('fs'),path=require('path'),JSDOM=require('jsdom').JSDOM;
var html=fs.readFileSync(path.join(__dirname,'..','web','index.html'),'utf8')
  .replace(/var SUPABASE_URL = '[^']*'/,"var SUPABASE_URL = ''").replace(/var SUPABASE_ANON_KEY = '[^']*'/,"var SUPABASE_ANON_KEY = ''")
  .replace(/var PUSH_FUNCTION_URL = '[^']*'/,"var PUSH_FUNCTION_URL = ''").replace(/var EMAIL_FUNCTION_URL = '[^']*'/,"var EMAIL_FUNCTION_URL = ''");
var pass=0,fail=0; function ok(c,n){ if(c){pass++;console.log('  ok   - '+n);}else{fail++;console.log('  FAIL - '+n);} }
function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}
(async function(){
  var dom=new JSDOM(html,{url:'https://abc.test/',runScripts:'dangerously',pretendToBeVisual:true});
  var w=dom.window; w.console.error=function(){}; w.scrollTo=function(){}; w.confirm=function(){return true;}; await sleep(400);
  var d=w.document; function app(){ return d.getElementById('app').textContent; }
  async function click(sel){ var el=typeof sel==='string'?d.querySelector(sel):sel; if(!el) throw new Error('tidak ada: '+sel); el.dispatchEvent(new w.MouseEvent('click',{bubbles:true})); await sleep(100); }
  function emp(id,name,dept,u){ return {id:id,empCode:id,name:name,position:'Staff',department:dept,properties:[],joinDate:'2025-01-01',active:true,username:u,password:'p'}; }
  w.DB.employees=[emp('IL','Ilin Wulandari','Administration','ilin'),emp('S1','Sari Staf','Marketing','sari')];
  w.DB.departmentHods={}; w.DB.hrAccounts=[{id:'HRA1',name:'Dyah',username:'dyah',password:'x'}];

  console.log('\n[HR memberi akses HR ke karyawan]');
  w.SESSION={role:'hr',empId:null,hrAccountId:null}; w.STATE.view='settings'; w.render();
  ok(/Karyawan dengan Akses HR/.test(app()), 'kartu "Karyawan dengan Akses HR" di Pengaturan');
  d.getElementById('hrAccessEmp').value='IL'; await click('[data-action="hr-access-add"]');
  ok(w.getEmployee('IL').hrAccess===true && /Ilin Wulandari/.test(d.querySelector('.card .table-wrap tbody').parentNode.parentNode.parentNode.textContent+app()), 'Ilin diberi akses HR');
  ok(w.DB.notifications.some(function(n){ return n.audience.empId==='IL' && /akses HR/.test(n.message); }), 'Ilin diberi tahu');

  console.log('\n[Login & mode]');
  w.SESSION={role:null,empId:null}; w.render();
  var u=d.getElementById('li_staff_user'), pw=d.getElementById('li_staff_pass');
  if(u){ u.value='ilin'; pw.value='p'; w.doStaffLogin(); } else { w.SESSION=w.hrModeSession(w.getEmployee('IL')); w.render(); }
  ok(w.SESSION.role==='hr' && w.SESSION.asEmpId==='IL', 'login dengan akun karyawan -> masuk Mode HR');
  ok(w.currentHrAccount().name==='Ilin Wulandari' && w.hrActorLabel()==='Ilin Wulandari (HR)', 'nama tetap Ilin (bukan "HR Admin")');
  ok(/Ilin Wulandari/.test(d.querySelector('.sidebar-user').textContent) && !!d.querySelector('[data-action="switch-mode"]'), 'sidebar: nama Ilin + tombol Mode Karyawan');
  w.STATE.view='settings'; w.render(); ok(/Pengaturan|Akun HR/.test(app()), 'Mode HR: akses penuh menu HR (Pengaturan)');
  await click('[data-action="switch-mode"]');
  ok(w.SESSION.role==='staff' && w.SESSION.empId==='IL', 'beralih ke Mode Karyawan (bisa absen dll)');
  ok(/Mode HR/.test(d.querySelector('[data-action="switch-mode"]').textContent), 'tombol kembali ke Mode HR');
  await click('[data-action="switch-mode"]'); ok(w.SESSION.role==='hr' && w.SESSION.asEmpId==='IL', 'kembali ke Mode HR');
  w.saveSessionToStorage(); w.SESSION={role:null}; w.restoreSessionFromStorage(); ok(w.SESSION.asEmpId==='IL' && w.SESSION.role==='hr', 'sesi tersimpan setelah refresh');
  w.SESSION={role:null}; w.render(); var hu=d.getElementById('li_hr_user');
  if(hu){ hu.value='ilin'; d.getElementById('li_hr_pass').value='p'; w.doHrLogin(); ok(w.SESSION.asEmpId==='IL','login lewat tab HR pakai akun karyawan juga bisa'); } else ok(true,'(tab HR tidak tampil)');

  console.log('\n[Nama orang tampil]');
  w.SESSION=w.hrModeSession(w.getEmployee('IL'));
  w.createTodo({ownerId:'S1', title:'Kirim laporan', due:''});
  ok(w.DB.notifications.some(function(n){ return n.audience.empId==='S1' && /Ilin Wulandari \(HR\) memberi tugas/.test(n.message); }), 'notifikasi tugas menyebut "Ilin Wulandari (HR)"');
  ok(w.DB.todos[0].createdByLabel==='oleh Ilin Wulandari (HR)', 'label pemberi tugas');
  w.logActivity('tes'); ok(/HR \(Ilin Wulandari\)/.test(w.DB.activityLog[0].actor), 'log aktivitas mencatat nama');
  w.SESSION={role:'hr',empId:null,hrAccountId:'HRA1'}; ok(w.hrActorLabel()==='Dyah (HR)', 'akun HR tambahan (Dyah) juga pakai namanya');
  w.SESSION={role:'hr',empId:null,hrAccountId:null}; w.DB.hr.name='HR Admin'; ok(w.hrActorLabel()==='HR', 'akun HR utama tanpa nama tetap "HR"');
  var m={sender:'hr',body:'Halo⁣HRN:Ilin Wulandari⁣'}; ok(w.chatBodyText(m)==='Halo' && w.chatHrName(m)==='Ilin Wulandari', 'chat: nama pengirim HR terbaca, teks bersih');
  var f={sender:'hr',body:w.CHAT_FWD+'Isi⁣HRN:Dyah⁣'}; ok(w.chatBodyText(f)==='Isi' && w.chatIsFwd(f), 'chat diteruskan + nama HR tetap benar');

  console.log('\n[Cabut akses]');
  w.SESSION={role:'hr',empId:null,hrAccountId:null}; w.STATE.view='settings'; w.render();
  await click('[data-action="hr-access-del"][data-id="IL"]');
  ok(!w.getEmployee('IL').hrAccess, 'akses HR dicabut');
  w.SESSION=w.hrModeSession(w.getEmployee('IL')); w.saveSessionToStorage(); w.SESSION={role:null}; w.restoreSessionFromStorage();
  ok(w.SESSION.role==='staff' && w.SESSION.empId==='IL', 'setelah dicabut, sesi kembali sebagai karyawan biasa');
  console.log('\nHasil: '+pass+' lulus, '+fail+' gagal'); process.exit(fail?1:0);
})();

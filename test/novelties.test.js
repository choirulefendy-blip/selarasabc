/* Tes: pencarian karyawan (HR), pengingat tenggat Board, halaman Syarat & Privasi di login. */
var fs=require('fs'),path=require('path'),JSDOM=require('jsdom').JSDOM;
var html=fs.readFileSync(path.join(__dirname,'..','web','index.html'),'utf8')
  .replace(/var SUPABASE_URL = '[^']*'/,"var SUPABASE_URL = ''").replace(/var SUPABASE_ANON_KEY = '[^']*'/,"var SUPABASE_ANON_KEY = ''").replace(/var PUSH_FUNCTION_URL = '[^']*'/,"var PUSH_FUNCTION_URL = ''");
var pass=0,fail=0; function ok(c,n){ if(c){pass++;console.log('  ok   - '+n);}else{fail++;console.log('  FAIL - '+n);} }
function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}
(async function(){
  var dom=new JSDOM(html,{url:'https://abcselaras.my.id/web/',runScripts:'dangerously',pretendToBeVisual:true});
  var w=dom.window; w.console.error=function(){}; w.scrollTo=function(){}; await sleep(400);
  var d=w.document;
  function click(sel){ var el=d.querySelector(sel); if(!el) throw new Error('tidak ada: '+sel); el.dispatchEvent(new w.MouseEvent('click',{bubbles:true})); }
  w.DB.employees=[
    {id:'E1',name:'Sari Ayu',username:'sari',department:'Marketing',position:'Content Creator',empCode:'ABC-24-0301-014',active:true,properties:['Briggs Inn']},
    {id:'E2',name:'Budi Santoso',username:'budi',department:'Front Office',position:'Receptionist',empCode:'ABC-22-0101-001',active:true,properties:['Padi Heritage Resort']}
  ];

  console.log('\n[Syarat & Ketentuan / Kebijakan Privasi]');
  w.SESSION={}; w.STATE.legalPage=null; w.render();
  ok(/Syarat\s*&amp;\s*Ketentuan|Syarat & Ketentuan/.test(d.getElementById('app').innerHTML) && /Kebijakan Privasi/.test(d.getElementById('app').innerHTML), 'halaman login menampilkan tautan Syarat & Ketentuan dan Kebijakan Privasi');
  click('[data-action="legal-open"][data-page="privacy"]'); await sleep(30);
  ok(/Kebijakan Privasi/.test(d.getElementById('app').textContent) && /Terakhir diperbarui/.test(d.getElementById('app').textContent), 'tautan Kebijakan Privasi membuka halamannya');
  click('[data-action="legal-open"][data-page="terms"]'); await sleep(30);
  ok(/Akun/.test(d.getElementById('app').textContent) && /Absensi/.test(d.getElementById('app').textContent), 'tautan Syarat & Ketentuan membuka halamannya');
  click('[data-action="legal-back"]'); await sleep(30);
  ok(!!d.querySelector('.login-wrap') && !w.STATE.legalPage, 'tombol Kembali kembali ke halaman login');

  console.log('\n[Pencarian karyawan (HR)]');
  w.SESSION={role:'hr'}; w.STATE.view='employees'; w.STATE.employeeQuery=''; w.render(); await sleep(20);
  ok(!!d.getElementById('employeeSearch'), 'kolom cari karyawan tampil di akun HR');
  w.STATE.employeeQuery='receptionist'; w.render(); await sleep(20);
  var rows=d.querySelectorAll('#app tbody tr').length;
  ok(/Budi Santoso/.test(d.getElementById('app').textContent) && !/Sari Ayu/.test(d.getElementById('app').textContent), 'cari "receptionist" hanya menampilkan karyawan yang cocok');
  w.STATE.employeeQuery='ABC-24-0301'; w.render(); await sleep(20);
  ok(/Sari Ayu/.test(d.getElementById('app').textContent) && !/Budi Santoso/.test(d.getElementById('app').textContent), 'cari berdasarkan kode karyawan');
  w.STATE.employeeQuery=''; w.render(); await sleep(20);

  console.log('\n[Pengingat tenggat Board]');
  var t1=w.todoRemindAt({due:'2026-11-12', remind:'h1'}), t0=w.todoRemindAt({due:'2026-11-12', remind:'h0'}), tn=w.todoRemindAt({due:'2026-11-12', remind:''});
  ok(t1 && t1.getFullYear()===2026 && t1.getMonth()===10 && t1.getDate()===11 && t1.getHours()===8, 'H-1 jatuh pada 11 Nov pukul 08.00');
  ok(t0 && t0.getDate()===12 && t0.getHours()===8, 'hari H jatuh pada 12 Nov pukul 08.00');
  ok(tn===null, 'tanpa pilihan pengingat tidak ada jadwal');
  w.SESSION={role:'staff',empId:'E1'}; w.STATE.loaded=true;
  w.DB.todos=[{id:'TDX',ownerId:'E1',title:'Kirim laporan kampanye',status:'todo',due:'2020-01-05',remind:'h0',createdById:'E1',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}];
  w.todoReminderSync();
  var notif=(w.DB.notifications||[]).filter(function(n){ return n.message.indexOf('Kirim laporan kampanye')!==-1; });
  ok(notif.length===1 && notif[0].audience.empId==='E1', 'pengingat tenggat terkirim ke pemilik tugas saat waktunya tiba');
  w.todoReminderSync();
  ok((w.DB.notifications||[]).filter(function(n){ return n.message.indexOf('Kirim laporan kampanye')!==-1; }).length===1, 'pengingat yang sama tidak dikirim dua kali');

  console.log('\nHASIL: '+pass+' lulus, '+fail+' gagal');
  process.exit(fail?1:0);
})().catch(function(e){ console.error(e); process.exit(1); });

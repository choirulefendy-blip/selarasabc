/* Tes: SOP departemen (HOD menambah & memperbarui, versi, notifikasi staf, status baca, pantauan HR). */
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
  async function click(sel){ var el=typeof sel==='string'?d.querySelector(sel):sel; if(!el) throw new Error('tidak ada: '+sel); el.dispatchEvent(new w.MouseEvent('click',{bubbles:true})); await sleep(150); }
  function emp(id,name,dept){ return {id:id,empCode:id,name:name,position:'Staff',department:dept,properties:[],joinDate:'2025-01-01',active:true,username:id,password:'p'}; }
  w.DB.employees=[emp('H1','Rina HOD FO','Front Office'),emp('F1','Fani FO','Front Office'),emp('F2','Feri FO','Front Office'),emp('K1','Koki','Kitchen')];
  w.DB.departmentHods={'Front Office':['H1']}; w.DB.sops=[]; w.DB.notifications=[];
  function as(role,id){ w.SESSION= role==='hr'?{role:'hr',empId:null,hrAccountId:null}:{role:role,empId:id}; w.STATE.view='sop'; w.render(); }

  console.log('\n[HOD menambah SOP departemen]');
  as('hod','H1');
  ok(!!d.getElementById('sop_title') && !d.getElementById('pkgFile'), 'HOD punya form tambah SOP (tanpa impor paket)');
  var opts=Array.prototype.map.call(d.querySelectorAll('#sop_dept option'),function(o){ return o.value; });
  ok(opts.join()==='Front Office', 'HOD hanya bisa memilih departemennya');
  d.getElementById('sop_title').value='SOP Check-in Tamu'; d.getElementById('sop_desc').value='1. Sapa tamu\n2. Cek reservasi'; d.getElementById('sop_code').value='PHM-FO-SOP-001';
  await click('[data-action="sop-add"]'); await sleep(150);
  var s=w.DB.sops[0];
  ok(s && s.dept==='Front Office' && s.version==='1.0' && s.history.length===1 && s.code==='PHM-FO-SOP-001', 'SOP tersimpan: dept Front Office, v1.0, kode');
  ok(w.DB.notifications.some(function(n){ return n.audience.empId==='F1' && /SOP baru/.test(n.message); }) && !w.DB.notifications.some(function(n){ return n.audience.empId==='K1'; }), 'staf FO dapat notifikasi, Kitchen tidak');
  ok(w.DB.notifications.some(function(n){ return n.audience.type==='hr' && /oleh HOD/.test(n.message); }), 'HR diberi tahu');

  console.log('\n[Staf melihat & membaca]');
  as('staff','F1');
  ok(/SOP Check-in Tamu/.test(app()) && /Baru/.test(app()) && !d.querySelector('[data-action="sop-edit"]'), 'staf FO melihat SOP bertanda Baru (tanpa tombol ubah)');
  await click('[data-action="sop-read"]');
  ok(w.sopIsRead(s,'F1') && !/Belum dibaca/.test(app()), 'staf menandai sudah dibaca');
  as('staff','K1'); ok(!/SOP Check-in Tamu/.test(app()), 'staf Kitchen tidak melihat SOP FO');

  console.log('\n[HOD memperbarui -> versi baru]');
  as('hod','H1');
  ok(/Dibaca 1\/2/.test(app()), 'HOD melihat status baca 1/2');
  await click('[data-action="sop-edit"]');
  ok(d.getElementById('sope_ver').value==='1.1', 'versi baru otomatis 1.1');
  d.getElementById('sope_desc').value='1. Sapa tamu\n2. Cek reservasi\n3. Verifikasi deposit'; d.getElementById('sope_note').value='Tambah verifikasi deposit';
  w.DB.notifications=[];
  await click('[data-action="sop-save"]'); await sleep(150);
  ok(s.version==='1.1' && s.history.length===2 && s.history[1].note==='Tambah verifikasi deposit', 'versi 1.1 + riwayat + catatan perubahan');
  ok(w.DB.notifications.some(function(n){ return n.audience.empId==='F1' && /diperbarui \(v1.1\)/.test(n.message) && /verifikasi deposit/.test(n.message); }), 'staf dapat notifikasi pembaruan');
  as('staff','F1');
  ok(!w.sopIsRead(s,'F1') && /Diperbarui/.test(app()) && /Riwayat versi \(2\)/.test(app()), 'staf: harus baca ulang (Diperbarui) + riwayat versi');
  await click('[data-action="sop-open"]'.replace('sop-open','sop-read'));

  console.log('\n[HR memantau]');
  as('hr');
  ok(/Pantauan SOP per Departemen/.test(app()) && /Front Office/.test(d.querySelector('details.card').textContent), 'HR: tabel pantauan per departemen');
  await click('[data-action="sop-reads"]');
  ok(/1 dari 2 staf/.test(d.getElementById('modalRoot').textContent) && /Belum/.test(d.getElementById('modalRoot').textContent), 'HR melihat siapa yang belum membaca');
  w.DB.notifications=[]; await click('[data-action="sop-remind"]');
  ok(w.DB.notifications.length===1 && w.DB.notifications[0].audience.empId==='F2', 'tombol Ingatkan hanya ke yang belum membaca');
  d.getElementById('sopDeptSel').value='Kitchen'; d.getElementById('sopDeptSel').dispatchEvent(new w.Event('change',{bubbles:true})); await sleep(80);
  ok(!/SOP Check-in Tamu/.test(d.querySelector('.content') ? d.querySelector('.content').textContent : app()) || !d.querySelector('.sop-item'), 'filter departemen HR');

  console.log('\n[Hak akses]');
  w.DB.departmentHods['Kitchen']=['K1']; as('hod','K1');
  ok(!d.querySelector('[data-action="sop-edit"]'), 'HOD departemen lain tidak bisa mengubah SOP FO');
  w.mergeLiveData({sopReads:(function(){ var o={}; o[s.id]={F2:'1.1'}; return o; })()});
  ok(w.sopIsRead(s,'F2') && w.sopIsRead(s,'F1'), 'status baca dari perangkat lain tergabung tanpa menimpa');
  console.log('\nHasil: '+pass+' lulus, '+fail+' gagal'); process.exit(fail?1:0);
})();

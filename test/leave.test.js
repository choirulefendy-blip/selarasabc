/* Tes: jatah cuti 12 hari/periode Juni–Mei, alpha vs cuti, hapus pengumuman, No. BPJS. */
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
  function emp(id,name){ return {id:id,empCode:id,name:name,position:'Staff',department:'Marketing',properties:[],joinDate:'2025-01-01',active:true,username:id,password:'p',baseSalary:1}; }
  w.DB.employees=[emp('S1','Sari'),emp('S2','Sigit')]; w.DB.departmentHods={}; w.DB.leaveRequests=[];

  console.log('\n[Periode & jatah]');
  var p=w.leavePeriodOf('2026-11-03'); ok(p.start==='2026-06-01' && p.end==='2027-05-31', 'periode Juni 2026 – Mei 2027');
  var p2=w.leavePeriodOf('2026-05-20'); ok(p2.start==='2025-06-01' && p2.end==='2026-05-31', 'Mei masih periode sebelumnya');
  w.DB.leaveRequests=[{id:'A',empId:'S1',type:'Cuti Tahunan',startDate:'2026-07-01',endDate:'2026-07-03',status:'approved'},
    {id:'B',empId:'S1',type:'Cuti Tahunan',startDate:'2026-05-25',endDate:'2026-05-29',status:'approved'},
    {id:'C',empId:'S1',type:'Sakit',startDate:'2026-08-01',endDate:'2026-08-02',status:'approved'},
    {id:'D',empId:'S1',type:'Cuti Tahunan',startDate:'2026-12-01',endDate:'2026-12-02',status:'pending_hr'}];
  var b=w.leaveBalance('S1','2026-11-03');
  ok(b.quota===12 && b.used===3 && b.pending===2 && b.left===9, 'terpakai 3 (cuti periode lalu hangus, sakit tidak memotong), diajukan 2, sisa 9');
  w.getEmployee('S2').contractUntil='2026-05-31'; ok(w.leaveBalance('S2','2026-11-03').quota===0, 'kontrak tidak diperpanjang: tidak dapat jatah periode baru');
  w.getEmployee('S2').contractUntil=''; w.getEmployee('S2').leaveQuota=14; ok(w.leaveBalance('S2','2026-11-03').quota===14, 'jatah khusus per karyawan');

  console.log('\n[Halaman cuti]');
  w.SESSION={role:'staff',empId:'S1'}; w.STATE.view='leave-request'; w.render();
  ok(/Sisa Cuti Tahunan/.test(app()) && /hangus/.test(app()), 'kartu Sisa Cuti Tahunan + tanggal hangus');
  d.getElementById('lr_start').value=w.todayISO(); var e=new Date(); e.setDate(e.getDate()+12); d.getElementById('lr_end').value=e.toISOString().slice(0,10);
  var lt=d.getElementById('lr_type'); if(lt) lt.value='Cuti Tahunan';
  var n0=w.DB.leaveRequests.length; await click('[data-action="submit-leave-request"]');
  ok(w.DB.leaveRequests.length===n0, 'pengajuan melebihi sisa cuti ditolak');

  console.log('\n[Alpha]');
  var ym=w.todayParts().ym; var past=1;
  w.DB.schedules[ym]=w.DB.schedules[ym]||{}; w.DB.schedules[ym].S2={1:{type:'kerja',start:'08:00',end:'16:00'},2:{type:'libur'},3:{type:'libur',cuti:true},4:{type:'libur',leave:'sakit'}};
  w.DB.leaveRequests.push({id:'E',empId:'S2',type:'Izin',startDate:ym+'-01',endDate:ym+'-01',status:'approved'});
  var st=[1,2,3,4].map(function(dd){ return w.getMatchDay('S2',ym,dd).status; });
  ok(st.join()==='izin,libur,cuti,sakit', 'jadwal kerja tertimpa tapi izin disetujui -> Izin (bukan Alpha); libur/cuti/sakit bukan Alpha');
  w.applyWeeklyPatternToMonth(w.DB, ym, 'S2', w.defaultWeekPattern());
  ok(w.DB.schedules[ym].S2[3].cuti && w.DB.schedules[ym].S2[4].leave==='sakit', 'pola mingguan tidak menimpa cuti/sakit');

  console.log('\n[Pengumuman & BPJS]');
  w.DB.announcements=[{id:'AN1',title:'Rapat',message:'x',recipients:['all'],createdAt:new Date().toISOString()}];
  w.SESSION={role:'hr',empId:null,hrAccountId:null}; w.STATE.view='announcements'; w.render();
  await click('[data-action="delete-announcement"][data-id="AN1"]');
  ok(w.DB.announcements[0].deleted, 'HR menghapus pengumuman');
  w.SESSION={role:'staff',empId:'S1'}; w.render(); ok(!/Rapat/.test(app()), 'pengumuman terhapus hilang dari staf');
  w.SESSION={role:'hr',empId:null,hrAccountId:null}; w.STATE.view='employees'; w.render();
  w.openModal(w.employeeModalHtml ? w.employeeModalHtml(w.getEmployee('S1')) : '');
  var tk=d.getElementById('f_bpjsTkNo'), ks=d.getElementById('f_bpjsKesNo');
  if(!tk){ var eb=d.querySelector('[data-action="edit-employee"][data-id="S1"]'); if(eb){ await click(eb); tk=d.getElementById('f_bpjsTkNo'); ks=d.getElementById('f_bpjsKesNo'); } }
  ok(!!tk && !!ks, 'form karyawan: kolom No. BPJS Ketenagakerjaan & Kesehatan');
  if(tk){ tk.value='12345678901'; ks.value='0001234567890'; await click('[data-action="save-employee"]'); ok(w.getEmployee('S1').bpjsTkNo==='12345678901' && w.getEmployee('S1').bpjsKesNo==='0001234567890', 'nomor BPJS tersimpan'); }
  console.log('\nHasil: '+pass+' lulus, '+fail+' gagal'); process.exit(fail?1:0);
})();

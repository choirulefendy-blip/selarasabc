/* Tes Rekap Kerja: tab di Selaras Board + integrasi Absen Pulang. */
var fs = require('fs'), path = require('path');
var JSDOM = require('jsdom').JSDOM, XLSX = require('xlsx');
var html = fs.readFileSync(path.join(__dirname, '..', 'web', 'index.html'), 'utf8')
  .replace(/var SUPABASE_URL = '[^']*'/, "var SUPABASE_URL = ''").replace(/var SUPABASE_ANON_KEY = '[^']*'/, "var SUPABASE_ANON_KEY = ''")
  .replace(/var PUSH_FUNCTION_URL = '[^']*'/, "var PUSH_FUNCTION_URL = ''").replace(/var EMAIL_FUNCTION_URL = '[^']*'/, "var EMAIL_FUNCTION_URL = ''");
var pass = 0, fail = 0;
function ok(c, n){ if(c){ pass++; console.log('  ok   - '+n); } else { fail++; console.log('  FAIL - '+n); } }
function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
(async function(){
  var dom = new JSDOM(html, {url:'https://abc.test/', runScripts:'dangerously', pretendToBeVisual:true});
  var w = dom.window; w.console.error = function(){}; w.scrollTo = function(){}; await sleep(400);
  var d = w.document, saved = null; w.XLSX = {utils:{book_new:function(){ return {sheets:[]}; }, aoa_to_sheet:function(r){ return {rows:r}; }, book_append_sheet:function(wb,ws,n){ wb.sheets.push({name:n, rows:ws.rows}); }}, writeFile:function(wb,f){ saved = {wb:wb,file:f}; }};
  function emp(id, name, dept){ return {id:id,empCode:id,name:name,position:'Staff',department:dept,properties:[],joinDate:'2025-01-01',dateOfBirth:'1995-01-01',gender:'Laki-laki',baseSalary:1,mealAllowance:0,transportAllowance:0,address:'',phone:'',email:'',username:id,password:'p',active:true}; }
  w.DB.employees = [emp('H1','Hana HOD','Marketing'), emp('S1','Sari Staf','Marketing'), emp('K1','Kiki Kitchen','Kitchen')];
  w.DB.departmentHods = {Marketing:['H1']};
  var today = w.todayISO(), ym = today.slice(0,7);
  function as(role, id, view){ w.SESSION = role==='hr' ? {role:'hr',empId:null,hrAccountId:null} : {role:role,empId:id}; w.STATE.view=view||'todo'; w.STATE.boardTab='rekap'; w.STATE.boardMonth=null; w.STATE.rekapEmp=''; w.render(); }
  async function click(sel){ var el = typeof sel==='string' ? d.querySelector(sel) : sel; if(!el) throw new Error('tidak ada: '+sel); el.dispatchEvent(new w.MouseEvent('click',{bubbles:true})); await sleep(80); }
  function setv(id, v){ d.getElementById(id).value = v; }
  function app(){ return d.getElementById('app').textContent; }

  console.log('\n[Tab Rekap Kerja]');
  ['staff:S1','staff:K1','hod:H1','hr:'].forEach(function(x){ var p = x.split(':'); as(p[0], p[1]);
    ok(!!d.querySelector('[data-action="board-tab"][data-tab="rekap"]') && /tuntas bulan ini/.test(app()), 'akun '+p[0]+(p[1]?' ('+p[1]+')':'')+': tab Rekap Kerja tersedia'); });
  as('staff','S1');
  setv('rk_title','Desain announcement'); setv('rk_prio','tinggi'); setv('rk_status','done'); setv('rk_note','sudah dikirim');
  await click('[data-action="rekap-add"]');
  setv('rk_title','Edit video reels'); setv('rk_status','doing'); await click('[data-action="rekap-add"]');
  var mine = w.todosOf('S1');
  ok(mine.length===2 && mine[1].rekap===true && mine[1].due===today && mine[1].priority==='tinggi' && mine[1].status==='done', 'pekerjaan tercatat (tanggal, prioritas, status)');
  ok(/Desain announcement/.test(app()) && /Selesai/.test(app()) && /On Progress/.test(app()) && /Minggu \d/.test(app()), 'daftar dikelompokkan per tanggal + minggu');
  ok(/tuntas bulan ini/.test(app()) && d.querySelector(".rk-pct").textContent==="50%", "ringkasan 50% selesai");
  w.STATE.boardTab='board'; w.render();
  ok(!d.querySelector('.bd-col[data-col="done"] .bd-card'), 'rekap yang sudah selesai tidak memenuhi kolom Finish Board');
  ok(d.querySelectorAll('.bd-col[data-col="doing"] .bd-card').length===1, 'rekap On Progress muncul di Board');
  w.STATE.boardTab='rekap'; w.render();
  await click('[data-action="rekap-dl"]');
  var det = saved.wb.sheets[1].rows;
  ok(saved.wb.sheets[0].name==='Ringkasan' && JSON.stringify(det[0])===JSON.stringify(['Tanggal','Minggu','Uraian Pekerjaan','PIC','Tim','Prioritas','Status','Keterangan']) && det.length===3, 'unduh Excel: sheet Ringkasan + Detail Pekerjaan format Rekap Kerja');
  ok(det.some(function(r){ return r[2]==='Desain announcement' && r[3]==='Sari Staf' && r[5]==='Tinggi' && r[6]==='Selesai' && r[7]==='sudah dikirim'; }), 'baris unduhan lengkap (PIC, prioritas, status, keterangan)');
  w.XLSX = XLSX; var rt = w.parseBoardWorkbook(XLSX.utils.book_new()); 
  var wbx = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wbx, XLSX.utils.aoa_to_sheet(det), 'Detail Pekerjaan');
  var back = w.parseBoardWorkbook(wbx); ok(back.rows && back.rows.length===2 && back.rows[0].owner==='Sari Staf', 'file unduhan bisa diimpor kembali');
  w.XLSX = {utils:{}, writeFile:function(){}};
  await click(d.querySelector('[data-action="rekap-del"]')); ok(w.todosOf('S1').length===1, 'hapus pekerjaan');
  as('hod','H1'); var sel = d.getElementById('rekapEmp'); ok(!!sel, 'HOD: pilihan melihat rekap anggota tim');
  sel.value = 'S1'; sel.dispatchEvent(new w.Event('change',{bubbles:true})); await sleep(50);
  ok(/Edit video reels|Desain announcement/.test(app()) && !d.getElementById('rk_title'), 'HOD melihat rekap Sari (hanya baca, tanpa form)');

  console.log('\n[Tampilan tabel, edit & Status per PIC]');
  ok(!!d.querySelector('.rk-table') && !!d.querySelector('.rk-sum .rk-bar') && !!d.querySelector('.rk-pic .rk-donut'), 'ringkasan + bar status + donut per PIC + tabel');
  var eb = d.querySelector('[data-action="rekap-edit"]'); ok(!!eb, 'HOD bisa edit rekap anggota tim');
  await click(eb); ok(!!d.getElementById('rke_title'), 'modal edit terbuka');
  setv('rke_title','Edit video reels final'); setv('rke_status','batal'); setv('rke_prio','rendah');
  await click('[data-action="rekap-save"]');
  var ed = w.todosOf('S1')[0]; ok(ed.title==='Edit video reels final' && ed.status==='batal' && ed.priority==='rendah', 'perubahan tersimpan (judul, status Batal, prioritas)');
  ok(/Batal/.test(app()) && /Edit video reels final/.test(app()), 'tabel menampilkan hasil edit');
  sel = d.getElementById('rekapEmp'); sel.value='__all'; sel.dispatchEvent(new w.Event('change',{bubbles:true})); await sleep(50);
  ok(/Semua tim/.test(app()) && /Edit video reels final/.test(app()), 'HOD: pilihan Semua tim');
  as('staff','S2'); ok(!d.getElementById('rekapEmp') && !d.querySelector('[data-action="rekap-edit"]'), 'staf lain tidak bisa melihat/mengedit rekap orang lain');
  as('hod','H1');

  console.log('\n[Absen Pulang + Rekap Kerja]');
  w.parseRekapLines && ok(true,'parser tersedia');
  var pl = w.parseRekapLines('Desain A\n- Update DM | Rendah\n2. Edit video | Tinggi | On Progress | revisi besok\n\n');
  ok(pl.length===3 && pl[0].status==='done' && pl[0].priority==='normal' && pl[1].title==='Update DM' && pl[1].priority==='rendah' && pl[2].status==='doing' && pl[2].note==='revisi besok', 'parser baris rekap (bullet, nomor, format opsional)');
  async function checkout(empId, text){
    as('staff', empId, 'checkin'); w.CHECKIN_DRAFT.photoDataUrl='data:image/jpeg;base64,AAAA'; w.CHECKIN_DRAFT.location={lat:-7.9,lng:112.5,accuracy:10}; w.CHECKIN_DRAFT.condition='sehat'; w.render(); await sleep(60);
    if(text!==undefined){ var lines = w.parseRekapLines(text);
      lines.forEach(function(L, i){ if(i>0) d.querySelector('[data-action="ckrk-add-row"]').click();
        var rows = d.querySelectorAll('#ckrkRows .ckrk-row'), r = rows[rows.length-1];
        r.querySelector('[data-f="title"]').value = L.title; r.querySelector('[data-f="priority"]').value = L.priority; r.querySelector('[data-f="status"]').value = L.status; r.querySelector('[data-f="note"]').value = L.note;
        r.querySelector('[data-f="title"]').dispatchEvent(new w.Event('input',{bubbles:true})); }); }
    await click('[data-action="submit-checkin"][data-type="out"]'); await sleep(250);
  }
  async function checkin(empId){
    as('staff', empId, 'checkin'); w.CHECKIN_DRAFT.photoDataUrl='data:image/jpeg;base64,AAAA'; w.CHECKIN_DRAFT.location={lat:-7.9,lng:112.5,accuracy:10}; w.CHECKIN_DRAFT.condition='sehat'; w.render(); await sleep(60);
    await click('[data-action="submit-checkin"][data-type="in"]'); await sleep(250);
  }
  await checkin('K1'); await checkin('S1');
  as('staff','K1','checkin'); w.CHECKIN_DRAFT.photoDataUrl='data:image/jpeg;base64,AAAA'; w.render();
  ok(!!d.getElementById('ckrkRows') && !!d.querySelector('#ckrkRows [data-f="status"]') && /Catat Pekerjaan Hari Ini/.test(app()) && !d.getElementById('checkinWorkNote'), 'halaman Absen Pulang menampilkan kolom Rekap Kerja (wajib)');
  await checkout('K1', '');
  var r0 = (w.DB.attendance[ym]||{})['K1'];
  ok(!r0 || !r0[parseInt(today.slice(8),10)] || !r0[parseInt(today.slice(8),10)].checkOut, 'absen pulang ditolak jika rekap kosong');
  await checkout('K1', 'Siapkan bahan\nCek stok gudang | Rendah');
  var rec = w.DB.attendance[ym]['K1'][parseInt(today.slice(8),10)];
  ok(rec && rec.checkOut && rec.rekapCount===2 && /Rekap Kerja \(2\)/.test(rec.checkOutNote), 'absen pulang berhasil + jumlah rekap tersimpan');
  var kk = w.todosOf('K1');
  ok(kk.length===2 && kk.every(function(t){ return t.rekap && t.due===today && t.source==='absen-pulang'; }), 'rekap dari Absen Pulang masuk ke Rekap Kerja');
  as('staff','K1'); ok(/Siapkan bahan/.test(app()) && /Cek stok gudang/.test(app()), 'terlihat di tab Rekap Kerja');
  /* yang sudah menulis rekap lewat tab boleh absen pulang tanpa menulis ulang */
  as('staff','S1'); setv('rk_title','Kerjaan hari ini'); await click('[data-action="rekap-add"]');
  await checkout('S1', '');
  var rs = (w.DB.attendance[ym]||{})['S1']; ok(rs && rs[parseInt(today.slice(8),10)] && rs[parseInt(today.slice(8),10)].checkOut, 'rekap yang sudah ditulis di tab dihitung, absen pulang lolos');

  console.log('\n'+pass+' ok, '+fail+' gagal'); process.exit(fail?1:0);
})();

/* Tes impor format "Rekap Kerja" (multi-sheet, PIC, Batal, duplikat dalam satu file). */
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
  var d = w.document; w.XLSX = XLSX;
  function emp(id, name, dept, code){ return {id:id,empCode:code||id,name:name,position:'Staff',department:dept,properties:[],joinDate:'2025-01-01',dateOfBirth:'1995-01-01',gender:'Laki-laki',baseSalary:1,mealAllowance:0,transportAllowance:0,address:'',phone:'',email:'',username:id,password:'p',active:true}; }
  w.DB.employees = [emp('E1','MOCH CHOIRUL EFENDI','Marketing'), emp('E2','AFRIZAL TEGAR SAPUTRA (SUEB)','Marketing'), emp('E3','SELLY TRI','Sales')];
  w.SESSION = {role:'hr',empId:null,hrAccountId:null}; w.STATE.view='todo'; w.STATE.boardTab='board'; w.render();
  async function click(sel){ var el = typeof sel==='string' ? d.querySelector(sel) : sel; if(!el) throw new Error('tidak ada: '+sel); el.dispatchEvent(new w.MouseEvent('click',{bubbles:true})); await sleep(80); }

  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['REKAP PEKERJAAN','Oktober 2026'],['Total pekerjaan','5']]), 'Ringkasan');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Tanggal','Minggu','Uraian Pekerjaan','PIC','Tim','Prioritas','Status','Keterangan'],
    ['2026-10-01','Minggu 1','Desain Announcement','Fendys','Marcomm','Sedang','Selesai',''],
    ['2026-10-01','Minggu 1','Update DM','Sueb','Marcomm','Rendah','Selesai',''],
    ['2026-10-01','Minggu 1','Update DM','Sueb','Marcomm','Rendah','Selesai',''],
    ['2026-10-03','Minggu 1','Food testing wedding','Selly','Sales','Tinggi','Selesai','Klien puas'],
    ['2026-10-04','Minggu 1','Dibatalkan','Selly','Sales','Sedang','Batal','']]), 'Detail Pekerjaan');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Minggu','Tim','Action Item / Program','PIC','Prioritas','Status','Catatan'],
    ['Minggu 1','Marcomm','Announcement Kaly','Fendys','Tinggi','On Progress','Catatan A'],
    ['Minggu 1','Marcomm','Produksi Video','Fendys','Sedang','Belum Mulai','']]), 'Action Plan');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Waktu','Oleh','Aksi','Jenis','Item'],['x','Sueb','Tambah','Pekerjaan','Item A'],['x','Sueb','Tambah','Pekerjaan','Item B']]), 'Riwayat');

  console.log('\n[Parse workbook]');
  var res = w.parseBoardWorkbook(wb);
  ok(res.rows && res.rows.length===6 && res.cancelled===1, '6 baris terbaca dari Detail + Action Plan, 1 Batal tidak ikut');
  ok(res.rows.filter(function(r){ return r.title==='Update DM'; }).length===2, 'duplikat dalam satu file tetap terbaca (pekerjaan berulang)');
  var ap = res.rows.filter(function(r){ return r.title==='Announcement Kaly'; })[0];
  ok(ap.status==='doing' && ap.priority==='tinggi' && ap.project==='Action Plan' && /^Minggu 1/.test(ap.note) && ap.due==='', 'Action Plan: status, project dari nama sheet, minggu masuk catatan');
  var dt = res.rows.filter(function(r){ return r.title==='Food testing wedding'; })[0];
  ok(dt.due==='2026-10-03' && dt.note==='Klien puas' && dt.priority==='tinggi' && dt.status==='done' && dt.owner==='Selly', 'Detail: tanggal, keterangan, prioritas, status, PIC');
  ok(res.rows.filter(function(r){ return r.title==='Desain Announcement'; })[0].priority==='normal', '"Sedang" -> Normal');

  console.log('\n[Pencocokan PIC]');
  var scope = w.todoMonitorScope();
  ok(w.matchImportOwner('SELLY TRI', scope).id==='E3' && w.matchImportOwner('Selly', scope).id==='E3', 'nama lengkap & nama depan cocok');
  ok(w.matchImportOwner('AFRIZAL TEGAR SAPUTRA (SUEB)', scope).id==='E2' && w.matchImportOwner('Sueb', scope).id==='E2', 'nama panggilan di dalam kurung cocok');
  ok(w.matchImportOwner('MOCH CHOIRUL EFENDI', scope).id==='E1', 'nama lengkap Fendys cocok');
  ok(w.matchImportOwner('Fendys', scope)===null, '"Fendys" tidak ditebak-tebak (perlu dipilih manual)');

  console.log('\n[Impor lewat akun HR]');
  w.STATE.boardImport = {rows:res.rows, fileName:'Rekap-Kerja.xlsx', cancelled:1, map:{}};
  w.openModal(w.boardImportModalHtml());
  var mm = d.getElementById('modalRoot');
  ok(mm.querySelectorAll('[data-bimap]').length===1 && /Fendys/.test(mm.textContent), 'modal meminta pemetaan untuk PIC "Fendys"');
  var sel = mm.querySelector('[data-bimap="Fendys"]'); sel.value = 'E1'; sel.dispatchEvent(new w.Event('change',{bubbles:true})); await sleep(50);
  ok(d.getElementById('modalRoot').querySelectorAll('[data-bimap]').length===0 && /Akan masuk ke/.test(d.getElementById('modalRoot').textContent), 'setelah dipetakan, semua PIC terpetakan');
  await click('[data-action="board-import-confirm"]');
  var mine = function(id){ return w.DB.todos.filter(function(t){ return t.ownerId===id; }); };
  ok(mine('E1').length===3 && mine('E2').length===2 && mine('E3').length===1, 'tugas masuk ke akun masing-masing (Fendys 3, Sueb 2, Selly 1)');
  ok(mine('E2').length===2 && mine('E2')[0].status==='done' && mine('E2')[0].doneAt, 'status Selesai -> Finish dengan doneAt');
  var proj = w.DB.projects.filter(function(p){ return p.name==='Action Plan'; })[0];
  ok(proj && proj.memberIds.indexOf('E1')!==-1, 'project Action Plan dibuat dan Fendys jadi anggota');
  /* impor ulang: tidak menggandakan */
  w.STATE.boardImport = {rows:res.rows, fileName:'ulang', map:{Fendys:'E1'}};
  var again = w.boardImportConfirm();
  ok(again.added===0 && again.skipped===6, 'impor ulang file yang sama tidak menggandakan data');

  console.log('\n'+pass+' ok, '+fail+' gagal'); process.exit(fail?1:0);
})();

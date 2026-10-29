/* Tes departemen: tombol Sales/Accounting, import Board, Dashboard Accounting. */
var fs = require('fs'), path = require('path');
var JSDOM = require('jsdom').JSDOM;
var html = fs.readFileSync(path.join(__dirname, '..', 'web', 'index.html'), 'utf8')
  .replace(/var SUPABASE_URL = '[^']*'/, "var SUPABASE_URL = ''").replace(/var SUPABASE_ANON_KEY = '[^']*'/, "var SUPABASE_ANON_KEY = ''")
  .replace(/var PUSH_FUNCTION_URL = '[^']*'/, "var PUSH_FUNCTION_URL = ''").replace(/var EMAIL_FUNCTION_URL = '[^']*'/, "var EMAIL_FUNCTION_URL = ''");
var pass = 0, fail = 0;
function ok(c, n){ if(c){ pass++; console.log('  ok   - '+n); } else { fail++; console.log('  FAIL - '+n); } }
function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
(async function(){
  var dom = new JSDOM(html, {url:'https://abc.test/', runScripts:'dangerously', pretendToBeVisual:true});
  var w = dom.window; w.console.error = function(){}; w.scrollTo = function(){}; await sleep(400);
  var d = w.document, opened = [];
  w.open = function(u){ opened.push(u); };
  function emp(id, name, dept){ return {id:id,empCode:id,name:name,position:'Staff',department:dept,properties:[],joinDate:'2025-01-01',dateOfBirth:'1995-01-01',gender:'Laki-laki',baseSalary:1,mealAllowance:0,transportAllowance:0,address:'',phone:'',email:'',username:id,password:'p',active:true}; }
  w.DB.employees = [emp('M1','Mira Marketing','Marketing'), emp('SL','Sandi Sales','sales'), emp('A1','Ayu Accounting','Accounting'), emp('P1','Pandu Purchasing','Purchasing'), emp('K1','Kiki Kitchen','Kitchen')];
  function as(role, id, view, tab){ w.SESSION = role==='hr' ? {role:'hr',empId:null,hrAccountId:null} : {role:role,empId:id}; w.STATE.view=view||'todo'; w.STATE.boardTab='board'; w.STATE.accTab=tab||null; w.STATE.accProp=''; w.render(); }
  async function click(sel){ var el = typeof sel==='string' ? d.querySelector(sel) : sel; if(!el) throw new Error('tidak ada: '+sel); el.dispatchEvent(new w.MouseEvent('click',{bubbles:true})); await sleep(80); }
  function setv(id, v){ d.getElementById(id).value = v; }
  function app(){ return d.getElementById('app').textContent; }

  console.log('\n[Topbar HP]');
  ok(/\.topbar\{padding:10px 12px;flex-wrap:nowrap/.test(html), 'topbar HP nowrap (satu baris)');

  console.log('\n[Departemen default]');
  ok(['Sales','Accounting','Purchasing'].every(function(x){ return w.DB.departments.indexOf(x)!==-1; }), 'Sales/Accounting/Purchasing ada di daftar departemen');

  console.log('\n[Tombol dashboard per departemen]');
  as('staff','M1'); ok(/Dashboard Sales/.test(app()) && !/Dashboard Accounting/.test(app()), 'Marketing: tombol Dashboard Sales saja');
  as('staff','SL'); ok(/Dashboard Sales/.test(app()), 'Sales (huruf kecil) juga dapat tombol');
  as('staff','A1'); ok(/Dashboard Accounting/.test(app()) && !/Dashboard Sales/.test(app()), 'Accounting: tombol Dashboard Accounting saja');
  as('staff','P1'); ok(/Dashboard Accounting/.test(app()), 'Purchasing: tombol Dashboard Accounting');
  as('staff','K1'); ok(!/Dashboard Sales|Dashboard Accounting/.test(app()), 'Kitchen: tidak ada tombol');
  as('staff','M1','dashboard'); ok(/Dashboard Sales/.test(app()), 'tombol juga tampil di dashboard staf');
  as('hr'); ok(/Dashboard Sales/.test(app()) && /Dashboard Accounting/.test(app()), 'HR melihat kedua tombol');
  as('staff','M1'); await click('[data-action="open-sales-dashboard"]');
  ok(opened[0]===w.SALES_DASHBOARD_URL && /^https:/.test(opened[0]), 'tombol Sales membuka URL dashboard');
  as('staff','A1'); await click('[data-action="go-accounting"]');
  ok(w.STATE.view==='accounting' && /Jurnal/.test(app()) && /Neraca/.test(app()) && /Laba Rugi/.test(app()) && /Purchase Order/.test(app()), 'tombol Accounting membuka dashboard dengan 4 bagian');

  console.log('\n[Import spreadsheet Board]');
  as('staff','M1'); ok(!!d.querySelector('[data-action="board-import-open"]'), 'tombol import tampil untuk Marketing');
  as('staff','K1'); ok(!d.querySelector('[data-action="board-import-open"]'), 'tombol import tidak tampil untuk Kitchen');
  as('staff','M1');
  await click('[data-action="board-import-open"]');
  ok(!!d.getElementById('boardImportFile') && /Unduh Template/.test(d.getElementById('modalRoot').textContent), 'modal import + template tampil');
  var res = w.parseBoardRows([['Laporan bulanan'],['No','Judul','Catatan','Tenggat','Prioritas','Status','Project'],
    [1,'Visit Hotel A','nego','2026-11-05','Tinggi','In Progress','Campaign Sales'],
    [2,'Follow up DM','','05/11/2026','low','selesai',''],
    [3,'', 'kosong','','','',''],
    [4,'Tugas tanpa tanggal','','','','tunda','']]);
  ok(res.rows && res.rows.length===3, 'header dideteksi, baris kosong dilewati');
  ok(res.rows[0].due==='2026-11-05' && res.rows[0].priority==='tinggi' && res.rows[0].status==='doing', 'baris 1: tanggal ISO, prioritas, status');
  ok(res.rows[1].due==='2026-11-05' && res.rows[1].priority==='rendah' && res.rows[1].status==='done', 'baris 2: tanggal dd/mm/yyyy, low, selesai');
  ok(res.rows[2].status==='pending', 'tunda -> pending');
  ok(w.parseDateLoose(46000)==='2025-12-09' || /^\d{4}-\d\d-\d\d$/.test(w.parseDateLoose(46000)), 'serial tanggal Excel dibaca');
  ok(w.parseDateLoose('29 Okt 2026')==='2026-10-29', 'tanggal "29 Okt 2026" dibaca');
  ok(w.parseBoardRows([['a','b']]).error, 'tanpa kolom Judul -> error');
  w.STATE.boardImport = {rows:res.rows, fileName:'bulan-lalu.xlsx'};
  w.openModal(w.boardImportModalHtml());
  ok(/3<\/b> tugas siap/.test(d.getElementById('modalRoot').innerHTML), 'preview menampilkan jumlah tugas');
  var before = w.DB.todos.length;
  await click('[data-action="board-import-confirm"]');
  ok(w.DB.todos.length===before+3, '3 tugas masuk ke board');
  var imp = w.DB.todos.filter(function(t){ return t.title==='Visit Hotel A'; })[0];
  ok(imp && imp.ownerId==='M1' && imp.status==='doing' && imp.projectId, 'tugas milik pengimpor, status & project terbawa');
  ok(w.DB.projects.some(function(p){ return p.name==='Campaign Sales' && p.id===imp.projectId; }), 'project baru dibuat otomatis');
  w.STATE.boardImport = {rows:res.rows, fileName:'ulang.xlsx'};
  await click(d.createElement('span')).catch(function(){});
  var r2 = w.boardImportConfirm();
  ok(r2.added===0 && r2.skipped===3, 'impor ulang: duplikat dilewati');
  /* HOD/HR dapat menugaskan lewat kolom Penanggung Jawab */
  w.DB.departmentHods = {Marketing:['M1']};
  as('hod','M1'); w.STATE.boardImport = {rows:[{title:'Tugas untuk Sandi',note:'',due:'',priority:'normal',status:'todo',project:'',owner:'Sandi Sales'}], fileName:'x'};
  w.boardImportConfirm();
  var tSL = w.DB.todos.filter(function(t){ return t.title==='Tugas untuk Sandi'; })[0];
  ok(tSL && (tSL.ownerId==='SL' || tSL.ownerId==='M1'), 'kolom Penanggung Jawab diproses sesuai cakupan');

  console.log('\n[Dashboard Accounting: akses]');
  as('staff','K1','accounting'); ok(/hanya untuk departemen/i.test(app()), 'Kitchen ditolak');
  as('staff','P1','accounting'); var tabsP = Array.prototype.map.call(d.querySelectorAll('.board-tabs .todo-tab'), function(x){ return x.textContent; });
  ok(JSON.stringify(tabsP)===JSON.stringify(['Purchase Order','Petty Cash']), 'Purchasing melihat tab Purchase Order & Petty Cash');
  as('staff','A1','accounting'); var tabsA = Array.prototype.map.call(d.querySelectorAll('.board-tabs .todo-tab'), function(x){ return x.textContent; });
  ok(tabsA.join('|')==='Jurnal|Neraca|Laba Rugi|Purchase Order|Petty Cash|Kategori & Akun', 'Accounting melihat semua tab');

  console.log('\n[Kategori per properti]');
  w.DB.properties = ['Kaly','Padi Heritage','Briggs Inn Surabaya','Briggs Inn Batu']; w.accInit();
  ok(w.DB.properties.every(function(p){ return w.DB.accCats[p] && w.DB.accCats[p].length; }), 'tiap properti punya kategori default');
  as('staff','A1','accounting','kategori');
  setv('catNew1','Event & Gathering'); await click('[data-action="acc-cat-add"][data-idx="1"]');
  ok(w.DB.accCats['Padi Heritage'].indexOf('Event & Gathering')!==-1 && w.DB.accCats['Kaly'].indexOf('Event & Gathering')===-1, 'kategori baru hanya untuk properti terpilih');
  await click('[data-action="acc-cat-del"][data-prop="Padi Heritage"][data-cat="Event & Gathering"]');
  ok(w.DB.accCats['Padi Heritage'].indexOf('Event & Gathering')===-1, 'kategori bisa dihapus');
  setv('coaCode','5600'); setv('coaName','Beban Listrik'); setv('coaType','beban'); await click('[data-action="acc-coa-add"]');
  ok(w.DB.accCoa.some(function(a){ return a.code==='5600'; }), 'akun baru ditambahkan');

  console.log('\n[Jurnal, Neraca, Laba Rugi]');
  var ym = w.STATE.currentMonth, day = ym+'-10';
  function jr(prop, cat, desc, lines){ as('staff','A1','accounting','jurnal'); setv('jr_date',day); setv('jr_prop',prop); setv('jr_desc',desc);
    lines.forEach(function(l,i){ setv('jr_a'+(i+1), l[0]); setv('jr_d'+(i+1), l[1]||''); setv('jr_c'+(i+1), l[2]||''); }); return click('[data-action="acc-journal-add"]'); }
  as('staff','A1','accounting','jurnal');
  setv('jr_prop','Kaly'); setv('jr_desc','Tidak seimbang'); setv('jr_a1','1100'); setv('jr_d1','1000'); setv('jr_a2','4100'); setv('jr_c2','900');
  await click('[data-action="acc-journal-add"]');
  ok((w.DB.accJournals||[]).length===0, 'jurnal tidak seimbang ditolak');
  await jr('Kaly','','Modal awal',[['1100',10000000,''],['3100','',10000000]]);
  await jr('Kaly','','Pendapatan kamar',[['1100',5000000,''],['4100','',5000000]]);
  await jr('Kaly','','Beban listrik',[['5600',1500000,''],['1100','',1500000]]);
  await jr('Padi Heritage','','Pendapatan F&B',[['1100',2000000,''],['4200','',2000000]]);
  ok(w.DB.accJournals.filter(function(j){ return !j.deleted; }).length===4, '4 jurnal seimbang tersimpan');
  w.STATE.accProp='Kaly'; as('staff','A1','accounting','labarugi'); w.STATE.accProp='Kaly'; w.render();
  var rk = w.accReport('Kaly', ym).totals;
  ok(rk.pendapatan===5000000 && rk.beban===1500000 && rk.laba===3500000, 'Laba Rugi Kaly: 5jt - 1,5jt = 3,5jt');
  var ra = w.accReport('', ym).totals;
  ok(ra.pendapatan===7000000 && ra.laba===5500000, 'Laba Rugi semua properti = 5,5jt');
  ok(/Laba Bersih/.test(app()) && /Rp3\.500\.000/.test(app()), 'halaman Laba Rugi menampilkan laba Kaly');
  var nk = w.accReport('', ym).totals;
  ok(nk.aset===15500000 && nk.aset===nk.pasiva, 'Neraca seimbang: aset 15,5jt = kewajiban+modal');
  as('staff','A1','accounting','neraca'); ok(/Neraca seimbang/.test(app()), 'halaman Neraca menunjukkan seimbang');
  var jid = w.DB.accJournals[0].id;
  as('staff','A1','accounting','jurnal'); await click('[data-action="acc-journal-del"][data-id="'+jid+'"]');
  ok(w.DB.accJournals[0].deleted===true && w.accReport('', ym).totals.aset!==15500000, 'hapus jurnal (soft-delete) mengubah laporan');

  console.log('\n[Purchase Order]');
  as('staff','K1','accounting','po'); ok(/hanya untuk departemen/i.test(app()), 'staf biasa (bukan HOD) tidak bisa buka PO');
  w.DB.departmentHods = {Kitchen:['K1']};
  as('hod','K1'); ok(/Buat \/ Lihat PO/.test(app()) && !/Dashboard Sales/.test(app()), 'HOD non-Purchasing melihat tombol PO');
  as('hod','K1','accounting','po');
  ok(d.querySelector('[data-action="acc-po-add"]') && d.querySelectorAll('.board-tabs .todo-tab').length===1, 'HOD hanya melihat tab Purchase Order + form ajukan');
  as('staff','P1','accounting','po'); ok(!d.querySelector('[data-action="acc-po-add"]'), 'staf Purchasing tidak bisa membuat PO');
  as('hod','K1','accounting','po');
  setv('po_date',day); setv('po_prop','Briggs Inn Batu'); setv('po_vendor','CV Sumber Makmur');
  setv('poi_n1','Beras'); setv('poi_q1','10'); setv('poi_u1','kg'); setv('poi_p1','14000');
  setv('poi_n2','Minyak'); setv('poi_q2','5'); setv('poi_u2','ltr'); setv('poi_p2','18000');
  await click('[data-action="acc-po-add"]');
  var po = w.DB.accPOs[0];
  ok(po && po.status==='diajukan' && po.createdById==='K1' && /^PO-\d{6}-001$/.test(po.no) && w.poTotal(po)===230000, 'HOD mengajukan PO: nomor otomatis, total 230.000');
  ok(w.DB.notifications.some(function(n){ return n.audience.type==='emp' && n.audience.empId==='P1' && /PO baru/.test(n.message); }), 'Purchasing dapat notifikasi PO baru');
  ok(!w.DB.notifications.some(function(n){ return n.audience.type==='emp' && n.audience.empId==='A1' && /PO baru/.test(n.message); }), 'Accounting belum diberi notifikasi (belum waktunya)');
  ok(!d.querySelector('[data-action="acc-po-status"]'), 'HOD tidak bisa menyetujui PO sendiri');
  as('staff','A1','accounting','po'); ok(!d.querySelector('[data-action="acc-po-status"]'), 'Accounting tidak menyetujui (itu tugas Purchasing)');
  as('staff','P1','accounting','po');
  await click('[data-action="acc-po-status"][data-to="disetujui"]');
  ok(po.status==='disetujui', 'Purchasing menyetujui PO');
  ok(w.DB.notifications.some(function(n){ return n.audience.empId==='K1' && /disetujui/.test(n.message); }), 'HOD pengaju dapat notifikasi');
  await click('[data-action="acc-po-status"][data-to="diterima"]');
  ok(po.status==='diterima', 'Purchasing menandai barang diterima');
  as('staff','A1','accounting','po'); await click('[data-action="acc-po-journal"]');
  var pj = w.DB.accJournals.filter(function(j){ return j.poId===po.id; })[0];
  ok(pj && po.journalId===pj.id && pj.property==='Briggs Inn Batu' && pj.lines[0].acc==='1300' && pj.lines[1].acc==='2100' && pj.lines[0].debit===230000, 'Accounting: jurnal otomatis Persediaan (D) / Hutang Usaha (K)');
  ok(w.STATE.currentMonth===w.todayISO().slice(0,7), 'bulan aktif pindah ke bulan jurnal otomatis');
  var nb = w.accReport('Briggs Inn Batu', w.STATE.currentMonth).totals;
  ok(nb.aset===230000 && nb.kewajiban===230000, 'Neraca properti Briggs Inn Batu ikut berubah');
  as('hod','K1','accounting','po'); w.STATE.currentMonth = day.slice(0,7); w.render();
  setv('po_date',day); setv('po_vendor','Toko B'); setv('poi_n1','Gula'); setv('poi_q1','2'); setv('poi_p1','15000');
  await click('[data-action="acc-po-add"]'); var po2 = w.DB.accPOs[0];
  ok(/-002$/.test(po2.no), 'nomor PO berurutan (002)');
  as('staff','P1','accounting','po'); await click('[data-action="acc-po-status"][data-id="'+po2.id+'"][data-to="ditolak"]');
  ok(po2.status==='ditolak', 'Purchasing bisa menolak PO');
  as('hod','K1','accounting','po'); await click('[data-action="acc-po-del"][data-id="'+po2.id+'"]');
  ok(po2.deleted===true, 'HOD pengaju bisa menghapus PO yang ditolak');
  w.DB.departmentHods = {Kitchen:['K1'], Marketing:['M1']}; as('hod','M1','accounting','po');
  ok(d.querySelectorAll('tbody tr td b').length===0, 'HOD lain tidak melihat PO milik HOD lain');

  console.log('\n[Isi laporan langsung (Accounting)]');
  as('staff','A1','accounting','labarugi'); w.STATE.currentMonth = day.slice(0,7); w.STATE.accProp=''; w.render();
  ok(!!d.querySelector('[data-action="acc-quick-add"][data-kind="lr"]'), 'form isi Laba Rugi langsung tampil');
  var b0 = w.accReport('Padi Heritage', day.slice(0,7)).totals;
  setv('q_date',day); setv('q_prop','Padi Heritage'); setv('q_acc','4100'); setv('q_amt','3000000'); setv('q_via','1100');
  await click('[data-action="acc-quick-add"][data-kind="lr"]');
  var b1 = w.accReport('Padi Heritage', day.slice(0,7)).totals;
  ok(b1.pendapatan-b0.pendapatan===3000000, 'input pendapatan langsung masuk Laba Rugi');
  as('staff','A1','accounting','labarugi'); setv('q_date',day); setv('q_prop','Padi Heritage'); setv('q_acc','5300'); setv('q_amt','500000'); setv('q_via','1100');
  await click('[data-action="acc-quick-add"][data-kind="lr"]');
  ok(w.accReport('Padi Heritage', day.slice(0,7)).totals.beban-b1.beban===500000, 'input beban langsung masuk Laba Rugi');
  as('staff','A1','accounting','neraca'); setv('q_date',day); setv('q_prop','Briggs Inn Surabaya'); setv('q_acc','1500'); setv('q_amt','80000000');
  await click('[data-action="acc-quick-add"][data-kind="nr"]');
  var ns = w.accReport('Briggs Inn Surabaya', day.slice(0,7)).totals;
  ok(ns.aset===80000000 && ns.aset===ns.pasiva, 'saldo neraca langsung masuk dan tetap seimbang');
  as('staff','P1','accounting','po'); ok(!d.querySelector('[data-action="acc-quick-add"]'), 'Purchasing tidak bisa mengisi laporan');

  console.log('\n[HR melihat semua aktivitas keuangan]');
  ok(w.navItemsFor('hr').some(function(i){ return i.v==='accounting'; }), 'menu Dashboard Accounting ada untuk HR');
  w.DB.departmentHods = {Kitchen:['K1']};
  as('hr',null,'accounting','po'); w.STATE.currentMonth = day.slice(0,7); w.render();
  ok(/PO-\d{6}-001/.test(app()), 'HR melihat PO milik HOD');
  ok(Array.prototype.map.call(d.querySelectorAll('.board-tabs .todo-tab'), function(x){ return x.textContent; }).join('|')==='Jurnal|Neraca|Laba Rugi|Purchase Order|Petty Cash|Kategori & Akun', 'HR melihat semua tab');
  ok(!d.querySelector('[data-action="acc-po-add"]') && !d.querySelector('[data-action="acc-po-status"]') && !d.querySelector('[data-action="acc-po-journal"]') && !d.querySelector('[data-action="acc-po-del"]'), 'HR hanya memantau PO: tanpa form ajukan & tombol proses');
  ok(!w.DB.notifications.some(function(n){ return n.audience.type==='hr' && /PO /.test(n.message); }), 'HR tidak dikirimi notifikasi PO (hanya memantau)');
  as('hr',null,'accounting','jurnal'); w.STATE.currentMonth = day.slice(0,7); w.render();
  ok(/Pendapatan kamar|Beban listrik/.test(app()), 'HR melihat jurnal');
  as('hr',null,'activity-log'); ok(/Input laporan keuangan|PO .* diterima|Jurnal baru/.test(app()), 'Riwayat Aktivitas HR mencatat aktivitas keuangan');

  console.log('\n[Dashboard HOD tanpa tim]');
  w.DB.departmentHods = {};
  as('hod','K1','dashboard');
  ok(/Durasi|MASUK|Masuk/i.test(app()) && /Belum ada anggota tim/.test(app()), 'HOD tanpa tim tetap melihat dashboard pribadi');

  console.log('\n[Sinkron]');
  w.mergeLiveData({accJournals:[{id:'JR_REMOTE',date:day,property:'Kaly',lines:[],updatedAt:'2099-01-01'}], accPOs:[], accCats:{Kaly:['Baru dari HP lain']}});
  ok(w.DB.accJournals.some(function(j){ return j.id==='JR_REMOTE'; }) && w.DB.accCats.Kaly.indexOf('Baru dari HP lain')!==-1, 'jurnal & kategori dari perangkat lain tergabung');

  console.log('\n'+pass+' ok, '+fail+' gagal'); process.exit(fail?1:0);
})();

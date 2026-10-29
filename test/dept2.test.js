/* Tes: Petty Cash, grafik & unduh, Report Karyawan (KPI), HR dashboard. */
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
  var d = w.document, saved = null;
  w.XLSX = {utils:{book_new:function(){ return {sheets:[]}; }, aoa_to_sheet:function(r){ return {rows:r}; }, book_append_sheet:function(wb,ws,n){ wb.sheets.push({name:n, rows:ws.rows}); }}, writeFile:function(wb,f){ saved = {wb:wb, file:f}; }};
  function emp(id, name, dept){ return {id:id,empCode:id,name:name,position:'Staff',department:dept,properties:[],joinDate:'2025-01-01',dateOfBirth:'1995-01-01',gender:'Laki-laki',baseSalary:1,mealAllowance:0,transportAllowance:0,address:'',phone:'',email:'',username:id,password:'p',active:true}; }
  w.DB.employees = [emp('H1','Hana HOD','Marketing'), emp('S1','Sari Staf','Marketing'), emp('S2','Sigit Staf','Marketing'), emp('A1','Ayu Accounting','Accounting'), emp('P1','Pandu Purchasing','Purchasing')];
  w.DB.departmentHods = {Marketing:['H1']};
  w.DB.properties = ['Kaly','Padi Heritage','Briggs Inn Surabaya','Briggs Inn Batu']; w.accInit();
  var ym = w.todayISO().slice(0,7), day = ym+'-10'; w.STATE.currentMonth = ym;
  function as(role, id, view, tab){ w.SESSION = role==='hr' ? {role:'hr',empId:null,hrAccountId:null} : {role:role,empId:id}; w.STATE.view=view||'accounting'; w.STATE.accTab=tab||null; w.STATE.accProp=''; w.render(); }
  async function click(sel){ var el = typeof sel==='string' ? d.querySelector(sel) : sel; if(!el) throw new Error('tidak ada: '+sel); el.dispatchEvent(new w.MouseEvent('click',{bubbles:true})); await sleep(80); }
  function setv(id, v){ d.getElementById(id).value = v; }
  function app(){ return d.getElementById('app').textContent; }

  console.log('\n[Petty Cash]');
  as('staff','A1','accounting','petty');
  ok(!!d.getElementById('pc_amt') && /Saldo Akhir/.test(app()), 'Accounting melihat form & ringkasan petty cash');
  setv('pc_date',day); setv('pc_prop','Kaly'); setv('pc_type','out'); setv('pc_amt','50000'); setv('pc_desc','Beli galon');
  await click('[data-action="acc-petty-add"]');
  ok((w.DB.accPetty||[]).length===0, 'pengeluaran ditolak jika saldo tidak cukup');
  setv('pc_date',day); setv('pc_prop','Kaly'); setv('pc_type','in'); setv('pc_amt','500000'); setv('pc_desc','Top-up kas kecil');
  await click('[data-action="acc-petty-add"]');
  as('staff','P1','accounting','petty'); ok(!!d.getElementById('pc_amt'), 'Purchasing juga bisa mencatat petty cash');
  setv('pc_date',day); setv('pc_prop','Kaly'); setv('pc_type','out'); setv('pc_amt','120000'); setv('pc_desc','Beli ATK');
  await click('[data-action="acc-petty-add"]');
  var ms = w.pettyMonthSum('Kaly', ym);
  ok(ms.in===500000 && ms.out===120000 && w.pettyBalance('Kaly','9999-12-31')===380000, 'saldo petty cash Kaly = 380.000');
  ok(w.pettyBalance('Padi Heritage','9999-12-31')===0, 'saldo terpisah per properti');
  ok(/Rp380\.000/.test(app()), 'saldo akhir tampil di halaman');
  as('hr',null,'accounting','petty'); ok(!d.getElementById('pc_amt') && /Beli ATK/.test(app()), 'HR hanya memantau petty cash');
  as('hod','H1','accounting','petty'); ok(/Aksi|Purchase Order/.test(app()) && !/Petty Cash/.test(Array.prototype.map.call(d.querySelectorAll('.board-tabs .todo-tab'), function(x){ return x.textContent; }).join('|')), 'HOD tidak melihat tab Petty Cash');

  console.log('\n[Grafik & unduh Dashboard Accounting]');
  as('staff','A1','accounting','jurnal');
  ['jurnal','neraca','labarugi','po','petty'].forEach(function(tb){
    as('staff','A1','accounting',tb);
    ok(!!d.querySelector('.acc-chart') && !!d.querySelector('[data-action="acc-dl-png"]') && !!d.querySelector('[data-action="acc-dl-xlsx"]'), 'tab '+tb+': ada kotak grafik + tombol unduh');
  });
  as('staff','A1','accounting','jurnal'); setv('jr_date',day); setv('jr_prop','Kaly'); setv('jr_desc','Pendapatan'); setv('jr_a1','1100'); setv('jr_d1','4000000'); setv('jr_a2','4100'); setv('jr_c2','4000000');
  await click('[data-action="acc-journal-add"]');
  as('staff','A1','accounting','labarugi'); ok(!!d.querySelector('.acc-chart svg rect[fill="#1565A8"]'), 'grafik Laba Rugi berisi batang data');
  await click('[data-action="acc-dl-xlsx"]');
  ok(saved && /Laba Rugi/.test(saved.file) && /\.xlsx$/.test(saved.file) && saved.wb.sheets[0].rows.some(function(r){ return r[0]==='Total Pendapatan' && r[1]===4000000; }), 'unduh Excel Laba Rugi berisi total pendapatan');
  as('staff','A1','accounting','petty'); await click('[data-action="acc-dl-xlsx"]');
  ok(saved.wb.sheets[0].name==='Petty Cash' && saved.wb.sheets[0].rows.length===3, 'unduh Excel Petty Cash (2 catatan + header)');
  var blobs = 0; w.URL.createObjectURL = function(){ blobs++; return 'blob:x'; }; w.URL.revokeObjectURL = function(){};
  w.Image = function(){ var o = {}; setTimeout(function(){ o.onload && o.onload(); }, 5); return o; };
  w.HTMLCanvasElement.prototype.getContext = function(){ return {fillRect:function(){}, drawImage:function(){}, set fillStyle(v){}}; };
  w.HTMLCanvasElement.prototype.toBlob = function(cb){ cb(new w.Blob(['x'])); };
  as('staff','A1','accounting','petty'); await click('[data-action="acc-dl-png"]'); await sleep(100);
  ok(blobs===1, 'unduh grafik PNG memicu pengunduhan file');
  ok(w.svgBarChart('t',[],[{name:'a',values:[]}]).indexOf('empty-state')!==-1, 'grafik kosong menampilkan pesan, bukan error');

  console.log('\n[Report Karyawan]');
  w.DB.kpiRecords = [
    {id:'K1',empId:'S1',period:ym,department:'Marketing',status:'approved',totalScore:1.0,totalStatus:'tercapai',items:[]},
    {id:'K2',empId:'S2',period:ym,department:'Marketing',status:'approved',totalScore:0.9,totalStatus:'mendekati',items:[]},
    {id:'K3',empId:'S2',period:ym,department:'Marketing',status:'draft',totalScore:0.1,items:[]}];
  w.DB.todos = [{id:'T1',ownerId:'S1',title:'Tugas A',status:'done',due:day,createdAt:day+'T01:00:00Z',doneAt:day+'T05:00:00Z',priority:'normal'},
    {id:'T2',ownerId:'S2',title:'Tugas B',status:'done',due:day,createdAt:day+'T01:00:00Z',priority:'normal'}];
  w.DB.timesheets = [{id:'TS1',empId:'S1',projectId:null,date:day,hours:3}];
  ok(w.starsOf(1)===5 && w.starsOf(0.9)===4 && w.starsOf(0.8)===3 && w.starsOf(0.6)===2 && w.starsOf(0.3)===1 && w.starsOf(0)===0, 'pemetaan skor ke bintang');
  ok(w.starsOf(0.7999999999)===3, 'toleransi pembulatan desimal pada ambang bintang');
  as('hod','H1','kpi'); w.STATE.erFrom = ym; w.STATE.erTo = ym; w.render();
  ok(!!d.getElementById('empReportCard') && !!d.getElementById('erFrom') && !!d.getElementById('erTo'), 'HOD: kartu Report Karyawan + pengatur periode tampil di halaman KPI');
  var per = w.erPeriod(), r1 = w.empReport(w.getEmployee('S1'), per), r2 = w.empReport(w.getEmployee('S2'), per);
  ok(r1.kpiAvg===1 && r1.done===1 && r1.tasks.length===1 && r1.tsHours===3, 'Sari: KPI 100%, 1 tugas selesai, 3 jam timesheet');
  ok(Math.round(r1.finalScore*1000)===1000 && r1.stars===5, 'skor akhir Sari 100 = 5 bintang');
  ok(r2.kpiAvg===0.9 && r2.stars===4, 'KPI draft diabaikan, hanya yang disetujui: Sigit 4 bintang');
  ok(/★★★★★/.test(app()) && /★★★★☆/.test(app()), 'tabel pratinjau menampilkan bintang');
  await click('[data-action="er-dl-xlsx"]');
  var names = saved.wb.sheets.map(function(x){ return x.name; });
  ok(JSON.stringify(names)===JSON.stringify(['Ringkasan','KPI per Bulan','Tugas','Kehadiran Harian','Metode']), 'Excel punya 5 sheet');
  var sum = saved.wb.sheets[0].rows;
  var sari = sum.filter(function(r){ return r[0]==='Sari Staf'; })[0];
  ok(sari && sari[sum[2].indexOf('Bintang')]==='★★★★★' && sari[sum[2].indexOf('Akumulasi Skor KPI (%)')]===100, 'baris Sari: bintang & akumulasi skor KPI');
  ok(!sum.some(function(r){ return r[0]==='Ayu Accounting'; }), 'HOD hanya mengunduh timnya (departemen sendiri)');
  ok(saved.wb.sheets[2].rows.length===3 && saved.wb.sheets[1].rows.length===3, 'sheet Tugas dan KPI berisi data periode');
  /* periode multi-bulan & filter karyawan */
  var prev = w.monthsBack(ym, 3)[0];
  w.STATE.erFrom = prev; w.STATE.erTo = ym; ok(w.erPeriod().months.length===3, 'periode 3 bulan terbaca');
  w.STATE.erFrom = ym; w.STATE.erTo = prev; ok(w.erPeriod().from===prev && w.erPeriod().to===ym, 'periode terbalik otomatis diperbaiki');
  w.STATE.erFrom = ym; w.STATE.erTo = ym; w.STATE.erEmp = 'S2'; ok(w.erSelected().length===1 && w.erSelected()[0].id==='S2', 'filter satu karyawan');
  w.STATE.erEmp = '';
  as('hr',null,'kpi-approval'); ok(!!d.getElementById('empReportCard') && !!d.getElementById('erDept'), 'HR: Report Karyawan + filter departemen');
  w.STATE.erDept = ''; w.render(); ok(w.erSelected().length===5, 'HR bisa mengunduh semua karyawan');
  var pdfCalls = 0; w.jspdf = {jsPDF:function(){ return {internal:{pageSize:{getWidth:function(){ return 842; },getHeight:function(){ return 595; }}}, setFont:function(){}, setFontSize:function(){}, text:function(){ pdfCalls++; }, line:function(){}, addPage:function(){}, save:function(f){ saved = {file:f}; }}; }};
  await click('[data-action="er-dl-pdf"]'); ok(pdfCalls>10 && /\.pdf$/.test(saved.file), 'unduh PDF Report Karyawan');

  console.log('\n[HR memantau dashboard Sales/Marketing]');
  as('hr',null,'dashboard'); ok(/Dashboard Sales/.test(app()) && /Dashboard Accounting/.test(app()), 'dashboard HR menampilkan tombol Dashboard Sales & Accounting');

  console.log('\n'+pass+' ok, '+fail+' gagal'); process.exit(fail?1:0);
})();

/* Tes grafik Selaras Board (semua akun). */
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
  var d = w.document;
  function emp(id, name, dept){ return {id:id,empCode:id,name:name,position:'Staff',department:dept,properties:[],joinDate:'2025-01-01',dateOfBirth:'1995-01-01',gender:'Laki-laki',baseSalary:1,mealAllowance:0,transportAllowance:0,address:'',phone:'',email:'',username:id,password:'p',active:true}; }
  w.DB.employees = [emp('H1','Hana HOD','Marketing'), emp('S1','Sari Staf','Marketing'), emp('S2','Sigit Staf','Marketing')];
  w.DB.departmentHods = {Marketing:['H1']};
  var today = w.todayISO(), ym = today.slice(0,7), n = new Date().toISOString();
  function td(id,o,st,pr){ return {id:id,ownerId:o,title:'T'+id,note:'',due:today,priority:pr||'normal',status:st,createdById:o,createdAt:n,updatedAt:n,doneAt:st==='done'?n:null}; }
  w.DB.todos = [td('1','S1','todo','tinggi'),td('2','S1','doing'),td('3','S1','done','rendah'),td('4','S2','done'),td('5','S2','pending'),td('6','H1','todo'),td('7','hr','doing'),
    Object.assign(td('8','S1','done'),{rekap:true,source:'rekap'}),Object.assign(td('9','H1','done'),{rekap:true,source:'rekap'}),Object.assign(td('10','hr','done'),{rekap:true,source:'rekap'})];
  w.DB.projects = [{id:'P1',name:'Campaign Natal',status:'aktif',ownerId:'H1',memberIds:['S1','S2'],createdAt:n,updatedAt:n}];
  w.DB.timesheets = [{id:'TS1',empId:'S1',projectId:'P1',date:today,hours:3,createdAt:n,updatedAt:n},{id:'TS2',empId:'S2',projectId:'P1',date:today,hours:2,createdAt:n,updatedAt:n}];
  w.DB.agenda = [{id:'A1',title:'Meeting',date:today,startTime:'10:00',scope:'semua',ownerId:'H1',createdAt:n,updatedAt:n}];
  function as(role, id, tab, sub){ w.SESSION = role==='hr' ? {role:'hr',empId:null,hrAccountId:null} : {role:role,empId:id}; w.STATE.view='todo'; w.STATE.boardTab=tab; w.STATE.todoTab=sub||'mine'; w.STATE.boardMonth=null; w.render(); }
  function charts(){ return d.querySelectorAll('.chart-card svg rect[fill="#1565A8"], .chart-card svg rect[fill="#F59E0B"], .chart-card svg rect[fill="#16A34A"], .chart-card svg rect[fill="#DC2626"]').length; }
  async function click(sel){ var el = d.querySelector(sel); if(!el) throw new Error('tidak ada: '+sel); el.dispatchEvent(new w.MouseEvent('click',{bubbles:true})); await sleep(80); }

  console.log('\n[Grafik di semua akun & tab]');
  [['staff','S1'],['hod','H1'],['hr',null]].forEach(function(a){
    ['board','project','agenda','rekap'].forEach(function(tab){
      as(a[0], a[1], tab);
      ok(d.querySelectorAll('.chart-card svg').length>=1 && d.querySelector('[data-action="chart-dl-png"]'), a[0]+' / tab '+tab+': grafik + tombol unduh');
    });
  });
  as('staff','S1','board'); ok(d.querySelectorAll('.chart-card').length===3, 'Board staf: 3 grafik (status, prioritas, tren 6 bulan)');
  ok(/Tugas per Status/.test(d.getElementById('app').innerHTML) && /aria-label="Tugas per Status"/.test(d.getElementById('app').innerHTML), 'grafik status berjudul benar');
  var st = w.todosOf('S1'); ok(st.length===4, 'data sumber grafik: 4 tugas Sari');
  as('hod','H1','board','monitor'); ok(/Tugas per Anggota/.test(d.getElementById('app').innerHTML), 'HOD monitor: grafik per anggota');
  as('hr',null,'board','monitor'); ok(/Tugas per Anggota/.test(d.getElementById('app').innerHTML), 'HR monitor: grafik per anggota');
  as('hod','H1','project'); ok(/Jam Kerja per Orang/.test(d.getElementById('app').innerHTML) && /Jam Kerja per Project/.test(d.getElementById('app').innerHTML), 'HOD: grafik jam per project & per orang');
  as('staff','S1','project'); ok(!/Jam Kerja per Orang/.test(d.getElementById('app').innerHTML), 'staf: tidak ada grafik per orang');
  as('staff','S1','agenda'); ok(/Agenda per Minggu/.test(d.getElementById('app').innerHTML), 'agenda: grafik per minggu');
  ok(w.svgBarChart('x',['a'],[{name:'s',values:[0]}],w.fmtCount).indexOf('empty-state')!==-1, 'data kosong tidak membuat grafik rusak');
  as('staff','S1','rekap'); ok(/Pekerjaan per Hari/.test(d.getElementById('app').innerHTML), 'Rekap Kerja: grafik pekerjaan per hari');
  var dl = 0; w.URL.createObjectURL = function(){ dl++; return 'blob:x'; }; w.URL.revokeObjectURL = function(){};
  w.Image = function(){ var o = {}; setTimeout(function(){ o.onload && o.onload(); }, 5); return o; };
  w.HTMLCanvasElement.prototype.getContext = function(){ return {fillRect:function(){}, drawImage:function(){}, set fillStyle(v){}}; };
  w.HTMLCanvasElement.prototype.toBlob = function(cb){ cb(new w.Blob(['x'])); };
  as('staff','S1','board'); await click('[data-action="chart-dl-png"]'); await sleep(100); ok(dl===1, 'tombol Unduh Grafik memicu unduhan PNG');
  console.log('\n[Klik batang -> data tampil]');
  as('staff','S1','board');
  var hit = d.querySelector('.chart-card svg .chit');
  ok(!!d.querySelector('.chart-card svg path.cbar'), 'batang berbentuk path (sudut atas membulat)');
  hit.dispatchEvent(new w.MouseEvent('click',{bubbles:true})); await sleep(30);
  var tip = d.querySelector('.chart-tip');
  ok(!!tip && /To Do|In Progress|Finish|Pending/.test(tip.textContent) && /Jumlah tugas/.test(tip.textContent), 'tooltip muncul berisi kategori, seri & nilai');
  ok(hit.ownerSVGElement.classList.contains('has-sel'), 'batang terpilih disorot');
  d.body.dispatchEvent(new w.MouseEvent('click',{bubbles:true})); await sleep(30);
  ok(!d.querySelector('.chart-tip'), 'klik di luar menutup tooltip');
  hit = d.querySelector('.chart-card svg .chit');
  hit.dispatchEvent(new w.MouseEvent('click',{bubbles:true})); hit.dispatchEvent(new w.MouseEvent('click',{bubbles:true})); await sleep(30);
  ok(!d.querySelector('.chart-tip'), 'klik batang yang sama lagi menutup tooltip');
  w.render(); ok(!d.querySelector('.cbar-anim'), 'animasi tidak diulang saat render ulang data sama');
  console.log('\n'+pass+' ok, '+fail+' gagal'); process.exit(fail?1:0);
})();

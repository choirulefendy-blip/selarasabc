/* Tes halaman Laporan & Grafik. */
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
  w.DB.employees = [emp('H1','Hana HOD','Marketing'), emp('S1','Sari Staf','Marketing'), emp('S2','Sigit Staf','Marketing'), emp('F1','Fani Finance','Finance')];
  w.DB.departmentHods = {Marketing:['H1']};
  var ym = '2026-09'; w.STATE.currentMonth = ym;
  w.DB.schedules[ym] = {}; w.DB.attendance[ym] = {};
  ['H1','S1','S2','F1'].forEach(function(id){ w.DB.schedules[ym][id]={}; w.DB.attendance[ym][id]={}; for(var day=1;day<=10;day++){ w.DB.schedules[ym][id][day]={type:'kerja',start:'09:00',end:'17:00'}; } });
  for(var day=1;day<=10;day++){
    w.DB.attendance[ym].S1[day] = {checkIn: day<=3?'09:40':'08:55', checkOut:'17:30'};   /* 3x telat */
    if(day<=8) w.DB.attendance[ym].S2[day] = {checkIn:'08:50', checkOut:'18:10'};           /* 2x alpha */
    w.DB.attendance[ym].H1[day] = {checkIn:'08:55', checkOut:'17:00'};
    w.DB.attendance[ym].F1[day] = {checkIn:'08:55', checkOut:'17:00'};
  }
  w.DB.overtimeRequests.push({id:'OT1',empId:'S2',date:ym+'-04',startTime:'18:00',endTime:'20:00',durationHours:2,status:'approved'});
  function names(){ return Array.prototype.map.call(d.querySelectorAll('.rp-name'), function(x){ return x.textContent; }); }

  console.log('\n[Statistik]');
  var st = w.reportStatsFor(w.getEmployee('S1'), ym);
  ok(st.telat===3 && st.hadir===7 && st.alpha===0 && st.lateMin>0, 'S1: 3 telat, 7 hadir, menit telat terhitung');
  var st2 = w.reportStatsFor(w.getEmployee('S2'), ym);
  ok(st2.alpha===2 && st2.overtime===2, 'S2: 2 alpha, lembur disetujui 2 jam');
  ok(Math.abs(w.workedHours({checkIn:'08:50',checkOut:'18:10'})-9.333)<0.01, 'jam kerja harian dihitung dari masuk-pulang');

  console.log('\n[HR]');
  w.SESSION = {role:'hr',empId:null,hrAccountId:null}; w.STATE.view='report'; w.render();
  ok(names().filter(function(n){ return n==='Fani Finance'; }).length>0 && names().indexOf('Sari Staf')!==-1, 'HR melihat staf semua departemen');
  ok(d.querySelectorAll('.rp-svg').length>=1 && d.querySelectorAll('.rp-row').length>=8, 'grafik batang & tren harian tampil');
  ok(!!d.getElementById('reportDept'), 'HR punya filter departemen');
  var sel = d.getElementById('reportDept'); sel.value='Finance'; sel.dispatchEvent(new w.Event('change',{bubbles:true})); await sleep(50);
  ok(names().indexOf('Sari Staf')===-1 && names().indexOf('Fani Finance')!==-1, 'filter departemen bekerja');
  w.STATE.reportDept=''; w.render();
  sel = d.getElementById('reportEmp'); sel.value='S1'; sel.dispatchEvent(new w.Event('change',{bubbles:true})); await sleep(50);
  ok(d.querySelector('.card-title').textContent.length>0 && d.body.textContent.indexOf('Jam Kerja Harian')!==-1 && d.body.textContent.indexOf('Sari Staf')!==-1, 'pilih satu staf menampilkan grafik jam kerja hariannya');

  console.log('\n[HOD]');
  w.STATE.reportEmp=''; w.SESSION = {role:'hod',empId:'H1'}; w.STATE.view='report'; w.render();
  var n2 = names();
  ok(n2.indexOf('Hana HOD')!==-1 && n2.indexOf('Sari Staf')!==-1 && n2.indexOf('Sigit Staf')!==-1, 'HOD melihat dirinya sendiri dan staf timnya');
  ok(n2.indexOf('Fani Finance')===-1, 'HOD tidak melihat staf departemen lain');
  ok(!d.getElementById('reportDept'), 'HOD tidak punya filter departemen');
  var opts = Array.prototype.map.call(d.querySelectorAll('#reportEmp option'), function(o){ return o.textContent; }).join('|');
  ok(opts.indexOf('Hana HOD (saya)')!==-1 && opts.indexOf('Fani')===-1, 'dropdown HOD: diri sendiri + tim saja');
  w.STATE.reportEmp='H1'; w.render();
  ok(d.body.textContent.indexOf('Jam Kerja Harian')!==-1, 'HOD bisa melihat grafik dirinya sendiri');

  console.log('\n[Menu & akses]');
  ok(w.navItemsFor('hr').some(function(i){ return i.v==='report'; }) && w.navItemsFor('hod').some(function(i){ return i.v==='report'; }), 'menu Laporan & Grafik ada untuk HR dan HOD');
  ok(w.navItemsFor('staff').some(function(i){ return i.v==='report'; }), 'staf biasa punya menu Grafik Saya');
  w.SESSION = {role:'staff',empId:'S1'}; w.STATE.view='report'; w.STATE.reportEmp='S2'; w.render();
  var n3 = names();
  ok(n3.length===0 || n3.every(function(n){ return n==='Sari Staf'; }), 'staf hanya melihat datanya sendiri (S2 diminta, tetap S1)');
  ok(d.body.textContent.indexOf('Sari Staf')!==-1 && d.body.textContent.indexOf('Sigit')===-1 && d.body.textContent.indexOf('Hana')===-1, 'tidak ada nama staf lain di halaman');
  ok(!d.getElementById('reportEmp') && !d.getElementById('reportDept'), 'staf tanpa dropdown pilih orang/departemen');
  ok(d.body.textContent.indexOf('Jam Kerja Harian')!==-1, 'grafik jam kerja harian pribadi tampil');
  ['staff'].forEach(function(role){ var cfg = w.navGroupsFor(role); var all = w.navItemsFor(role).map(function(i){ return i.v; }).sort(); var g = cfg.top.concat([].concat.apply([], cfg.groups.map(function(x){ return x.views; }))).sort(); ok(JSON.stringify(all)===JSON.stringify(g), role+': menu grafik masuk tepat satu kelompok'); });
  ['hr','hod'].forEach(function(role){ var cfg = w.navGroupsFor(role); var all = w.navItemsFor(role).map(function(i){ return i.v; }).sort(); var g = cfg.top.concat([].concat.apply([], cfg.groups.map(function(x){ return x.views; }))).sort(); ok(JSON.stringify(all)===JSON.stringify(g), role+': menu laporan masuk tepat satu kelompok'); });
  console.log('\nHASIL: '+pass+' lulus, '+fail+' gagal');
  process.exit(fail?1:0);
})();

/* Tes durasi kerja di absen. */
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
  w.DB.employees.push({id:'E1',empCode:'A1',name:'Budi',position:'Staff',department:'MC',properties:[],joinDate:'2025-01-01',dateOfBirth:'1995-01-01',gender:'Laki-laki',baseSalary:1,mealAllowance:0,transportAllowance:0,address:'',phone:'',email:'',username:'b',password:'p',active:true});
  /* kunci jam sekarang = 15:00:00 */
  var RealDate = w.Date;
  function FixedDate(){ var a = arguments; if(!a.length){ var x = new RealDate(); x.setHours(15,0,0,0); return x; } return new (Function.prototype.bind.apply(RealDate, [null].concat([].slice.call(a))))(); }
  FixedDate.prototype = RealDate.prototype; FixedDate.now = function(){ var x = new RealDate(); x.setHours(15,0,0,0); return x.getTime(); };
  w.Date = FixedDate;

  console.log('\n[Fase durasi]');
  var s1 = w.workTimerState('07:30',''); ok(s1.phase==='work' && s1.sec===7.5*3600, '7j30m: fase bekerja');
  var s2 = w.workTimerState('06:50',''); ok(s2.phase==='target', '8j10m: fase 8 jam tercapai');
  var s3 = w.workTimerState('06:00',''); ok(s3.phase==='overtime' && s3.sec===9*3600, 'tepat 9 jam: Lembur');
  var s4 = w.workTimerState('05:50','15:00'); ok(!s4.running && s4.phase==='overtime', 'sudah pulang: durasi tetap dari jam pulang, tidak berjalan');
  ok(w.workTimerState('','')===null, 'belum absen masuk: tidak ada timer');

  console.log('\n[Tampilan]');
  var t = w.todayParts();
  function setAtt(inHm, outHm){ w.DB.attendance[t.ym] = w.DB.attendance[t.ym]||{}; w.DB.attendance[t.ym].E1 = w.DB.attendance[t.ym].E1||{}; w.DB.attendance[t.ym].E1[t.day] = {checkIn:inHm, checkOut:outHm||''}; }
  w.DB.schedules[t.ym] = w.DB.schedules[t.ym]||{}; w.DB.schedules[t.ym].E1 = w.DB.schedules[t.ym].E1||{}; w.DB.schedules[t.ym].E1[t.day] = {type:'kerja', start:'07:00', end:'15:00'};
  w.SESSION = {role:'staff', empId:'E1'}; w.STATE.view='dashboard';
  setAtt('07:30',''); w.render();
  var el = d.querySelector('.work-timer');
  ok(!!el, 'timer tampil di kartu jadwal hari ini setelah absen masuk');
  ok(el.textContent.indexOf('7j 30m 00d')!==-1 && el.textContent.indexOf('Sedang bekerja')!==-1 && el.textContent.indexOf('menuju 8 jam')!==-1, '<8 jam: durasi + status Sedang bekerja + sisa waktu');
  ok(!el.querySelector('[data-action="ot-from-timer"]'), '<8 jam: tanpa tombol lembur');
  setAtt('06:50',''); w.render(); el = d.querySelector('.work-timer');
  ok(el.textContent.indexOf('8 jam tercapai')!==-1 && el.textContent.indexOf('absen pulang')!==-1, '8 jam: keterangan bisa menyelesaikan pekerjaan / absen pulang');
  ok(!!el.querySelector('[data-action="nav"][data-view="checkin"]'), '8 jam: tombol Absen Pulang');
  setAtt('05:50',''); w.render(); el = d.querySelector('.work-timer');
  ok(el.textContent.indexOf('Lembur')!==-1 && !!el.querySelector('[data-action="ot-from-timer"]'), '>=9 jam: status Lembur + tombol Ajukan Lembur');
  ok(el.textContent.indexOf('+0j 10m')!==-1, 'lembur dihitung dari lewat 9 jam');

  console.log('\n[Ajukan lembur dari timer]');
  d.querySelector('[data-action="ot-from-timer"]').dispatchEvent(new w.MouseEvent('click',{bubbles:true})); await sleep(80);
  ok(w.STATE.view==='overtime-request', 'tombol membuka halaman Pengajuan Lembur');
  ok(d.getElementById('ot_date').value===t.iso, 'tanggal terisi otomatis');
  ok(d.getElementById('ot_start').value==='14:50' && d.getElementById('ot_end').value==='15:00', 'jam mulai = masuk+9 jam, jam akhir = sekarang');
  ok(w.STATE.otPrefill===null, 'prefill dipakai sekali');
  w.DB.overtimeRequests.push({id:'OT1',empId:'E1',date:t.iso,startTime:'14:50',endTime:'15:00',durationHours:0.17,status:'pending_hod'});
  w.STATE.view='dashboard'; w.render();
  ok(d.querySelector('.work-timer').textContent.indexOf('Lembur sudah diajukan')!==-1 && !d.querySelector('[data-action="ot-from-timer"]'), 'setelah diajukan: tombol diganti keterangan');

  console.log('\n[Tick & halaman absen]');
  var before = d.querySelector('[data-wt="dur"]').textContent;
  w.tickWorkTimers(); ok(d.querySelector('[data-wt="dur"]').textContent===before, 'tick memperbarui teks tanpa merusak elemen');
  setAtt('05:50','14:30'); w.render();
  el = d.querySelector('.work-timer');
  ok(el && el.textContent.indexOf('8j 40m 00d')!==-1, 'sudah absen pulang: durasi final tampil');
  w.STATE.view='checkin'; w.render();
  ok(!!d.querySelector('.work-timer'), 'timer juga tampil di halaman Absen');
  console.log('\nHASIL: '+pass+' lulus, '+fail+' gagal');
  process.exit(fail?1:0);
})();

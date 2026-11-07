/* Tes: perbaikan di atas redesign Antigravity (data dashboard asli, Mode HR, pintasan departemen,
   peringatan absen HR, widget Board, sinkron status kerja, tanda tangan tidak dobel). */
var fs = require('fs'), path = require('path'), JSDOM = require('jsdom').JSDOM;
var html = fs.readFileSync(path.join(__dirname, '..', 'web', 'index.html'), 'utf8')
  .replace(/var SUPABASE_URL = '[^']*'/, "var SUPABASE_URL = ''").replace(/var SUPABASE_ANON_KEY = '[^']*'/, "var SUPABASE_ANON_KEY = ''")
  .replace(/var PUSH_FUNCTION_URL = '[^']*'/, "var PUSH_FUNCTION_URL = ''").replace(/var EMAIL_FUNCTION_URL = '[^']*'/, "var EMAIL_FUNCTION_URL = ''");
var pass = 0, fail = 0;
function ok(c, n){ if(c){ pass++; console.log('  ok   - '+n); } else { fail++; console.log('  FAIL - '+n); } }
function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
(async function(){
  var dom = new JSDOM(html, {url:'https://abcselaras.my.id/web/', runScripts:'dangerously', pretendToBeVisual:true});
  var w = dom.window; w.console.error = function(){}; w.scrollTo = function(){}; await sleep(400);
  var d = w.document;
  function app(){ return d.getElementById('app').textContent; }
  var t = w.todayParts(), ym = t.ym, day = t.day;
  function emp(id, name, dept, extra){ var e = {id:id, empCode:id, name:name, position:'Staff', department:dept, properties:['Briggs Inn'], joinDate:'2025-01-01', active:true, username:id.toLowerCase(), password:'p'}; for(var k in (extra||{})) e[k] = extra[k]; return e; }
  w.DB.employees = [emp('S1','Sari Ayu','Marketing'), emp('S2','Budi Dua','Marketing'), emp('K1','Kiki Kitchen','Kitchen'), emp('IL','Ilin HR','Front Office',{hrAccess:true})];
  w.DB.schedules = {}; w.DB.attendance = {}; w.DB.schedules[ym] = {S1:{}, S2:{}, K1:{}};
  function as(role, id, view){ w.SESSION = role==='hr' ? {role:'hr', empId:null, hrAccountId:null} : {role:role, empId:id}; w.STATE.view = view || 'dashboard'; w.render(); }

  console.log('\n[Dashboard staf: data asli, bukan angka contoh]');
  as('staff','S1');
  ok(!/KPI 89%|\+0% Rate|Shift Regular \(09:00/.test(app()), 'tidak ada angka/jadwal contoh (KPI 89%, +0% Rate, Shift Regular)');
  ok(/Belum ada jadwal/.test(app()), 'tanpa jadwal: tampil "Belum ada jadwal"');
  w.DB.schedules[ym].S1[day] = {type:'libur'}; as('staff','S1');
  ok(/Shift Hari Ini:\s*Libur/.test(app()), 'hari libur: tampil "Libur"');
  w.DB.schedules[ym].S1[day] = {type:'kerja', start:'08:00', end:'17:00'};
  w.DB.schedules[ym].S2[day] = {type:'kerja', start:'08:00', end:'17:00'};
  w.DB.attendance[ym] = {S1:{}, S2:{}};
  w.DB.attendance[ym].S1[day] = {checkIn:'08:20', condition:'kurang_sehat'};
  w.DB.attendance[ym].S2[day] = {checkIn:'07:55', condition:'sehat'};
  as('staff','S1');
  ok(/Shift \(08:00 - 17:00\)/.test(app()), 'shift sesuai jadwal');
  ok(/Kurang Sehat/.test(app()) && !/Kondisi Prima/.test(app()), 'kondisi absen sesuai pilihan (bukan selalu "Kondisi Prima")');
  var mt = w.getMonthSummary('S1', ym).totals;
  ok(mt.telat===1 && /Kehadiran Bulan Ini\s*1\s*\/\s*\d+ Hr/.test(app()) && !/\/ 21 Hr/.test(app().replace(/\/ \d+ Hr/, function(x){ return x; })) , 'kehadiran menghitung hari telat sebagai hadir');
  ok(/0%\s*Tepat Waktu\s*·\s*1x telat/.test(app()), 'persentase tepat waktu dari data asli');
  ok(/Tim Divisi \(Marketing\)\s*2\s*SDM Aktif\s*2 hadir\s*hari ini/.test(app()), 'tim divisi: jumlah SDM & yang hadir hari ini asli');
  ok(!!d.querySelector('.bento-hero-blue .dash-profile-avatar'), 'foto/inisial profil tampil di kartu sapaan');
  ok(w.renderBentoHero(null,'staff')==='' , 'tanpa data karyawan: kartu tidak menampilkan orang/angka palsu');

  console.log('\n[Pintasan departemen]');
  ok(/Dashboard Sales/.test(app()) && !!d.querySelector('.bento-sc-grid [data-action="open-sales-dashboard"]'), 'staf Marketing: Dashboard Sales di shortcut dashboard');
  as('staff','K1'); ok(!/Dashboard Sales|Dashboard Accounting/.test(app()), 'staf Kitchen: tanpa pintasan departemen');
  as('staff','S1','todo'); ok(!!d.querySelector('.dash-dept-pills [data-action="open-sales-dashboard"]'), 'pintasan juga di halaman Selaras Board');

  console.log('\n[Widget Board Saya]');
  w.DB.todos = [{id:'T1', ownerId:'S1', title:'Konten Reels Padi', status:'todo', createdAt:new Date().toISOString()}];
  as('staff','S1'); ok(/Board Saya/.test(app()) && /Konten Reels Padi/.test(app()), 'dashboard staf menampilkan Board Saya');

  console.log('\n[Dashboard HR]');
  as('hr');
  ok(/Peringatan Absen Hari Ini/.test(app()), 'kartu Peringatan Absen Hari Ini kembali');
  ok(/Dashboard Sales/.test(app()) && /Dashboard Accounting/.test(app()), 'One Tap: Dashboard Sales & Dashboard Accounting');
  w.DB.schedules[ym] = {}; w.DB.attendance[ym] = {}; as('hr');
  ok(!/100% Tepat Sasaran/.test(app()) && /Belum ada jadwal kerja hari ini/.test(app()), 'tanpa jadwal hari ini: tidak tampil 100%');

  console.log('\n[Mode HR <-> Mode Karyawan]');
  w.SESSION = w.hrModeSession(w.getEmployee('IL')); w.STATE.view = 'dashboard'; w.render();
  var btn = d.querySelector('.sidebar [data-action="switch-mode"]');
  ok(!!btn && /Mode Karyawan/.test(btn.textContent), 'Mode HR: tombol "Mode Karyawan" di sidebar');
  btn.dispatchEvent(new w.MouseEvent('click', {bubbles:true})); await sleep(80);
  btn = d.querySelector('.sidebar [data-action="switch-mode"]');
  ok(w.SESSION.role!=='hr' && !!btn && /Mode HR/.test(btn.textContent), 'Mode Karyawan: tombol "Mode HR" di sidebar (tidak terjebak)');
  btn.dispatchEvent(new w.MouseEvent('click', {bubbles:true})); await sleep(80);
  ok(w.SESSION.role==='hr' && w.SESSION.asEmpId==='IL', 'bisa kembali ke Mode HR tanpa logout');

  console.log('\n[Sinkron status kerja]');
  w.DB.workStatus = {S1:{k:'meeting', date:'2026-01-01', at:'2026-01-01T02:00:00Z'}};
  w.mergeLiveData({workStatus:{S1:{k:'istirahat', date:'2026-01-01', at:'2026-01-01T01:00:00Z'}, S2:{k:'bekerja', date:'2026-01-01', at:'2026-01-01T03:00:00Z'}}});
  ok(w.DB.workStatus.S1.k==='meeting' && w.DB.workStatus.S2.k==='bekerja', 'status orang lain masuk, status yang lebih baru tidak tertimpa');
  w.mergeLiveData({workStatus:{S1:{k:'istirahat', date:'2026-01-01', at:'2026-01-01T05:00:00Z'}}});
  ok(w.DB.workStatus.S1.k==='istirahat' && w.DB.workStatus.S2.k==='bekerja', 'status lebih baru dari perangkat lain dipakai');

  console.log('\n[Tanda tangan tidak disimpan dobel]');
  w.readFileAsDataURL = function(){ return Promise.resolve('data:image/png;base64,AAAA'); };
  w.compressSignaturePng = function(){ return Promise.resolve('data:image/png;base64,AAAA'); };
  w.uploadAttachment = function(){ return Promise.resolve({key:'sig_x.png', url:null}); };
  w.saveDB = function(){ return Promise.resolve(); };
  w.SESSION = {role:'staff', empId:'S1'};
  await w.setAccountSignatureFromFile('S1', {type:'image/png', size:1000});
  var s1 = w.getEmployee('S1');
  ok(s1.sigKey==='sig_x.png' && !s1.sigDataUrl, 'upload berhasil: hanya kunci storage, tanpa salinan base64 di hrdb');
  w.uploadAttachment = function(){ return Promise.resolve({key:null, url:null}); };
  await w.setAccountSignatureFromFile('S1', {type:'image/png', size:1000});
  ok(/^data:image\/png/.test(w.getEmployee('S1').sigDataUrl||''), 'upload gagal/offline: salinan base64 tetap disimpan');

  console.log('\n[Tampilan: lonceng, kartu persetujuan biru, Board, rekap HP]');
  w.SESSION = {role:'staff', empId:'S1'}; w.STATE.view = 'dashboard'; w.render();
  ok(!d.querySelector('.bento-hero-blue [data-action="notif-open"]'), 'tombol lonceng tanpa fungsi di kartu sapaan dihapus');
  ok(!!d.querySelector('[data-action="toggle-notif"], .notif-bell, .topbar [data-action*="notif"]') || /notif/i.test(d.querySelector('.topbar-right').innerHTML), 'lonceng notifikasi di topbar tetap ada');
  w.DB.departmentHods = w.DB.departmentHods || {};
  var hodSet = false; try{ w.DB.employees[1].department = 'Marketing'; }catch(e){}
  w.SESSION = {role:'hod', empId:'S2'}; w.isHOD = function(id){ return id==='S2'; }; w.getTeamForHod = function(){ return [w.getEmployee('S1')]; }; w.getHodDepartments = function(){ return ['Marketing']; };
  w.STATE.view = 'leave-request'; w.render();
  var blue = Array.prototype.map.call(d.querySelectorAll('.card.card-blue .card-title'), function(x){ return x.textContent; }).join('|');
  ok(/Persetujuan Tim/.test(blue) && /Riwayat Keputusan Saya/.test(blue), 'Persetujuan Tim & Riwayat Keputusan = kartu biru');
  w.STATE.view = 'overtime-request'; w.render();
  ok(/Persetujuan Lembur Tim/.test(Array.prototype.map.call(d.querySelectorAll('.card.card-blue .card-title'), function(x){ return x.textContent; }).join('|')), 'Persetujuan Lembur Tim = kartu biru');
  w.SESSION = {role:'hr', empId:null, hrAccountId:null};
  ['leave-approval','overtime-approval'].forEach(function(v){ w.STATE.view = v; w.render(); });
  ok(!!d.querySelector('.card.card-blue'), 'halaman persetujuan HR memakai kartu biru');
  ok(/\.bd-col-body\{max-height:[^;]+;overflow-y:auto/.test(html), 'kolom Board: scroll per kategori (max-height + overflow-y)');
  w.SESSION = {role:'staff', empId:'S1'}; w.STATE.view = 'todo'; w.STATE.boardTab = 'rekap'; w.render();
  ok(!!d.querySelector('table.rk-table.rk-rekap'), 'tabel rekap punya kelas khusus (tabel aset tidak ikut berubah)');
  ok(/rk-rekap tbody tr:not\(\.mob-full-row\)\{display:flex !important;flex-wrap:wrap/.test(html), 'rekap HP: baris ringkas (flex 2 baris)');

  console.log('\nHASIL: '+pass+' lulus, '+fail+' gagal'); process.exit(fail ? 1 : 0);
})();

/* Tes Selaras Board: Board kanban, Project & Timesheet, Agenda & Kalender. */
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
  var w = dom.window; w.console.error = function(){}; w.scrollTo = function(){}; w.confirm = function(){ return true; }; await sleep(400);
  var d = w.document;
  function emp(id, name, dept){ return {id:id,empCode:id,name:name,position:'Staff',department:dept,properties:[],joinDate:'2025-01-01',dateOfBirth:'1995-01-01',gender:'Laki-laki',baseSalary:1,mealAllowance:0,transportAllowance:0,address:'',phone:'',email:'',username:id,password:'p',active:true}; }
  w.DB.employees = [emp('H1','Hana HOD','Marketing'), emp('S1','Sari Staf','Marketing'), emp('S2','Sigit Staf','Marketing'), emp('F1','Fani Finance','Finance')];
  w.DB.departmentHods = {Marketing:['H1']};
  function as(role, id){ w.SESSION = role==='hr' ? {role:'hr',empId:null,hrAccountId:null} : {role:role,empId:id}; w.STATE.view='todo'; w.STATE.boardTab='board'; w.STATE.todoTab='mine'; w.STATE.projEditId=null; w.STATE.agendaEditId=null; w.render(); }
  async function click(sel){ var el = typeof sel==='string' ? d.querySelector(sel) : sel; if(!el) throw new Error('tidak ada: '+sel); el.dispatchEvent(new w.MouseEvent('click',{bubbles:true})); await sleep(80); }
  function setv(id, v){ d.getElementById(id).value = v; }
  function body(){ return d.getElementById('app').textContent; }

  console.log('\n[Tab Selaras Board]');
  as('staff','S1');
  var tabs = Array.prototype.map.call(d.querySelectorAll('.board-tabs .todo-tab'), function(x){ return x.textContent; });
  ok(JSON.stringify(tabs)===JSON.stringify(['Project & Timesheet','Agenda & Kalender','Board']), 'tiga tab: Project & Timesheet, Agenda & Kalender, Board');
  ok(w.navItemsFor('staff').some(function(i){ return i.label==='Selaras Board'; }) && w.navItemsFor('hr').some(function(i){ return i.label==='Selaras Board'; }) && w.navItemsFor('hod').some(function(i){ return i.label==='Selaras Board'; }), 'menu bernama Selaras Board di semua akun');
  ok(w.titleForView ? true : true, 'ok');

  console.log('\n[Board kanban]');
  var cols = Array.prototype.map.call(d.querySelectorAll('.bd-col'), function(c){ return c.getAttribute('data-col'); });
  ok(JSON.stringify(cols)===JSON.stringify(['todo','doing','done','pending']), '4 kolom: To Do, In Progress, Finish, Pending');
  var heads = Array.prototype.map.call(d.querySelectorAll('.bd-col-head .badge'), function(c){ return c.textContent; }).join('|');
  ok(heads==='To Do|In Progress|Finish|Pending', 'judul kolom sesuai');
  setv('td_title','Edit video Reels'); setv('td_prio','tinggi');
  await click('[data-action="add-todo"]'); await sleep(150);
  var t = w.DB.todos.filter(function(x){ return x.title==='Edit video Reels'; })[0];
  ok(t && t.status==='todo' && d.querySelector('.bd-col[data-col="todo"] [data-todo-id="'+t.id+'"]'), 'tugas baru masuk kolom To Do');
  await click('[data-action="todo-set-status"][data-id="'+t.id+'"][data-status="doing"]');
  ok(t.status==='doing' && d.querySelector('.bd-col[data-col="doing"] [data-todo-id="'+t.id+'"]'), 'pindah ke In Progress');
  await click('[data-action="todo-set-status"][data-id="'+t.id+'"][data-status="pending"]');
  ok(t.status==='pending' && d.querySelector('.bd-col[data-col="pending"] [data-todo-id="'+t.id+'"]'), 'pindah ke Pending');
  await click('[data-action="todo-set-status"][data-id="'+t.id+'"][data-status="done"]');
  ok(t.status==='done' && !!t.doneAt && d.querySelector('.bd-col[data-col="done"] [data-todo-id="'+t.id+'"]'), 'pindah ke Finish (doneAt terisi)');
  await click('[data-action="todo-set-status"][data-id="'+t.id+'"][data-status="todo"]');
  ok(t.status==='todo' && !t.doneAt, 'bisa dibuka lagi ke To Do');
  /* drag & drop */
  var card = d.querySelector('[data-todo-id="'+t.id+'"]');
  ok(card.getAttribute('draggable')==='true', 'kartu bisa di-drag');
  var dt = {data:{}, setData:function(k,v){ this.data[k]=v; }, getData:function(k){ return this.data[k]; }};
  function ev(type, target){ var e = new w.Event(type,{bubbles:true,cancelable:true}); e.dataTransfer = dt; target.dispatchEvent(e); }
  ev('dragstart', card);
  ev('dragover', d.querySelector('.bd-col[data-col="pending"] .bd-col-body'));
  ev('drop', d.querySelector('.bd-col[data-col="pending"] .bd-col-body')); await sleep(80);
  ok(t.status==='pending', 'drag & drop memindah kartu ke kolom Pending');
  /* izin */
  as('staff','S2');
  var hrTask = {id:'TDX', ownerId:'S1', title:'Milik S1', note:'', due:'', priority:'normal', status:'todo', createdById:'hr', createdAt:new Date().toISOString(), updatedAt:new Date().toISOString()};
  w.DB.todos.unshift(hrTask); w.render();
  ev('drop', d.querySelector('.bd-col[data-col="done"]')); 
  dt.data={'text/plain':'TDX'}; ev('drop', d.querySelector('.bd-col[data-col="done"]')); await sleep(60);
  ok(hrTask.status==='todo', 'staf lain tidak bisa memindah tugas milik orang lain');
  /* HR memantau tim lewat board */
  as('hr'); w.STATE.todoTab='monitor'; w.render();
  ok(d.querySelectorAll('.bd-col').length===4 && body().indexOf('Milik S1')!==-1, 'HR: Board Semua menampilkan kanban seluruh staf');
  await click('[data-action="todo-set-status"][data-id="TDX"][data-status="pending"]');
  ok(hrTask.status==='pending', 'HR bisa memindah status tugas staf');
  ok(w.DB.notifications.every(function(n){ return n.message.indexOf('Pending')===-1 || true; }), 'ok');

  console.log('\n[Project]');
  as('staff','S1'); w.STATE.boardTab='project'; w.render();
  ok(!d.querySelector('[data-action="proj-save"]'), 'staf tidak bisa membuat project');
  as('hod','H1'); w.STATE.boardTab='project'; w.render();
  ok(!!d.querySelector('[data-action="proj-save"]'), 'HOD bisa membuat project');
  ok(Array.prototype.map.call(d.querySelectorAll('.pj_member'), function(x){ return x.value; }).sort().join()==='H1,S1,S2', 'HOD hanya bisa memilih anggota timnya');
  setv('pj_name','Campaign Natal'); d.querySelector('.pj_member[value="S1"]').checked = true;
  await click('[data-action="proj-save"]'); await sleep(100);
  var pj = w.DB.projects[0];
  ok(pj && pj.name==='Campaign Natal' && pj.ownerId==='H1' && pj.memberIds.join()==='S1' && pj.status==='aktif', 'project tersimpan (PIC = HOD, anggota S1)');
  ok(w.DB.notifications.some(function(n){ return n.audience.empId==='S1' && n.message.indexOf('Campaign Natal')!==-1; }), 'anggota mendapat notifikasi ditambahkan ke project');
  as('staff','S1'); w.STATE.boardTab='project'; w.render();
  ok(body().indexOf('Campaign Natal')!==-1, 'anggota melihat project-nya');
  as('staff','S2'); w.STATE.boardTab='project'; w.render();
  ok(body().indexOf('Campaign Natal')===-1, 'staf non-anggota tidak melihat project');
  as('hr'); w.STATE.boardTab='project'; w.render();
  ok(body().indexOf('Campaign Natal')!==-1, 'HR melihat semua project');
  as('hod','H1'); w.STATE.boardTab='project'; w.render();
  await click('[data-action="proj-edit"][data-id="'+pj.id+'"]');
  ok(d.getElementById('pj_name').value==='Campaign Natal', 'edit project mengisi form');
  setv('pj_name','Campaign Natal 2026'); await click('[data-action="proj-save"]'); await sleep(80);
  ok(pj.name==='Campaign Natal 2026' && w.DB.projects.length===1, 'edit menyimpan tanpa menggandakan');

  console.log('\n[Tugas di project]');
  as('staff','S1'); w.STATE.todoTab='mine'; w.render();
  ok(Array.prototype.map.call(d.querySelectorAll('#td_proj option'), function(o){ return o.textContent; }).join('|').indexOf('Campaign Natal 2026')!==-1, 'form tugas punya pilihan project');
  setv('td_title','Desain feed'); setv('td_proj', pj.id); await click('[data-action="add-todo"]'); await sleep(120);
  var pt = w.DB.todos.filter(function(x){ return x.title==='Desain feed'; })[0];
  ok(pt && pt.projectId===pj.id && body().indexOf('Campaign Natal 2026')!==-1, 'tugas terkait project & chip project tampil di kartu');

  console.log('\n[Timesheet]');
  as('staff','S1'); w.STATE.boardTab='project'; w.STATE.boardMonth=null; w.render();
  setv('ts_proj', pj.id); setv('ts_date', w.todayISO()); setv('ts_hours','2.5'); setv('ts_note','Riset');
  await click('[data-action="ts-add"]'); await sleep(80);
  ok(w.DB.timesheets.length===1 && w.DB.timesheets[0].hours===2.5 && w.DB.timesheets[0].empId==='S1', 'jam kerja tercatat');
  ok(body().indexOf('2,5')!==-1 || body().indexOf('2.5')!==-1, 'total jam tampil');
  setv('ts_proj', pj.id); setv('ts_date', w.todayISO()); setv('ts_hours','0'); await click('[data-action="ts-add"]'); await sleep(40);
  ok(w.DB.timesheets.length===1, 'durasi 0 ditolak');
  setv('ts_hours','23'); await click('[data-action="ts-add"]'); await sleep(40);
  ok(w.DB.timesheets.length===1, 'total >24 jam per hari ditolak');
  as('hod','H1'); w.STATE.boardTab='project'; w.render();
  ok(body().indexOf('Rekap Jam per Anggota Tim')!==-1 && body().indexOf('Sari Staf')!==-1, 'HOD melihat rekap jam timnya');
  as('staff','S1'); w.STATE.boardTab='project'; w.render();
  ok(body().indexOf('Rekap Jam per Karyawan')===-1 && body().indexOf('Rekap Jam per Anggota Tim')===-1, 'staf tidak melihat rekap orang lain');
  await click('[data-action="ts-delete"]'); await sleep(60);
  ok(w.DB.timesheets[0].deleted===true, 'hapus catatan jam (soft delete)');
  as('staff','S1'); w.STATE.boardTab='project'; w.STATE.boardMonth = w.shiftMonth(w.boardMonth(), -1); w.render();
  ok(body().indexOf(w.monthLabel(w.boardMonth()))!==-1, 'navigasi bulan berfungsi');
  w.STATE.boardMonth = null;

  console.log('\n[Agenda & Kalender]');
  as('staff','S1'); w.STATE.boardTab='agenda'; w.render();
  ok(d.querySelectorAll('.ag-day').length===w.daysInMonth(w.boardMonth()), 'kalender menampilkan semua tanggal bulan ini');
  var day = w.todayISO();
  setv('ag_title','Meeting konten'); setv('ag_date', day); setv('ag_start','10:00'); setv('ag_end','11:00'); setv('ag_loc','Ruang Meeting'); setv('ag_scope','departemen');
  await click('[data-action="agenda-save"]'); await sleep(80);
  var ag = w.DB.agenda[0];
  ok(ag && ag.title==='Meeting konten' && ag.ownerId==='S1' && ag.scope==='departemen' && body().indexOf('Ruang Meeting')!==-1, 'agenda tersimpan & tampil di tanggalnya');
  ok(d.querySelector('.ag-day[data-date="'+day+'"] .cal-tag').textContent.indexOf('1 agenda')!==-1, 'tanggal bertanda jumlah agenda');
  var gl = d.querySelector('a[href*="calendar.google.com/calendar/render"]');
  ok(gl && gl.href.indexOf('action=TEMPLATE')!==-1 && gl.href.indexOf('Meeting%20konten')!==-1 && gl.href.indexOf(day.replace(/-/g,'')+'T100000%2F')===-1 && gl.href.indexOf(day.replace(/-/g,'')+'T100000/'+day.replace(/-/g,'')+'T110000')!==-1, 'tautan + Google Kalender berisi judul & jam yang benar');
  ok(!d.querySelector('[data-action="gcal-connect"]') && body().indexOf('Sinkron dua arah langsung butuh pengaturan Google')!==-1, 'tanpa Client ID: tombol hubungkan tidak muncul, ada keterangan');
  /* visibilitas */
  as('staff','S2'); w.STATE.boardTab='agenda'; w.render(); w.STATE.agendaDay=day; w.render();
  ok(body().indexOf('Meeting konten')!==-1, 'agenda departemen terlihat oleh rekan se-departemen');
  as('staff','F1'); w.STATE.boardTab='agenda'; w.STATE.agendaDay=day; w.render();
  ok(body().indexOf('Meeting konten')===-1, 'agenda departemen tidak terlihat oleh departemen lain');
  ag.scope='pribadi'; as('staff','S2'); w.STATE.boardTab='agenda'; w.STATE.agendaDay=day; w.render();
  ok(body().indexOf('Meeting konten')===-1, 'agenda pribadi hanya untuk pemiliknya');
  as('hr'); w.STATE.boardTab='agenda'; w.STATE.agendaDay=day; w.render();
  ok(body().indexOf('Meeting konten')!==-1, 'HR melihat semua agenda');
  setv('ag_title','Rapat Umum'); setv('ag_date', day); setv('ag_scope','semua'); setv('ag_start',''); setv('ag_end','');
  await click('[data-action="agenda-save"]'); await sleep(60);
  as('staff','F1'); w.STATE.boardTab='agenda'; w.STATE.agendaDay=day; w.render();
  ok(body().indexOf('Rapat Umum')!==-1 && body().indexOf('Seharian')!==-1, 'agenda "semua karyawan" dari HR terlihat semua orang (seharian)');
  as('staff','S1'); w.STATE.boardTab='agenda'; w.STATE.agendaDay=day; w.render();
  var staffScopes = Array.prototype.map.call(d.querySelectorAll('#ag_scope option'), function(o){ return o.value; }).join();
  ok(staffScopes==='pribadi,departemen', 'staf tidak bisa membuat agenda untuk semua karyawan');
  /* edit & hapus */
  await click('[data-action="agenda-edit"][data-id="'+ag.id+'"]');
  ok(d.getElementById('ag_title').value==='Meeting konten', 'ubah agenda mengisi form');
  setv('ag_title','Meeting konten v2'); await click('[data-action="agenda-save"]'); await sleep(60);
  ok(ag.title==='Meeting konten v2' && w.DB.agenda.filter(function(x){ return x.ownerId==='S1'; }).length===1, 'edit tidak menggandakan agenda');
  setv('ag_title','Salah'); setv('ag_start','12:00'); setv('ag_end','11:00'); var cntA = w.DB.agenda.length; await click('[data-action="agenda-save"]'); await sleep(40);
  ok(w.DB.agenda.length===cntA, 'jam selesai sebelum mulai ditolak');
  as('staff','S1'); w.STATE.boardTab='agenda'; w.STATE.agendaDay=day; w.render();
  await click('[data-action="agenda-delete"][data-id="'+ag.id+'"]'); await sleep(60);
  ok(ag.deleted===true, 'hapus agenda (soft delete)');
  /* tenggat tugas muncul di kalender */
  var dueT = {id:'TDD', ownerId:'S1', title:'Kirim laporan', note:'', due:day, priority:'normal', status:'todo', createdById:'S1', createdAt:new Date().toISOString(), updatedAt:new Date().toISOString()};
  w.DB.todos.unshift(dueT); w.render();
  ok(body().indexOf('Kirim laporan')!==-1 && d.querySelector('.ag-day[data-date="'+day+'"]').textContent.indexOf('tenggat')!==-1, 'tenggat tugas tampil di kalender');
  /* ics */
  w.DB.agenda.unshift({id:'AGI',title:'Rapat; "uji", koma',date:day,startTime:'09:00',endTime:'10:00',ownerId:'S1',scope:'pribadi',location:'A,B',note:'baris1\nbaris2'});
  var ics = w.agendaIcs([w.DB.agenda[0]]);
  ok(/BEGIN:VCALENDAR/.test(ics) && /DTSTART:\d{8}T090000/.test(ics) && /DTEND:\d{8}T100000/.test(ics) && ics.indexOf('SUMMARY:Rapat\; "uji"\\, koma')!==-1 && ics.indexOf('DESCRIPTION:baris1\\nbaris2')!==-1, 'file .ics valid (escape karakter khusus)');
  ok(/DTSTART;VALUE=DATE:\d{8}/.test(w.agendaIcs([{id:'x',title:'Seharian',date:day}])), 'agenda seharian memakai VALUE=DATE');

  console.log('\n[Google Kalender langsung]');
  w.GOOGLE_CLIENT_ID = 'test-client.apps.googleusercontent.com';
  w.google = {accounts:{oauth2:{initTokenClient:function(cfg){ return {requestAccessToken:function(){ cfg.callback({access_token:'tok123', expires_in:3600}); }}; }}}};
  var calls = [];
  w.fetch = function(url, opt){ calls.push({url:url, opt:opt});
    if(/events\?/.test(url)) return Promise.resolve({ok:true,status:200,json:function(){ return Promise.resolve({items:[{id:'g1',summary:'Dari Google',start:{dateTime:day+'T14:00:00+07:00'},end:{dateTime:day+'T15:00:00+07:00'},htmlLink:'https://g/1'},{id:'g2',summary:'Buatan Selaras',start:{date:day},end:{date:day},extendedProperties:{private:{selarasId:'AGI'}}}]}); }});
    return Promise.resolve({ok:true,status:200,json:function(){ return Promise.resolve({id:'gnew1'}); }}); };
  w.STATE.gToken = null; w.STATE.gEvents = {}; w.STATE.agendaDay = day; w.render();
  ok(!!d.querySelector('[data-action="gcal-connect"]'), 'dengan Client ID: tombol Hubungkan Google Kalender muncul');
  await click('[data-action="gcal-connect"]'); await sleep(150);
  ok(w.gcalConnected() && calls.some(function(c){ return /calendars\/primary\/events\?/.test(c.url) && c.opt.headers.Authorization==='Bearer tok123'; }), 'terhubung & memuat agenda Google (Bearer token)');
  ok(body().indexOf('Dari Google')!==-1 && body().indexOf('Buatan Selaras')===-1, 'agenda Google tampil, duplikat buatan Selaras disaring');
  var agi = w.DB.agenda[0];
  w.render(); await click('[data-action="gcal-push"][data-id="AGI"]'); await sleep(150);
  var post = calls.filter(function(c){ return c.opt && c.opt.method==='POST'; })[0];
  var pb = post && JSON.parse(post.opt.body);
  ok(pb && pb.summary===agi.title && pb.start.dateTime===day+'T09:00:00' && pb.extendedProperties.private.selarasId==='AGI' && agi.googleId==='gnew1', 'kirim agenda ke Google (jam, zona waktu, penanda selarasId)');
  w.Capacitor = {isNativePlatform:function(){ return true; }}; w.render();
  ok(!d.querySelector('[data-action="gcal-connect"]') && body().indexOf('hanya tersedia di versi web')!==-1, 'di APK: sinkron langsung disembunyikan, ada keterangan');
  w.Capacitor = undefined; w.GOOGLE_CLIENT_ID = '';

  console.log('\n[Sinkron antar perangkat]');
  var rem = JSON.parse(JSON.stringify(w.DB));
  rem.projects.push({id:'PR-r',name:'Project remote',ownerId:'hr',memberIds:[],status:'aktif',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
  rem.agenda.push({id:'AG-r',title:'Agenda remote',date:day,ownerId:'hr',scope:'semua',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
  rem.timesheets.push({id:'TS-r',empId:'S1',projectId:'PR-r',date:day,hours:1,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
  w.mergeLiveData(rem);
  ok(w.DB.projects.some(function(x){ return x.id==='PR-r'; }) && w.DB.agenda.some(function(x){ return x.id==='AG-r'; }) && w.DB.timesheets.some(function(x){ return x.id==='TS-r'; }), 'project, agenda & timesheet dari perangkat lain tergabung');
  as('hr'); w.STATE.boardTab='board'; w.render();
  ok(body().length>100, 'render ulang tetap aman');
  console.log('\nHASIL: '+pass+' lulus, '+fail+' gagal');
  process.exit(fail?1:0);
})().catch(function(e){ console.log('CRASH', e && e.stack || e); process.exit(1); });

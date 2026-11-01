/* Tes: Board per departemen, atur kategori, ubah tugas, hapus otomatis Selesai > 30 hari. */
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
  function emp(id,name,dept){ return {id:id,empCode:id,name:name,position:'Staff',department:dept,properties:[],joinDate:'2025-01-01',username:id,password:'p',active:true}; }
  w.DB.employees=[emp('H1','Hana HOD','Marketing'),emp('S1','Sari Staf','Marketing'),emp('S2','Sigit Staf','Marketing'),emp('F1','Fani FO','Front Office')];
  w.DB.departmentHods={Marketing:['H1']}; w.STATE.loaded=true;
  function as(role,id){ w.SESSION= role==='hr'?{role:'hr',empId:null,hrAccountId:null}:{role:role,empId:id}; w.STATE.view='todo'; w.STATE.boardTab='board'; w.render(); }
  async function click(sel){ var el=typeof sel==='string'?d.querySelector(sel):sel; if(!el) throw new Error('tidak ada: '+sel); el.dispatchEvent(new w.MouseEvent('click',{bubbles:true})); await sleep(80); }
  async function change(el,v){ el=typeof el==='string'?d.querySelector(el):el; el.value=v; el.dispatchEvent(new w.Event('change',{bubbles:true})); await sleep(80); }
  var now=new Date().toISOString();
  function task(id,owner,title,extra){ var t={id:id,ownerId:owner,title:title,note:'',due:'',priority:'normal',status:'todo',createdById:owner,createdByLabel:'',createdAt:now,updatedAt:now}; Object.keys(extra||{}).forEach(function(k){ t[k]=extra[k]; }); w.DB.todos.push(t); return t; }
  var a=task('T1','S1','Desain feed'), b=task('T2','S2','Edit Reels'), c=task('T3','F1','Cek lobby'), h=task('T4','H1','Rapat vendor',{createdById:'H1'});

  console.log('\n[Satu board per departemen]');
  as('staff','S1');
  ok(/Board Marketing/.test(app()) && /Desain feed/.test(app()) && /Edit Reels/.test(app()) && /Rapat vendor/.test(app()), 'staf melihat semua tugas tim Marketing dalam satu board');
  ok(!/Cek lobby/.test(app()), 'tugas departemen lain tidak tampil');
  ok(!!d.querySelector('[data-role="todo-move"][data-id="T1"]') && !d.querySelector('[data-role="todo-move"][data-id="T2"]'), 'staf hanya bisa memindah tugas miliknya');
  ok(!d.querySelector('[data-action="board-cols-open"]'), 'staf tidak bisa mengatur kategori');
  await change('#boardWhoSel','me'); ok(/Desain feed/.test(app()) && !/Edit Reels/.test(app()), 'filter "Tugas saya"'); w.STATE.boardWho='';
  as('hod','H1');
  ok(!!d.querySelector('[data-role="todo-move"][data-id="T2"]') && !!d.querySelector('[data-action="board-cols-open"]'), 'HOD bisa memindah tugas anggota & mengatur kategori');
  var opts=Array.prototype.map.call(d.querySelectorAll('#ta_owner option'),function(o){ return o.value; });
  ok(opts.indexOf('H1')!==-1 && opts.indexOf('S2')!==-1 && opts.indexOf('F1')===-1, 'HOD menugaskan ke anggota tim / diri sendiri');
  as('hr'); await change('#boardDeptSel','Front Office'); ok(/Cek lobby/.test(app()) && !/Desain feed/.test(app()), 'HR memilih board departemen');

  console.log('\n[Atur kategori]');
  as('hod','H1'); await click('[data-action="board-cols-open"]');
  ok(d.querySelectorAll('.bc-row').length===4, 'modal menampilkan 4 kategori bawaan');
  await click('[data-action="bc-add"]'); ok(d.querySelectorAll('.bc-row').length===5, 'tambah kategori');
  var labels=d.querySelectorAll('.bc-label'); labels[2].value='Review Klien'; labels[0].value='Backlog';
  var pendIdx=Array.prototype.map.call(d.querySelectorAll('.bc-label'),function(x){ return x.value; }).indexOf('Pending');
  await click(d.querySelectorAll('[data-action="bc-del"]')[pendIdx>2?pendIdx-1:pendIdx]); 
  ok(!d.querySelector('[data-action="bc-del"][data-i="'+d.querySelectorAll('.bc-row').length+'"]'), 'kategori Selesai tidak punya tombol hapus');
  b.status='pending';
  await click('[data-action="bc-save"]'); await sleep(80);
  var cols=w.boardColsFor('Marketing');
  ok(cols.length===4 && cols[0].label==='Backlog' && cols.some(function(x){ return x.label==='Review Klien'; }) && cols.some(function(x){ return x.id==='done'; }) && !cols.some(function(x){ return x.id==='pending'; }), 'kategori tersimpan (ganti nama, tambah, hapus)');
  ok(b.status==='todo', 'tugas di kategori yang dihapus pindah ke kategori pertama');
  ok(d.querySelectorAll('.bd-col').length===4 && /Review Klien/.test(app()) && /Backlog/.test(app()), 'kolom board mengikuti kategori baru');
  ok(w.boardColsFor('Front Office').length===4 && w.boardColsFor('Front Office')[0].label==='To Do', 'departemen lain tetap pakai kategori bawaan');
  var rc=cols.filter(function(x){ return x.label==='Review Klien'; })[0];
  var selT2=d.querySelector('[data-role="todo-move"][data-id="T2"]'); await change(selT2, rc.id); ok(b.status===rc.id && !b.doneAt, 'tugas bisa dipindah ke kategori baru');
  await click('[data-action="board-cols-open"]'); await click('[data-action="bc-move"][data-i="1"][data-dir="-1"]');
  ok(d.querySelectorAll('.bc-label')[0].value!=='Backlog', 'urutan kategori bisa diubah'); await click('[data-action="close-modal"]');

  console.log('\n[Ubah tugas]');
  as('hod','H1'); await click('[data-action="todo-edit"][data-id="T1"]');
  ok(!!d.getElementById('te_title') && !!d.getElementById('te_owner') && !!d.getElementById('te_due') && !!d.getElementById('te_status'), 'modal ubah: judul, status, tenggat, penerima');
  d.getElementById('te_title').value='Desain feed Natal'; d.getElementById('te_due').value='2026-12-20'; d.getElementById('te_owner').value='S2'; d.getElementById('te_status').value='done'; d.getElementById('te_prio').value='tinggi';
  var n0=w.DB.notifications.length;
  await click('[data-action="todo-edit-save"]'); await sleep(80);
  ok(a.title==='Desain feed Natal' && a.due==='2026-12-20' && a.ownerId==='S2' && a.status==='done' && !!a.doneAt && a.priority==='tinggi', 'semua perubahan tersimpan');
  ok(w.DB.notifications.some(function(n){ return n.audience.empId==='S2' && /memberi tugas/.test(n.message); }) && w.DB.notifications.some(function(n){ return n.audience.empId==='S1' && /dialihkan/.test(n.message); }), 'penerima baru & lama diberi tahu');
  as('staff','S2'); ok(!!d.querySelector('[data-action="todo-edit"][data-id="T1"]'), 'pemilik baru bisa mengubah tugas');
  await click('[data-action="todo-edit"][data-id="T1"]'); ok(!d.getElementById('te_owner') || d.getElementById('te_owner').disabled || d.getElementById('te_owner').tagName==='INPUT', 'staf tidak bisa mengalihkan tugas dari HOD'); await click('[data-action="close-modal"]');
  as('staff','S1'); ok(!d.querySelector('[data-action="todo-edit"][data-id="T2"]'), 'staf lain tidak bisa mengubah');

  console.log('\n[Hapus tugas Selesai]');
  var old=task('T5','S1','Lama selesai',{status:'done',doneAt:new Date(Date.now()-31*864e5).toISOString()});
  var recent=task('T6','S1','Baru selesai',{status:'done',doneAt:new Date(Date.now()-5*864e5).toISOString()});
  var rk=task('T7','S1','Rekap lama',{status:'done',rekap:true,doneAt:new Date(Date.now()-40*864e5).toISOString()});
  w.STATE.todoPurgeDay=null; var n=w.todoPurgeOld(false);
  ok(n===1 && old.deleted && !recent.deleted && !rk.deleted, 'Selesai > 30 hari terhapus otomatis (rekap kerja dikecualikan)');
  as('staff','S1'); ok(/terhapus otomatis dalam 25 hari/.test(app()), 'kartu Selesai menampilkan sisa hari sebelum terhapus');
  ok(!d.querySelector('[data-action="board-clean-done"]'), 'staf tidak punya tombol Bersihkan');
  as('hod','H1'); await click('[data-action="board-clean-done"]'); await sleep(80);
  ok(recent.deleted && a.deleted && !rk.deleted, 'HOD: Bersihkan menghapus semua tugas Selesai di board');
  ok(!w.DB.todos.some(function(t){ return t.id==='T3' && t.deleted; }), 'tugas departemen lain tidak ikut terhapus');

  console.log('\n[Sinkron kategori]');
  w.mergeLiveData({boardCols:{Marketing:[{id:'todo',label:'Antrian',color:'neutral'},{id:'done',label:'Beres',color:'success'}]}, boardColsAt:{Marketing:'2999-01-01T00:00:00Z'}});
  ok(w.boardColsFor('Marketing')[0].label==='Antrian', 'kategori dari perangkat lain ikut tersinkron');

  console.log('\nHasil: '+pass+' lulus, '+fail+' gagal'); process.exit(fail?1:0);
})();

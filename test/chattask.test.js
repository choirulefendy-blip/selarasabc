/* Tes: tugas dilampirkan di chat (manual dari chat, dari kartu Board, otomatis saat menugaskan). */
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
  async function click(sel){ var el=typeof sel==='string'?d.querySelector(sel):sel; if(!el) throw new Error('tidak ada: '+sel); el.dispatchEvent(new w.MouseEvent('click',{bubbles:true})); await sleep(150); }
  function emp(id,name,dept){ return {id:id,empCode:id,name:name,position:'Staff',department:dept,properties:[],joinDate:'2025-01-01',active:true,username:id,password:'p'}; }
  w.DB.employees=[emp('H1','Hana HOD','Marketing'),emp('S1','Sari Staf','Marketing'),emp('S2','Sigit Staf','Marketing')];
  w.DB.departmentHods={Marketing:['H1']};
  function as(role,id,view){ w.SESSION={role:role,empId:id}; w.STATE.view=view; w.STATE.chatWith=null; w.render(); }
  var now=new Date().toISOString();
  w.DB.todos.push({id:'TK1',ownerId:'S1',title:'Desain feed Natal',note:'Pakai palet merah',due:'2026-12-20',priority:'tinggi',status:'doing',createdById:'H1',createdAt:now,updatedAt:now});

  console.log('\n[Manual dari chat]');
  as('staff','S1','chat'); w.chatEnsureIdentity(); w.STATE.chatWith='S2'; w.render();
  await click('[data-action="chat-attach"]');
  ok(!!d.querySelector('#modalRoot [data-action="chat-task-pick"]'), 'menu Lampirkan berisi "Tugas dari Selaras Board"');
  await click('#modalRoot [data-action="chat-task-pick"]');
  ok(/Desain feed Natal/.test(d.getElementById('modalRoot').textContent), 'daftar tugas Board muncul');
  await click('[data-action="chat-task-send"][data-tid="TK1"]'); await sleep(150);
  var m=w.CHAT.msgs.filter(function(x){ return x.kind==='task' && w.chatTaskId(x)==='TK1'; })[0];
  ok(m && m.recipient==='S2', 'tugas terkirim ke chat Sigit');
  w.render();
  var card=d.querySelector('.chat-taskcard');
  ok(card && /Desain feed Natal/.test(card.textContent) && /In Progress/.test(card.textContent) && /Tinggi/.test(card.textContent) && /20 Desember 2026/.test(card.textContent), 'kartu tugas: judul, status, prioritas, tenggat');
  ok(!/⁣/.test(d.querySelector('.chat-messages').textContent) && w.chatBodyText(m).indexOf('TASK')===-1, 'penanda tersembunyi tidak tampil');
  w.getTodoById('TK1').status='done'; w.render();
  ok(/Finish/.test(d.querySelector('.chat-taskcard').textContent), 'status kartu ikut terbaru dari Board');
  await click('.chat-taskcard [data-action="chat-task-open"]'); await sleep(200);
  ok(w.STATE.view==='todo' && w.STATE.boardTab==='board' && !!d.querySelector('.bd-card[data-todo-id="TK1"]'), '"Buka di Board" membuka board dan tugasnya');

  console.log('\n[Dari kartu Board]');
  as('staff','S1','todo'); w.STATE.boardTab='board'; w.render();
  await click('[data-action="todo-share"][data-id="TK1"]');
  var pick=d.querySelector('[data-role="fwd-pick"][value="H1"]'); ok(!!pick, 'pilih tujuan chat');
  pick.checked=true; pick.dispatchEvent(new w.Event('change',{bubbles:true}));
  d.getElementById('shareNote').value='Mohon dicek ya';
  await click('[data-action="todo-share-send"]'); await sleep(200);
  var m2=w.CHAT.msgs.filter(function(x){ return x.recipient==='H1' && w.chatTaskId(x)==='TK1'; })[0];
  ok(m2 && /Mohon dicek ya/.test(w.chatBodyText(m2)), 'terkirim ke HOD dengan pesan tambahan');

  console.log('\n[Otomatis dari Selaras Board]');
  as('hod','H1','todo'); w.STATE.boardTab='board'; w.render();
  d.getElementById('ta_owner').value='S2'; d.getElementById('ta_title').value='Rekap insight IG'; 
  await click('[data-action="assign-todo"]'); await sleep(300);
  var nt=w.DB.todos.filter(function(t){ return t.title==='Rekap insight IG'; })[0];
  var am=w.chatLocalAll().filter(function(x){ return x.recipient==='S2' && w.chatTaskId(x)===nt.id; })[0];
  ok(am && am.kind==='task', 'menugaskan lewat Board -> otomatis masuk chat penerima sebagai kartu tugas');
  w.todoApplyEdit(nt, {title:nt.title, ownerId:'S1', status:nt.status, priority:'normal', due:'', note:''}); await sleep(200);
  ok(w.chatLocalAll().some(function(x){ return x.recipient==='S1' && w.chatTaskId(x)===nt.id; }), 'tugas dialihkan -> otomatis dikirim ke penerima baru');
  nt.deleted=true; as('staff','S2','chat'); w.chatEnsureIdentity(); await w.chatPoll(); w.STATE.chatWith='H1'; w.render();
  ok(/sudah dihapus/.test(app()), 'tugas yang dihapus tampil keterangan "sudah dihapus"');
  console.log('\nHasil: '+pass+' lulus, '+fail+' gagal'); process.exit(fail?1:0);
})();

/* Tes Chat v3: grup, berkas, sematkan, arsip, kategori, centang dibaca, online. (mode lokal) */
var fs=require('fs'),path=require('path'),JSDOM=require('jsdom').JSDOM;
var html=fs.readFileSync(path.join(__dirname,'..','web','index.html'),'utf8')
  .replace(/var SUPABASE_URL = '[^']*'/,"var SUPABASE_URL = ''").replace(/var SUPABASE_ANON_KEY = '[^']*'/,"var SUPABASE_ANON_KEY = ''")
  .replace(/var PUSH_FUNCTION_URL = '[^']*'/,"var PUSH_FUNCTION_URL = ''");
var pass=0,fail=0; function ok(c,n){ if(c){pass++;console.log('  ok   - '+n);}else{fail++;console.log('  FAIL - '+n);} }
function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}
(async function(){
  var dom=new JSDOM(html,{url:'https://abc.test/',runScripts:'dangerously',pretendToBeVisual:true});
  var w=dom.window; w.console.error=function(){}; w.scrollTo=function(){}; w.confirm=function(){return true;}; await sleep(400);
  var d=w.document; function app(){ return d.getElementById('app').innerHTML; }
  function emp(id,name){ return {id:id,empCode:id,name:name,position:'Staff',department:'Marketing',properties:[],joinDate:'2025-01-01',baseSalary:1,active:true,username:id,password:'p'}; }
  w.DB.employees=[emp('A','Andi Satu'),emp('B','Budi Dua'),emp('C','Citra Tiga'),emp('D','Dewi Empat')];
  w.uploadAttachment=function(p,du){ return Promise.resolve({key:p,url:du}); };
  async function as(id){ w.SESSION={role:'staff',empId:id}; w.chatReset(); w.STATE.view='chat'; w.render(); await w.chatPoll(); w.render(); }
  async function click(sel){ var el=typeof sel==='string'?d.querySelector(sel):sel; if(!el) throw new Error('tidak ada: '+sel); el.dispatchEvent(new w.MouseEvent('click',{bubbles:true})); await sleep(80); }
  async function send(txt){ var i=d.getElementById('chatInput'); i.value=txt; i.dispatchEvent(new w.Event('input',{bubbles:true})); await sleep(420); await click('[data-action="chat-send"]'); await sleep(80); }

  console.log('\n[Grup]');
  await as('A'); await click('[data-action="chat-new"]');
  ok(!!d.querySelector('[data-action="chat-group-new"]'), '+ Baru: ada pilihan Buat grup');
  await click('[data-action="chat-group-new"]');
  d.getElementById('cg_name').value='Tim Marcomm';
  ['B','C'].forEach(function(x){ var cb=d.querySelector('#cgList input[value="'+x+'"]'); cb.checked=true; cb.dispatchEvent(new w.Event('change',{bubbles:true})); });
  await click('[data-action="chat-group-create"]'); await sleep(150);
  var g=w.DB.chatGroups[0];
  ok(g && g.name==='Tim Marcomm' && g.members.join()==='A,B,C' && g.admins[0]==='A', 'grup dibuat (pembuat = admin)');
  ok(w.STATE.chatWith==='g:'+g.id && /membuat grup/.test(app()), 'grup terbuka + pesan sistem "membuat grup"');
  await send('Halo tim!');
  ok(/Halo tim!/.test(app()), 'kirim pesan ke grup');
  await as('B'); ok(!!d.querySelector('.chat-item[data-peer="g:'+g.id+'"]') && w.chatUnreadFor('g:'+g.id)===1, 'anggota melihat grup + 1 belum dibaca');
  await click('.chat-item[data-peer="g:'+g.id+'"]'); ok(/Andi Satu/.test(d.querySelector('.chat-sender').textContent), 'nama pengirim tampil di pesan grup');
  await as('D'); ok(!d.querySelector('.chat-item[data-peer="g:'+g.id+'"]'), 'bukan anggota tidak melihat grup');
  await as('A'); w.STATE.chatWith='g:'+g.id; w.render(); await click('[data-action="chat-group-info"]');
  ok(/3 anggota/.test(d.getElementById('modalRoot').innerHTML), 'info grup: daftar anggota');
  await click('[data-action="chat-group-addopen"]'); var cbd=d.querySelector('#cgList input[value="D"]'); cbd.checked=true; cbd.dispatchEvent(new w.Event('change',{bubbles:true}));
  await click('[data-action="chat-group-add"]'); await sleep(100);
  ok(g.members.indexOf('D')!==-1, 'admin menambah anggota');

  console.log('\n[Sematkan, arsip, kategori]');
  await as('A'); w.STATE.chatWith='B'; w.render(); await send('Pesan pribadi ke Budi');
  w.STATE.chatWith='C'; w.render(); await send('Pesan ke Citra');
  w.STATE.chatWith='B'; w.render(); await click('[data-action="chat-pin"]');
  var items=Array.prototype.map.call(d.querySelectorAll('#chatList .chat-item'),function(x){return x.getAttribute('data-peer');});
  ok(items[0]==='B' && d.querySelector('.chat-item[data-peer="B"] .chat-pin'), 'chat disematkan ada di paling atas');
  w.STATE.chatWith='C'; w.render(); await click('[data-action="chat-archive"]');
  ok(!d.querySelector('#chatList .chat-item[data-peer="C"]') && !!d.querySelector('[data-action="chat-archived-open"]'), 'chat diarsipkan hilang dari daftar, muncul baris Diarsipkan');
  await as('C'); w.STATE.chatWith='A'; w.render(); await send('Balasan Citra');
  await as('A'); ok(!d.querySelector('#chatList .chat-item[data-peer="C"]') && w.chatUnreadTotal()===0, 'pesan baru tidak mengeluarkan dari arsip & tidak dihitung di badge');
  await click('[data-action="chat-archived-open"]'); ok(!!d.querySelector('#chatList .chat-item[data-peer="C"]'), 'buka daftar arsip');
  await click('[data-action="chat-archived-close"]');
  await click('[data-action="chat-tab"][data-tab="group"]'); var gi=Array.prototype.map.call(d.querySelectorAll('#chatList .chat-item'),function(x){return x.getAttribute('data-peer');}).filter(Boolean);
  ok(gi.length===1 && gi[0]==='g:'+g.id, 'tab Grup hanya menampilkan grup');
  await click('[data-action="chat-tab"][data-tab="personal"]'); ok(!d.querySelector('#chatList .chat-item[data-peer^="g:"]'), 'tab Pribadi tanpa grup');
  ok(w.CHAT.prefs.pinned.indexOf('B')!==-1 && JSON.parse(w.localStorage.getItem('abcChatPrefs_A')).archived.indexOf('C')!==-1, 'sematan & arsip tersimpan');

  console.log('\n[Berkas]');
  w.STATE.chatWith='B'; w.render();
  var inp=d.getElementById('chatImgFile'); var f=new w.File(['%PDF-1.4 tes'],'Laporan Oktober.pdf',{type:'application/pdf'});
  Object.defineProperty(inp,'files',{value:[f],configurable:true}); inp.dispatchEvent(new w.Event('change',{bubbles:true})); await sleep(150);
  ok(/Laporan Oktober\.pdf/.test(d.querySelector('.chat-pending').textContent), 'pratinjau berkas sebelum dikirim');
  await sleep(420); await click('[data-action="chat-send"]'); await sleep(150);
  var fm=w.CHAT.msgs[w.CHAT.msgs.length-1];
  ok(fm.file_name==='Laporan Oktober.pdf' && fm.file_type==='application/pdf' && fm.file_key && !!d.querySelector('.chat-file'), 'berkas terkirim & tampil sebagai kartu berkas');
  var big=new w.File(['x'],'video.mp4',{type:'video/mp4'}); Object.defineProperty(big,'size',{value:20*1024*1024});
  Object.defineProperty(inp,'files',{value:[big],configurable:true}); inp.dispatchEvent(new w.Event('change',{bubbles:true})); await sleep(80);
  ok(!d.querySelector('.chat-pending'), 'berkas > 15MB ditolak');

  console.log('\n[Centang & online]');
  var my=w.CHAT.msgs.filter(function(m){ return m.sender==='A' && m.recipient==='B'; })[0];
  w.CHAT.presence={}; w.CHAT.reads={};
  ok(w.chatTickState(my)===1, 'centang 1: terkirim');
  w.CHAT.presence.B=new Date(Date.now()+1000).toISOString(); ok(w.chatTickState(my)===2, 'centang 2: diterima (penerima online setelah pesan dikirim)');
  w.CHAT.reads['A|B']=my.id; ok(w.chatTickState(my)===3, 'centang biru: dibaca');
  w.STATE.chatWith='B'; w.render(); ok(!!d.querySelector('.chat-msg.mine .chat-tick.t3'), 'centang biru tampil di pesan');
  ok(w.chatOnline('B') && /online/.test(d.getElementById('chatHeadSub').textContent) && !!d.querySelector('.chat-online-dot'), 'status online + titik hijau');
  w.CHAT.presence.B=new Date(Date.now()-3600*1000).toISOString(); ok(/terakhir online (kemarin )?pukul \d\d:\d\d/.test(w.chatLastSeenLabel('B')), 'terakhir online');
  var gm=w.CHAT.msgs.filter(function(m){ return m.recipient==='g:'+g.id && m.kind==='msg'; })[0];
  w.CHAT.reads={}; w.CHAT.reads['g:'+g.id+'|B']=gm.id; ok(w.chatTickState(gm)!==3, 'grup: belum biru kalau belum semua membaca');
  ['C','D'].forEach(function(x){ w.CHAT.reads['g:'+g.id+'|'+x]=gm.id; }); ok(w.chatTickState(gm)===3, 'grup: biru kalau semua anggota sudah membaca');
  var sql=fs.readFileSync(path.join(__dirname,'..','supabase','chat.sql'),'utf8');
  ok(/create table if not exists chat_reads/.test(sql) && /chat_presence/.test(sql) && /chat_prefs/.test(sql) && /file_name/.test(sql), 'chat.sql memuat tabel & kolom baru');
  console.log('\n'+pass+' ok, '+fail+' gagal'); process.exit(fail?1:0);
})();

/* Tes: menu tahan/klik kanan, balas, teruskan, bintang, hapus untuk saya, simpan media, laman profil. */
var fs=require('fs'),path=require('path'),JSDOM=require('jsdom').JSDOM;
var html=fs.readFileSync(path.join(__dirname,'..','web','index.html'),'utf8')
  .replace(/var SUPABASE_URL = '[^']*'/,"var SUPABASE_URL = ''").replace(/var SUPABASE_ANON_KEY = '[^']*'/,"var SUPABASE_ANON_KEY = ''").replace(/var PUSH_FUNCTION_URL = '[^']*'/,"var PUSH_FUNCTION_URL = ''");
var pass=0,fail=0; function ok(c,n){ if(c){pass++;console.log('  ok   - '+n);}else{fail++;console.log('  FAIL - '+n);} }
function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}
(async function(){
  var dom=new JSDOM(html,{url:'https://abc.test/',runScripts:'dangerously',pretendToBeVisual:true});
  var w=dom.window; w.console.error=function(){}; w.scrollTo=function(){}; w.confirm=function(){return true;}; await sleep(400);
  var d=w.document; function app(){ return d.getElementById('app').innerHTML; } function modal(){ return d.getElementById('modalRoot').innerHTML; }
  function emp(id,name,pos){ return {id:id,empCode:'ABC-'+id,name:name,position:pos||'Staff',department:'Marketing',properties:['Kaly'],joinDate:'2025-01-01',baseSalary:1,active:true,username:id,password:'p',email:id.toLowerCase()+'@abc.id'}; }
  w.DB.employees=[emp('A','Andi Satu','Manager'),emp('B','Budi Dua'),emp('C','Citra Tiga')];
  w.uploadAttachment=function(p,du){ return Promise.resolve({key:p,url:du}); };
  async function as(id){ w.SESSION={role:'staff',empId:id}; w.chatReset(); w.STATE.view='chat'; w.render(); await w.chatPoll(); w.render(); }
  async function click(sel){ var el=typeof sel==='string'?d.querySelector(sel):sel; if(!el) throw new Error('tidak ada: '+sel); el.dispatchEvent(new w.MouseEvent('click',{bubbles:true})); await sleep(80); }
  async function send(txt){ var i=d.getElementById('chatInput'); i.value=txt; i.dispatchEvent(new w.Event('input',{bubbles:true})); await sleep(420); await click('[data-action="chat-send"]'); await sleep(80); }
  function ctx(el){ el.dispatchEvent(new w.MouseEvent('contextmenu',{bubbles:true,cancelable:true})); }

  await as('A'); w.STATE.chatWith='B'; w.render(); await send('Halo Budi, brief konten sudah?');
  await as('B'); w.STATE.chatWith='A'; w.render();
  console.log('\n[Menu pesan]');
  var bub=d.querySelector('.chat-msg.theirs .chat-bubble'); ctx(bub); await sleep(50);
  ok(/Balas/.test(modal()) && /Teruskan/.test(modal()) && /Beri bintang/.test(modal()) && /Hapus untuk saya/.test(modal()) && !/Hapus untuk semua/.test(modal()), 'klik kanan/tahan pesan orang lain: Balas, Teruskan, Bintang, Hapus untuk saya');
  await click('[data-action="chat-reply"]');
  ok(!!d.querySelector('.chat-replybar') && /Membalas Andi Satu/.test(d.querySelector('.chat-replybar').textContent), 'mode balas: kutipan muncul di atas kolom ketik');
  await send('Sudah, aku kirim sore ini');
  var rep=w.CHAT.msgs[w.CHAT.msgs.length-1]; var orig=w.CHAT.msgs.filter(function(m){return m.body.indexOf('Halo Budi')===0;})[0];
  ok(rep.ref_id===orig.id && !!d.querySelector('.chat-msg.mine .chat-quote') && !d.querySelector('.chat-replybar'), 'balasan tersimpan + kutipan tampil di gelembung');
  await click('.chat-msg.mine .chat-bubble'); ok(/Hapus untuk semua orang/.test(modal()), 'klik pesan sendiri: ada Hapus untuk semua orang');
  await click('[data-action="chat-star"]'); ok(w.chatIsStarred(rep.id) && /⭐/.test(d.querySelector('.chat-msg.mine .chat-msg-time').textContent), 'pesan berbintang ditandai ⭐');
  await click('[data-action="chat-starred"]'); ok(/Sudah, aku kirim sore ini/.test(modal()), 'daftar Pesan Berbintang');
  await click('[data-action="close-modal"]');
  ctx(d.querySelector('.chat-msg.theirs .chat-bubble')); await sleep(30); await click('[data-action="chat-forward"]');
  var cb=d.querySelector('#cgList input[value="C"]'); cb.checked=true; cb.dispatchEvent(new w.Event('change',{bubbles:true}));
  await click('[data-action="chat-forward-send"]'); await sleep(120);
  var fw=w.CHAT.msgs.filter(function(m){ return m.recipient==='C'; })[0];
  ok(fw && w.chatIsFwd(fw) && w.chatBodyText(fw)==='Halo Budi, brief konten sudah?', 'teruskan pesan ke chat lain');
  w.STATE.chatWith='C'; w.render(); ok(/Diteruskan/.test(app()) && !/⁣/.test(d.querySelector('.chat-text').textContent), 'label "Diteruskan" tanpa karakter penanda');
  w.STATE.chatWith='A'; w.render(); ctx(d.querySelector('.chat-msg.theirs .chat-bubble')); await sleep(30); await click('[data-action="chat-hide"]');
  ok(!Array.prototype.some.call(d.querySelectorAll('.chat-msg.theirs .chat-text'), function(x){ return /Halo Budi/.test(x.textContent); }), 'hapus untuk saya: hilang dari layar');
  await as('A'); w.STATE.chatWith='B'; w.render(); ok(/Halo Budi/.test(d.getElementById('chatMessages').innerHTML), 'lawan bicara tetap melihat pesannya');

  console.log('\n[Menu daftar chat]');
  ctx(d.querySelector('#chatList .chat-item[data-peer="B"]')); await sleep(30);
  ok(/Sematkan chat/.test(modal()) && /Arsipkan chat/.test(modal()) && /Hapus chat/.test(modal()) && /Lihat profil/.test(modal()), 'tahan/klik kanan chat: Sematkan, Arsipkan, Hapus, Lihat profil');
  await click('[data-action="chat-cm-pin"]'); ok(w.chatIsPinned('B'), 'sematkan dari menu');
  ctx(d.querySelector('#chatList .chat-item[data-peer="B"]')); await sleep(30); await click('[data-action="chat-cm-archive"]'); ok(w.chatIsArchived('B') && !w.chatIsPinned('B'), 'arsipkan dari menu');
  await click('[data-action="chat-archived-open"]'); ctx(d.querySelector('#chatList .chat-item[data-peer="B"]')); await sleep(30); await click('[data-action="chat-cm-clear"]');
  ok(!d.querySelector('#chatList .chat-item[data-peer="B"]'), 'hapus chat dari menu');

  console.log('\n[Profil & media]');
  await as('A'); w.STATE.chatWith='C'; w.render(); await send('tes');
  await click('.chat-head-main'); ok(w.STATE.view==='person' && /Citra Tiga/.test(app()) && /ABC-C/.test(app()) && /Kirim Pesan/.test(app()), 'klik profil di chat -> laman profil akun');
  await click('[data-action="person-chat"]'); ok(w.STATE.view==='chat' && w.STATE.chatWith==='C', 'tombol Kirim Pesan kembali ke chat');
  var saved=null; w.saveBlobAs=function(b,n){ saved=n; }; w.fetch=function(){ return Promise.resolve({ok:true,blob:function(){ return Promise.resolve(new w.Blob(['x'])); }}); };
  var im={id:999,sender:'C',recipient:'A',body:'',created_at:new Date().toISOString(),kind:'msg',file_key:'k',file_url:'data:application/pdf;base64,AA',file_name:'Brief.pdf'};
  w.chatSaveMedia(im); await sleep(80); ok(saved==='Brief.pdf', 'simpan berkas ke perangkat');
  w.openImageViewer('data:image/png;base64,iVBORw0KGgo='); ok(!!d.querySelector('[data-action="viewer-save"]'), 'tombol Simpan di tampilan foto');
  console.log('\n'+pass+' ok, '+fail+' gagal'); process.exit(fail?1:0);
})();

/* Tes: editor teks (format, sanitasi), penerbit SOP, persetujuan HR untuk SOP dari HOD, pengumuman berformat. */
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
  w.DB.employees=[emp('H1','Hana','Marketing'),emp('M1','Mira','Marketing')]; w.DB.departmentHods={Marketing:['H1']}; w.DB.sops=[]; w.DB.company.name='ABC Hospitality Group';

  console.log('\n[Sanitasi]');
  var dirty='<p onclick="x()"><b>Tebal</b> <i>miring</i> <u>garis</u><script>alert(1)</script><font size="5" color="#ff0000">Besar</font><img src="javascript:x"><img src="https://x.test/a.jpg" onerror="y"><a href="javascript:z">bad</a><a href="https://ok.test">ok</a><span style="color:red;position:fixed">w</span></p>';
  var c=w.rteSanitize(dirty);
  ok(/<b>Tebal<\/b>/.test(c) && /<i>miring<\/i>/.test(c) && /<u>garis<\/u>/.test(c), 'format tebal/miring/garis bawah tetap');
  ok(!/script|onclick|onerror|javascript/i.test(c), 'script & atribut berbahaya dibuang');
  ok(/font-size:x-large/.test(c) && /color:#ff0000/.test(c) && !/<font/i.test(c), 'ukuran & warna huruf dipertahankan (span)');
  ok((c.match(/<img/g)||[]).length===1 && /target="_blank"/.test(c) && !/position/.test(c), 'gambar aman saja, tautan dibuka di tab baru, style berbahaya dibuang');

  console.log('\n[SOP HR: penerbit]');
  w.SESSION={role:'hr',empId:null,hrAccountId:null}; w.STATE.view='sop'; w.render();
  ok(!!d.querySelector('.rte-bar [data-rte-cmd="bold"]') && !!d.querySelector('[data-rte-size="sop_rte"]') && !!d.querySelector('[data-rte-img="sop_rte"]') && !!d.querySelector('[data-rte-cmd="indent"]'), 'toolbar: tebal, ukuran, gambar, indentasi');
  d.getElementById('sop_title').value='SOP Kebersihan'; d.getElementById('sop_rte').innerHTML='<h2>Tujuan</h2><p><b>Penting:</b> cuci tangan</p><ul><li>Langkah 1</li></ul>';
  await click('[data-action="sop-add"]'); await sleep(150);
  var s1=w.DB.sops[0];
  ok(/<h2>Tujuan<\/h2>/.test(s1.descHtml) && /cuci tangan/.test(s1.desc), 'isi berformat tersimpan (HTML + teks polos)');
  w.render();
  ok(/Dibuat dan disetujui oleh HR Admin – ABC Hospitality Group/.test(app()), 'keterangan: Dibuat dan disetujui oleh HR Admin – ABC Hospitality Group');
  ok(!!d.querySelector('.rte-view h2') && !!d.querySelector('.rte-view ul li'), 'tampil berformat di daftar SOP');

  console.log('\n[SOP HOD: langsung terbit]');
  w.SESSION={role:'hod',empId:'H1'}; w.render();
  d.getElementById('sop_title').value='SOP Konten'; d.getElementById('sop_rte').innerHTML='Isi konten';
  await click('[data-action="sop-add"]'); await sleep(150);
  var s2=w.DB.sops[0]; w.render();
  ok(s2.issuer.role==='hod' && /Dibuat dan disetujui oleh HOD Marketing/.test(app()), 'keterangan: Dibuat dan disetujui oleh HOD Marketing');

  console.log('\n[SOP HOD: minta persetujuan HR]');
  w.DB.notifications=[];
  d.getElementById('sop_title').value='SOP Posting IG'; d.getElementById('sop_rte').innerHTML='Posting jam 19.00'; d.getElementById('sop_needhr').checked=true;
  await click('[data-action="sop-add"]'); await sleep(150);
  var s3=w.DB.sops[0];
  ok(s3.status==='pending' && !w.DB.notifications.some(function(n){ return n.audience.empId==='M1'; }) && w.DB.notifications.some(function(n){ return n.audience.type==='hr' && /menunggu persetujuan/.test(n.message); }), 'status menunggu, HR diberi tahu, staf belum');
  w.SESSION={role:'staff',empId:'M1'}; w.render(); ok(!/SOP Posting IG/.test(app()), 'staf belum melihat SOP yang menunggu');
  w.SESSION={role:'hr',empId:null,hrAccountId:null}; w.render();
  ok(/Menunggu Persetujuan HR \(1\)/.test(app()), 'HR melihat daftar Menunggu Persetujuan');
  await click('.sop-pend-card [data-action="sop-review"]');
  w.DB.settings=w.DB.settings||{}; w.DB.settings.approveVerify=false;
  await click('[data-action="sop-reject"]'); ok(s3.status==='pending', 'tolak tanpa alasan tidak diproses');
  d.getElementById('sop_rv_note').value='Tambahkan contoh caption'; await click('[data-action="sop-reject"]');
  ok(s3.status==='rejected' && w.DB.notifications.some(function(n){ return n.audience.empId==='H1' && /ditolak HR: Tambahkan contoh caption/.test(n.message); }), 'ditolak: HOD dapat alasan');
  w.SESSION={role:'hod',empId:'H1'}; w.render(); ok(/Ditolak HR: Tambahkan contoh caption/.test(app()), 'HOD melihat status ditolak');
  await click('[data-action="sop-edit"][data-id="'+s3.id+'"]');
  ok(d.getElementById('sope_needhr').checked, 'edit: opsi persetujuan HR tercentang');
  d.getElementById('sope_rte').innerHTML='Posting jam 19.00<br>Contoh caption: ...'; await click('[data-action="sop-save"]'); await sleep(150);
  ok(s3.status==='pending', 'diajukan ulang');
  w.SESSION={role:'hr',empId:null,hrAccountId:null}; w.render(); w.DB.notifications=[];
  await click('.sop-pend-card [data-action="sop-review"]'); await click('[data-action="sop-approve"]'); await sleep(100);
  ok(s3.status==='published' && w.DB.notifications.some(function(n){ return n.audience.empId==='M1' && /SOP baru/.test(n.message); }), 'disetujui: terbit, staf diberi tahu');
  w.render(); ok(/Dibuat oleh HOD Marketing · Disetujui oleh HR Admin – ABC Hospitality Group/.test(app()), 'keterangan: Dibuat oleh HOD Marketing · Disetujui oleh HR Admin');

  console.log('\n[Revisi lewat persetujuan HR]');
  w.SESSION={role:'hod',empId:'H1'}; w.render();
  await click('[data-action="sop-edit"][data-id="'+s2.id+'"]'); d.getElementById('sope_needhr').checked=true; d.getElementById('sope_rte').innerHTML='Isi konten v2'; await click('[data-action="sop-save"]'); await sleep(150);
  ok(s2.pendingRev && s2.pendingRev.status==='pending' && s2.version==='1.0' && /Isi konten$/.test(s2.desc), 'revisi menunggu, versi lama tetap tampil');
  w.SESSION={role:'hr',empId:null,hrAccountId:null}; w.render();
  await click('.sop-pend-card [data-action="sop-review"]'); await click('[data-action="sop-approve"]'); await sleep(100);
  ok(!s2.pendingRev && s2.version==='1.1' && /v2/.test(s2.desc) && s2.issuer.approvedByHr, 'revisi disetujui: versi 1.1 terbit');

  console.log('\n[Pengumuman berformat]');
  w.SESSION={role:'hr',empId:null,hrAccountId:null}; w.STATE.view='announcements'; w.render();
  ok(!!d.getElementById('ann_rte'), 'pengumuman pakai editor');
  d.getElementById('ann_title').value='Libur Nasional'; d.getElementById('ann_rte').innerHTML='<b>Kantor tutup</b> tanggal 25';
  await click('[data-action="submit-announcement"]'); await sleep(150);
  var an=w.DB.announcements[w.DB.announcements.length-1];
  ok(an && /<b>Kantor tutup<\/b>/.test(an.messageHtml) && /Kantor tutup tanggal 25/.test(an.message), 'pengumuman tersimpan berformat');
  w.SESSION={role:'staff',empId:'M1'}; w.render(); ok(!!d.querySelector('.rte-view b'), 'staf melihat pengumuman berformat');
  console.log('\nHasil: '+pass+' lulus, '+fail+' gagal'); process.exit(fail?1:0);
})();

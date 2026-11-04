/* Tes: artikel abchospitality.co.id (parser server + tampilan aplikasi). */
var fs=require('fs'),path=require('path'),JSDOM=require('jsdom').JSDOM;
var pass=0,fail=0; function ok(c,n){ if(c){pass++;console.log('  ok   - '+n);}else{fail++;console.log('  FAIL - '+n);} }
function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}
(async function(){
  var P=await import(path.join(__dirname,'..','scripts','fetch-articles.mjs'));
  var idx='<div><a href="/article/wfh-padi/" title="Work From Hotel di Padi"><img src="/_nuxt/img/wfh01.jpg" alt="wfh01"></a><h2><a href="https://abchospitality.co.id/article/wfh-padi/" title="Work From Hotel di Padi">Work From Hotel di Padi</a></h2><span>5 Aug 2026</span>'+
    '<a href="/article/bazaar-kopbra/"><div style="background-image:url(\'/img/b.jpg\')"></div></a><a href="/article/bazaar-kopbra/">Bazaar &amp; Kopi</a><a href="/about/">x</a></div>';
  var L=P.parseIndex(idx);
  ok(L.length===2 && L[0].url==='https://abchospitality.co.id/article/wfh-padi/', 'indeks: 2 artikel unik, urutan terjaga');
  ok(L[0].title==='Work From Hotel di Padi' && L[0].image==='https://abchospitality.co.id/_nuxt/img/wfh01.jpg', 'indeks: judul & gambar absolut');
  ok(L[1].title==='Bazaar & Kopi' && /b\.jpg$/.test(L[1].image), 'indeks: gambar background & entitas');
  var art='<head><meta property="og:title" content="Work From Hotel di Padi | ABC Hospitality Group"><meta property="og:image" content="https://cdn.x/wfh.jpg"><meta name="description" content="Ruang kerja bertemu sawah."></head><body><h1>WFH</h1><p>5 Aug 2026 · 6 minutes</p></body>';
  var A=P.parseArticle(art);
  ok(A.title==='Work From Hotel di Padi' && A.image==='https://cdn.x/wfh.jpg' && /^2026-08-05/.test(A.date) && /sawah/.test(A.excerpt), 'artikel: og meta + tanggal dari teks');
  ok(/^2026-12-01/.test(P.parseDateText('1 Desember 2026')), 'tanggal bahasa Indonesia');
  /* tampilan aplikasi */
  var html=fs.readFileSync(path.join(__dirname,'..','web','index.html'),'utf8').replace(/var SUPABASE_URL = '[^']*'/,"var SUPABASE_URL = ''").replace(/var SUPABASE_ANON_KEY = '[^']*'/,"var SUPABASE_ANON_KEY = ''").replace(/var PUSH_FUNCTION_URL = '[^']*'/,"var PUSH_FUNCTION_URL = ''");
  var dom=new JSDOM(html,{url:'https://abcselaras.my.id/web/',runScripts:'dangerously',pretendToBeVisual:true});
  var w=dom.window; w.console.error=function(){}; w.scrollTo=function(){}; await sleep(400);
  var d=w.document;
  w.fallbackGet=function(k){ return Promise.resolve(k==='articles'?{value:JSON.stringify({items:[{url:'https://abchospitality.co.id/article/wfh-padi/',title:'Work From Hotel di Padi',image:'https://cdn.x/wfh.jpg',date:'2026-08-05T05:00:00Z',excerpt:'Sawah'}]})}:null); };
  w.DB.employees=[{id:'S1',name:'Sari',department:'Marketing',active:true,username:'sari'}];
  w.SESSION={role:'staff',empId:'S1'}; w.STATE.view='dashboard'; w.render(); await sleep(80);
  var card=d.querySelector('.art-strip .art-card');
  ok(card && /Work From Hotel/.test(card.textContent) && card.getAttribute('target')==='_blank' && /wfh\.jpg/.test(card.innerHTML), 'dashboard: preview gambar + judul + link');
  ok(/Artikel/.test(d.querySelector('nav, .sidebar, #app').textContent), 'menu Artikel ada di sidebar');
  w.STATE.view='articles'; w.render();
  ok(d.querySelectorAll('.art-grid .art-card').length===1 && /5 Agustus 2026/.test(d.getElementById('app').textContent), 'halaman Artikel: kartu + tanggal');
  w.SESSION={role:'hr'}; w.STATE.view='dashboard'; w.render(); ok(d.querySelector('.art-strip'), 'dashboard HR juga tampil');
  /* Kelola artikel manual */
  w.fallbackGet=function(){ return Promise.resolve(null); }; w.ARTICLES.items=[]; w.ARTICLES.loadedAt=Date.now();
  w.DB.employees.push({id:'M1',name:'Fendy',department:'Marketing',active:true},{id:'K1',name:'Kasir',department:'Front Office',active:true});
  w.SESSION={role:'staff',empId:'K1'}; w.STATE.view='articles'; w.render();
  ok(!d.querySelector('[data-action="art-new"]'), 'staff non-Marketing tidak bisa kelola');
  w.SESSION={role:'staff',empId:'M1'}; w.render();
  d.querySelector('[data-action="art-new"]').click(); await sleep(20);
  d.getElementById('art_url').value='https://abchospitality.co.id/article/wfh/'; d.getElementById('art_title').value='WFH di Padi';
  d.getElementById('art_image').value='https://cdn.x/w.jpg'; d.getElementById('art_date').value='2026-11-01';
  d.querySelector('[data-action="art-save"]').click(); await sleep(80);
  ok(w.DB.articles.length===1 && d.querySelectorAll('.art-grid .art-card').length===1, 'Marketing menambah artikel');
  d.querySelector('[data-action="art-new"]').click(); await sleep(20);
  d.getElementById('art_url').value='https://abchospitality.co.id/article/wfh/'; d.getElementById('art_title').value='dup';
  d.querySelector('[data-action="art-save"]').click(); await sleep(50);
  ok(w.DB.articles.length===1, 'link ganda ditolak'); w.closeModal();
  w.SESSION={role:'staff',empId:'K1'}; w.STATE.view='dashboard'; w.render();
  ok(/WFH di Padi/.test(d.querySelector('.art-strip').textContent), 'artikel manual tampil di dashboard staff');
  w.SESSION={role:'hr'}; w.STATE.view='articles'; w.render(); w.confirm=function(){return true;};
  d.querySelector('[data-action="art-edit"]').click(); await sleep(20);
  d.getElementById('art_title').value='WFH di Padi Heritage'; d.querySelector('[data-action="art-save"]').click(); await sleep(50);
  ok(w.DB.articles[0].title==='WFH di Padi Heritage', 'HR mengedit artikel');
  d.querySelector('[data-action="art-del"]').click(); await sleep(50);
  ok(!d.querySelector('.art-grid'), 'HR menghapus artikel');
  w.mergeLiveData({articles:[{id:w.DB.articles[0].id,url:'x',title:'old',updatedAt:'2000-01-01'}]});
  ok(w.DB.articles[0].deleted===true, 'hapus tersinkron (salinan lama tidak menghidupkan)');
  console.log('\n'+pass+' lulus, '+fail+' gagal'); process.exit(fail?1:0);
})();

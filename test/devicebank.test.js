/* Tes: batas perangkat login, bank soal Selaras Test + skor, menu Performance Review. */
var fs=require('fs'),path=require('path'),JSDOM=require('jsdom').JSDOM;
var html=fs.readFileSync(path.join(__dirname,'..','web','index.html'),'utf8')
  .replace(/var SUPABASE_URL = '[^']*'/,"var SUPABASE_URL = ''").replace(/var SUPABASE_ANON_KEY = '[^']*'/,"var SUPABASE_ANON_KEY = ''").replace(/var PUSH_FUNCTION_URL = '[^']*'/,"var PUSH_FUNCTION_URL = ''");
var pass=0,fail=0; function ok(c,n){ if(c){pass++;console.log('  ok   - '+n);}else{fail++;console.log('  FAIL - '+n);} }
function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}
function click(w,sel){ var el=typeof sel==='string'?w.document.querySelector(sel):sel; if(!el) throw new Error('tidak ada: '+sel); el.dispatchEvent(new w.MouseEvent('click',{bubbles:true})); }
(async function(){
  var dom=new JSDOM(html,{url:'https://abcselaras.my.id/web/',runScripts:'dangerously',pretendToBeVisual:true});
  var w=dom.window; w.console.error=function(){}; w.scrollTo=function(){}; w.confirm=function(){return true;}; await sleep(400);
  var d=w.document;
  w.DB.departmentHods={Marketing:['H1']};
  w.DB.employees=[
    {id:'S1',name:'Sari Ayu',username:'sari',password:'p',active:true,department:'Marketing',position:'Content'},
    {id:'H1',name:'Budi',username:'budi',password:'p',active:true,department:'Marketing',position:'Manager'}
  ];
  w.DB.settings=w.DB.settings||{};
  w.storageGet=function(){ return Promise.resolve({value:JSON.stringify(w.DB)}); };
  w.saveDB=function(){ return Promise.resolve(true); };

  console.log('\n[Batas perangkat login]');
  var cls=w.deviceCurrentClass(); var other=(cls==='mobile'?'desktop':'mobile');
  w.DB.loginDevices={};
  ok(w.deviceLoginGate('S1').ok===true, 'perangkat pertama (belum ada) boleh langsung login');
  // seed 1 approved same-class device
  w.DB.loginDevices={'emp:S1':{A:{label:'HP Lama',cls:cls,status:'approved',loginAt:'2026-01-01T00:00:00Z',lastAt:'2026-01-01T00:00:00Z'}}};
  ok(w.deviceLoginGate('S1').ok===false, 'perangkat ke-2 sejenis ('+cls+') perlu persetujuan HR');
  // seed 1 approved other-class device -> allowed (1 HP + 1 PC)
  w.DB.loginDevices={'emp:S1':{A:{label:'Perangkat lain',cls:other,status:'approved',loginAt:'2026-01-01T00:00:00Z',lastAt:'2026-01-01T00:00:00Z'}}};
  ok(w.deviceLoginGate('S1').ok===true, 'perangkat jenis berbeda boleh (1 HP + 1 PC)');
  // 1 of each -> third blocked
  w.DB.loginDevices={'emp:S1':{A:{label:'HP',cls:'mobile',status:'approved',loginAt:'x',lastAt:'x'},B:{label:'PC',cls:'desktop',status:'approved',loginAt:'x',lastAt:'x'}}};
  ok(w.deviceLoginGate('S1').ok===false, 'perangkat ke-3 selalu perlu persetujuan');
  // HR approve a pending device -> old same-class revoked
  w.DB.loginDevices={'emp:S1':{A:{label:'HP Lama',cls:'mobile',status:'approved',loginAt:'x',lastAt:'x'},C:{label:'HP Baru',cls:'mobile',status:'pending',requestedAt:'y',loginAt:'y',lastAt:'y'}}};
  w.SESSION={role:'hr'};
  var pend=w.pendingDeviceRequests();
  ok(pend.length===1 && pend[0].empId==='S1', 'HR melihat 1 permintaan perangkat');
  var ab=d.createElement('button'); ab.setAttribute('data-action','device-approve'); ab.setAttribute('data-key','emp:S1'); ab.setAttribute('data-id','C'); d.body.appendChild(ab);
  click(w, ab); await sleep(40);
  var mp=w.DB.loginDevices['emp:S1'];
  ok(mp.C.status==='approved' && mp.A.revokedAt, 'menyetujui HP baru -> HP lama sejenis dikeluarkan');

  console.log('\n[Bank soal Selaras Test + skor]');
  w.SESSION={role:'hr',empId:null};
  w.STATE.recruitEdit={id:null,title:'Rekrut Cook',positionKey:'cook',position:'Chef / Cook / Dapur',intro:'',interview:{date:'2026-12-01',address:'Batu'},sections:{psikotest:true,iq:true,online:true}};
  w.openModal(w.recruitTestModalHtml());
  d.getElementById('rkt_title').value='Rekrut Cook';
  var sb=d.createElement('button'); sb.setAttribute('data-action','recruit-save-test'); d.body.appendChild(sb);
  click(w, sb); await sleep(40);
  var test=(w.DB.recruitTests||[])[0];
  var expLen=w.RECRUIT_BANK.psikotest.length+w.RECRUIT_BANK.iq.length+w.RECRUIT_BANK.online.cook.length;
  ok(test && test.questions.length===expLen && !test.questions.some(function(q){return !q.q;}), 'soal otomatis dari bank ('+expLen+' soal), HR tidak menulis soal');
  // simulate a perfect submission -> scores incl psikotest
  var ans={}; test.questions.forEach(function(q){ if(q.type==='scale') ans[q.id]='5'; else ans[q.id]=String(q.correct); });
  var sc=w.recruitScores(test, ans);
  ok(sc.iq && sc.iq.pct===100 && sc.online && sc.online.pct===100, 'skor IQ & Online 100% untuk jawaban benar semua');
  ok(sc.psikotest && sc.psikotest.pct===100, 'psikotest menghasilkan skor (indeks)');

  console.log('\n[Menu Performance Review staff/HOD]');
  w.DB.perfCycles=[{id:'PC1',title:'Review 2026',period:'2026-11',active:true,createdAt:'z'}];
  w.SESSION={role:'staff',empId:'S1'}; w.STATE.view='perf-me'; w.render(); await sleep(20);
  ok(/Performance Review/.test(d.getElementById('app').textContent) && d.querySelector('[data-action="perf-open"][data-id="H1"]'), 'menu Performance Review staff menampilkan HOD untuk dinilai');
  w.DB.perfCycles=[]; w.STATE.view='perf-me'; w.render(); await sleep(20);
  ok(/Belum ada Performance Review/.test(d.getElementById('app').textContent), 'tanpa siklus aktif, halaman memberi info');

  console.log('\nHASIL: '+pass+' lulus, '+fail+' gagal');
  process.exit(fail?1:0);
})().catch(function(e){ console.error(e); process.exit(1); });

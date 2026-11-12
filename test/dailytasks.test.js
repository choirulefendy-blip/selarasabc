/* Tes: fitur Tugas Harian per departemen + quick access. */
var fs=require('fs'),path=require('path'),JSDOM=require('jsdom').JSDOM;
var html=fs.readFileSync(path.join(__dirname,'..','web','index.html'),'utf8')
  .replace(/var SUPABASE_URL = '[^']*'/,"var SUPABASE_URL = ''").replace(/var SUPABASE_ANON_KEY = '[^']*'/,"var SUPABASE_ANON_KEY = ''").replace(/var PUSH_FUNCTION_URL = '[^']*'/,"var PUSH_FUNCTION_URL = ''");
var pass=0,fail=0; function ok(c,n){ if(c){pass++;console.log('  ok   - '+n);}else{fail++;console.log('  FAIL - '+n);} }
function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}
function click(w,sel){ var el=typeof sel==='string'?w.document.querySelector(sel):sel; if(!el) throw new Error('tidak ada: '+sel); el.dispatchEvent(new w.MouseEvent('click',{bubbles:true})); }
(async function(){
  var dom=new JSDOM(html,{url:'https://abcselaras.my.id/web/',runScripts:'dangerously',pretendToBeVisual:true});
  var w=dom.window; w.console.error=function(){}; w.scrollTo=function(){}; await sleep(400);
  var d=w.document;
  w.storageGet=function(){ return Promise.resolve({value:JSON.stringify(w.DB)}); };
  w.saveDB=function(){ return Promise.resolve(true); };
  w.DB.departmentHods={'Marketing Communication':['H1']};
  w.DB.employees=[
    {id:'S1',name:'Sari',username:'sari',active:true,department:'Marketing',position:'Content'},
    {id:'S2',name:'Rudi',username:'rudi',active:true,department:'Front Office',position:'Receptionist'},
    {id:'H1',name:'Budi',username:'budi',active:true,department:'Marketing Communication',position:'Manager'}
  ];

  console.log('\n[Seed & resolusi departemen]');
  ok(Object.keys(w.DB.dailyTasks).length>=10, 'template tugas harian 10 departemen ter-seed');
  ok(w.resolveDailyDept('Marketing')==='Marketing Communication', 'alias "Marketing" -> Marketing Communication');
  ok(w.resolveDailyDept('Front Office')==='Front Office', 'Front Office cocok langsung');
  ok(w.resolveDailyDept('Satpam')===null, 'departemen tak dikenal -> null');

  console.log('\n[Halaman staff & centang]');
  w.SESSION={role:'staff',empId:'S1'}; w.STATE.view='daily-tasks'; w.render(); await sleep(20);
  var items=w.dailyItemsFor('Marketing'); 
  ok(items.length>0 && d.querySelectorAll('.dt-row').length===items.length, 'checklist menampilkan semua tugas departemen');
  var p0=w.dailyProgress('S1', w.todayISO(), 'Marketing');
  ok(p0.done===0, 'awalnya 0 tugas selesai');
  click(w, d.querySelector('.dt-row')); await sleep(30);
  var p1=w.dailyProgress('S1', w.todayISO(), 'Marketing');
  ok(p1.done===1, 'mencentang 1 tugas tersimpan');
  // toggle off
  click(w, d.querySelector('.dt-row')); await sleep(30);
  ok(w.dailyProgress('S1', w.todayISO(), 'Marketing').done===0, 'mencentang ulang membatalkan (bisa uncheck)');

  console.log('\n[Quick access beranda]');
  w.STATE.view='dashboard'; w.render(); await sleep(20);
  ok(!!d.querySelector('.daily-quick[data-view="daily-tasks"]'), 'kartu quick access Tugas Harian tampil di beranda staff');

  console.log('\n[Reset harian]');
  w.DB.dailyTaskChecks={S1:{'2020-01-01':{done:{x:true},at:'t'}}};
  ok(w.dailyProgress('S1', w.todayISO(), 'Marketing').done===0, 'centang hari lain tidak terbawa ke hari ini');

  console.log('\n[HR kelola template]');
  w.SESSION={role:'hr',empId:null}; w.STATE.view='daily-tasks'; w.render(); await sleep(20);
  ok(/Marketing Communication/.test(d.getElementById('app').textContent) && d.querySelector('[data-action="dt-edit"]'), 'HR melihat daftar departemen & tombol edit');
  var before=w.DB.dailyTasks['Front Office'].items.length;
  w.openModal(w.dailyEditModalHtml('Front Office'));
  d.getElementById('dti_desc').value='Cek kelengkapan brosur di lobi';
  var ab=d.createElement('button'); ab.setAttribute('data-action','dt-add-item'); ab.setAttribute('data-dept','Front Office'); d.body.appendChild(ab);
  click(w, ab); await sleep(40);
  ok(w.DB.dailyTasks['Front Office'].items.length===before+1, 'HR bisa menambah tugas ke departemen');

  console.log('\nHASIL: '+pass+' lulus, '+fail+' gagal');
  process.exit(fail?1:0);
})().catch(function(e){ console.error(e); process.exit(1); });

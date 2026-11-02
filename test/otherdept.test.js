/* Tes: HOD melihat jadwal departemen lain (bulan berjalan, hanya baca). */
var fs=require('fs'),path=require('path'),JSDOM=require('jsdom').JSDOM;
var html=fs.readFileSync(path.join(__dirname,'..','web','index.html'),'utf8')
  .replace(/var SUPABASE_URL = '[^']*'/,"var SUPABASE_URL = ''").replace(/var SUPABASE_ANON_KEY = '[^']*'/,"var SUPABASE_ANON_KEY = ''")
  .replace(/var PUSH_FUNCTION_URL = '[^']*'/,"var PUSH_FUNCTION_URL = ''").replace(/var EMAIL_FUNCTION_URL = '[^']*'/,"var EMAIL_FUNCTION_URL = ''");
var pass=0,fail=0; function ok(c,n){ if(c){pass++;console.log('  ok   - '+n);}else{fail++;console.log('  FAIL - '+n);} }
function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}
(async function(){
  var dom=new JSDOM(html,{url:'https://abc.test/',runScripts:'dangerously',pretendToBeVisual:true});
  var w=dom.window; w.console.error=function(){}; w.scrollTo=function(){}; await sleep(400);
  var d=w.document;
  function emp(id,name,dept){ return {id:id,empCode:id,name:name,position:'Staff',department:dept,properties:[],joinDate:'2025-01-01',active:true,username:id,password:'p'}; }
  w.DB.employees=[emp('H1','Hana HOD','Marketing'),emp('M1','Mira','Marketing'),emp('F1','Fani FO','Front Office'),emp('K1','Koki Andi','Kitchen')];
  w.DB.departmentHods={Marketing:['H1']};
  var t=w.todayParts(); w.DB.schedules[t.ym]=w.DB.schedules[t.ym]||{};
  w.DB.schedules[t.ym].F1={}; w.DB.schedules[t.ym].F1[t.day]={type:'kerja',start:'07:00',end:'15:00'}; w.DB.schedules[t.ym].F1[(t.day%27)+1]={type:'libur',cuti:true};
  var prev=w.shiftMonth(t.ym,-1); w.STATE.currentMonth=prev;
  w.SESSION={role:'hod',empId:'H1'}; w.STATE.view='schedule'; w.render();
  var sel=d.getElementById('otherSchedDept');
  ok(!!sel && Array.prototype.map.call(sel.options,function(o){ return o.value; }).indexOf('Marketing')===-1, 'HOD melihat pilihan departemen lain (tanpa departemennya sendiri)');
  sel.value='Front Office'; sel.dispatchEvent(new w.Event('change',{bubbles:true})); await sleep(60);
  var card=d.getElementById('otherSchedDept').closest('.card');
  ok(new RegExp(w.monthLabel(t.ym)).test(card.textContent), 'selalu bulan berjalan walau kalender tim sedang bulan lain');
  ok(/Fani FO/.test(card.textContent) && card.querySelector('td.osd-kerja.osd-today') && /07/.test(card.querySelector('td.osd-kerja.osd-today').textContent), 'jadwal Fani hari ini (07) tampil & disorot');
  ok(!!card.querySelector('td.osd-cuti') && /1 dari 1 orang Front Office masuk/.test(card.textContent), 'cuti ditandai C + ringkasan hari ini');
  ok(!card.querySelector('[data-action]'), 'hanya bisa dilihat (tidak ada tombol ubah)');
  console.log('\nHasil: '+pass+' lulus, '+fail+' gagal'); process.exit(fail?1:0);
})();

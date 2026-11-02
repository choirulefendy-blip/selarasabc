/* Tes: tampilan Tabel di pengaturan jadwal tim. */
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
  async function click(sel){ var el=typeof sel==='string'?d.querySelector(sel):sel; if(!el) throw new Error('tidak ada: '+sel); el.dispatchEvent(new w.MouseEvent('click',{bubbles:true})); await sleep(100); }
  function emp(id,name){ return {id:id,empCode:id,name:name,position:'Staff',department:'Marketing',properties:[],joinDate:'2025-01-01',active:true,username:id,password:'p'}; }
  w.DB.employees=[emp('H1','Hana'),emp('M1','Mira'),emp('M2','Mega')]; w.DB.departmentHods={Marketing:['H1']};
  var ym=w.todayParts().ym; w.STATE.currentMonth=ym; w.DB.schedules[ym]={M1:{5:{type:'kerja',start:'14:00',end:'22:00'}},M2:{5:{type:'libur'}}};
  w.SESSION={role:'hod',empId:'H1'}; w.STATE.view='schedule'; w.render();
  ok(!!d.querySelector('[data-action="sched-view"][data-v="list"]') && !!d.querySelector('.cal-grid'), 'default Kalender + tombol Tabel');
  await click('[data-action="sched-view"][data-v="list"]');
  ok(!!d.getElementById('teamRosterWrap') && !d.querySelector('.card .cal-grid [data-action="open-date-schedule-editor"]'), 'tampilan Tabel aktif');
  ok(d.querySelectorAll('#teamRosterWrap tbody tr').length===3 && /14/.test(d.querySelector('#teamRosterWrap td[data-emp="M1"][data-day="5"]').textContent) && d.querySelector('#teamRosterWrap td[data-emp="M2"][data-day="5"]').classList.contains('osd-libur'), 'baris per orang: jam masuk & L');
  await click('#teamRosterWrap td[data-emp="M1"][data-day="5"]');
  ok(d.getElementById('dse_emp_M1').checked && !d.getElementById('dse_emp_M2').checked && !d.getElementById('dse_emp_H1').checked, 'ketuk sel: editor hanya untuk orang itu');
  ok(d.getElementById('dse_type').value==='kerja' && d.getElementById('dse_start').value==='14:00', 'editor terisi jadwal saat ini');
  d.getElementById('dse_type').value='izin'; await click('[data-action="apply-date-schedule"]');
  ok(w.DB.schedules[ym].M1[5].leave==='izin' && w.DB.schedules[ym].M2[5].type==='libur', 'hanya Mira yang berubah (Izin)');
  ok(d.querySelector('#teamRosterWrap td[data-emp="M1"][data-day="5"]').classList.contains('osd-sakit'), 'tabel diperbarui (oranye)');
  await click('#teamRosterWrap th[data-day="7"]');
  ok(d.getElementById('dse_selectAll').checked && d.getElementById('dse_emp_M2').checked, 'ketuk tanggal di header: atur seluruh tim');
  w.closeModal(); w.STATE.schedView=null; w.render(); ok(!!d.getElementById('teamRosterWrap'), 'pilihan tampilan diingat');
  console.log('\nHasil: '+pass+' lulus, '+fail+' gagal'); process.exit(fail?1:0);
})();

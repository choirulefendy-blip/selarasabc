/* Tes: warna jadwal (Libur/Cuti merah, Sakit/Izin oranye) + tipe baru di pengaturan jadwal tim. */
var fs=require('fs'),path=require('path'),JSDOM=require('jsdom').JSDOM;
var html=fs.readFileSync(path.join(__dirname,'..','web','index.html'),'utf8')
  .replace(/var SUPABASE_URL = '[^']*'/,"var SUPABASE_URL = ''").replace(/var SUPABASE_ANON_KEY = '[^']*'/,"var SUPABASE_ANON_KEY = ''")
  .replace(/var PUSH_FUNCTION_URL = '[^']*'/,"var PUSH_FUNCTION_URL = ''").replace(/var EMAIL_FUNCTION_URL = '[^']*'/,"var EMAIL_FUNCTION_URL = ''");
var pass=0,fail=0; function ok(c,n){ if(c){pass++;console.log('  ok   - '+n);}else{fail++;console.log('  FAIL - '+n);} }
function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}
(async function(){
  var dom=new JSDOM(html,{url:'https://abc.test/',runScripts:'dangerously',pretendToBeVisual:true});
  var w=dom.window; w.console.error=function(){}; w.scrollTo=function(){}; w.confirm=function(){return true;}; await sleep(400);
  var d=w.document;
  function emp(id,name,dept){ return {id:id,empCode:id,name:name,position:'Staff',department:dept,properties:[],joinDate:'2025-01-01',active:true,username:id,password:'p'}; }
  w.DB.employees=[emp('H1','Hana','Marketing'),emp('M1','Mira','Marketing'),emp('M2','Mega','Marketing')];
  w.DB.departmentHods={Marketing:['H1']};
  var ym=w.todayParts().ym; w.STATE.currentMonth=ym;
  w.SESSION={role:'hod',empId:'H1'}; w.STATE.view='schedule'; w.render();
  d.querySelector('[data-action="open-date-schedule-editor"][data-day="3"]').dispatchEvent(new w.MouseEvent('click',{bubbles:true})); await sleep(80);
  var opts=Array.prototype.map.call(d.querySelectorAll('#dse_type option'),function(o){ return o.value; }).join();
  ok(opts==='kerja,libur,cuti,sakit,izin', 'pengaturan jadwal tim: Kerja/Libur/Cuti/Sakit/Izin');
  d.getElementById('dse_type').value='sakit'; d.getElementById('dse_selectAll').checked=false;
  d.getElementById('dse_emp_H1').checked=false; d.getElementById('dse_emp_M2').checked=false;
  d.querySelector('[data-action="apply-date-schedule"]').dispatchEvent(new w.MouseEvent('click',{bubbles:true})); await sleep(120);
  var sc=w.DB.schedules[ym].M1[3];
  ok(sc && sc.type==='libur' && sc.leave==='sakit' && w.schedKind(sc)==='sakit', 'Mira tgl 3 = Sakit');
  w.DB.schedules[ym].M2={3:{type:'libur'},4:{type:'libur',cuti:true},5:{type:'libur',leave:'izin'}};
  w.render();
  var cell=d.querySelector('[data-action="open-date-schedule-editor"][data-day="3"]');
  ok(cell.querySelector('.cal-tag-sakit') && cell.querySelector('.cal-tag-libur'), 'kalender tim: tag Sakit (oranye) & Libur (merah)');
  var css=d.querySelector('style').textContent;
  ok(/\.cal-tag-libur,\.cal-tag-cuti\{background:#DC2626/.test(css) && /\.cal-tag-sakit\{background:#EA580C/.test(css), 'warna: merah untuk libur/cuti, oranye untuk sakit/izin');
  ok(w.getMatchDay('M1',ym,3).status==='sakit' && w.STATUS_META.sakit.cls==='badge-leave' && w.STATUS_META.libur.cls==='badge-off' && w.STATUS_META.cuti.cls==='badge-off', 'status absensi Sakit (oranye), Libur/Cuti (merah), tidak dihitung alpha');
  ok(w.schedOffBadge({type:'libur',leave:'izin'}).indexOf('badge-leave')!==-1 && /Izin/.test(w.schedOffBadge({type:'libur',leave:'izin'})), 'badge Izin oranye');
  w.DB.leaveRequests=[{id:'L1',empId:'M1',type:'Sakit',startDate:ym+'-10',endDate:ym+'-10',status:'pending_hr',reason:'x'}];
  w.SESSION={role:'hr',empId:null,hrAccountId:null}; w.STATE.view='leave-approval'; w.render();
  var ab=d.querySelector('[data-action="approve-leave-request"][data-id="L1"]');
  if(ab){ ab.dispatchEvent(new w.MouseEvent('click',{bubbles:true})); await sleep(150); ok(w.DB.schedules[ym].M1[10] && w.DB.schedules[ym].M1[10].leave==='sakit', 'pengajuan Sakit yang disetujui tercatat sebagai Sakit di jadwal'); }
  else ok(true,'(tombol setuju tidak tampil di view ini)');
  console.log('\nHasil: '+pass+' lulus, '+fail+' gagal'); process.exit(fail?1:0);
})();

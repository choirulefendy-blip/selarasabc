/* Tes: jam fleksibel (Marketing, Sales, Finance, Accounting, Purchasing) — telat tertutup bila kerja 8 jam. */
var fs=require('fs'),path=require('path'),JSDOM=require('jsdom').JSDOM;
var html=fs.readFileSync(path.join(__dirname,'..','web','index.html'),'utf8')
  .replace(/var SUPABASE_URL = '[^']*'/,"var SUPABASE_URL = ''").replace(/var SUPABASE_ANON_KEY = '[^']*'/,"var SUPABASE_ANON_KEY = ''")
  .replace(/var PUSH_FUNCTION_URL = '[^']*'/,"var PUSH_FUNCTION_URL = ''").replace(/var EMAIL_FUNCTION_URL = '[^']*'/,"var EMAIL_FUNCTION_URL = ''");
var pass=0,fail=0; function ok(c,n){ if(c){pass++;console.log('  ok   - '+n);}else{fail++;console.log('  FAIL - '+n);} }
function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}
(async function(){
  var dom=new JSDOM(html,{url:'https://abc.test/',runScripts:'dangerously',pretendToBeVisual:true});
  var w=dom.window; w.console.error=function(){}; w.scrollTo=function(){}; await sleep(400);
  function emp(id,dept){ return {id:id,empCode:id,name:id,position:'Staff',department:dept,properties:[],joinDate:'2025-01-01',baseSalary:3000000,active:true,username:id,password:'p'}; }
  w.DB.employees=[emp('MK','Marketing'),emp('SL','Sales'),emp('FN','Finance'),emp('AC','Accounting'),emp('PU','Purchasing'),emp('FO','Front Office')];
  w.DB.settings.gracePeriodMinutes=0; w.DB.settings.lateRatePerMinute=1000; delete w.DB.settings.flexDepts;
  var ym='2026-10'; w.DB.schedules[ym]={}; w.DB.attendance[ym]={};
  function set(id,day,inT,outT){ w.DB.schedules[ym][id]=w.DB.schedules[ym][id]||{}; w.DB.schedules[ym][id][day]={type:'kerja',start:'09:00',end:'17:00'};
    w.DB.attendance[ym][id]=w.DB.attendance[ym][id]||{}; w.DB.attendance[ym][id][day]={checkIn:inT,checkOut:outT||null}; }

  console.log('\n[Departemen jam fleksibel]');
  ok(['Marketing','Sales','Finance','Accounting','Purchasing'].every(w.isFlexDept) && !w.isFlexDept('Front Office') && w.isFlexDept('Marketing Communication'), 'default: Marketing, Sales, Finance, Accounting, Purchasing');

  console.log('\n[Telat tapi kerja 8 jam]');
  set('MK',1,'09:30','17:30'); var m=w.getMatchDay('MK',ym,1);
  ok(m.status==='hadir' && m.lateMinutes===0 && m.flexLateRaw===30, 'masuk 09:30 pulang 17:30 (8 jam) -> Hadir, tidak telat');
  set('SL',1,'10:00','19:30'); m=w.getMatchDay('SL',ym,1);
  ok(m.status==='hadir' && m.flex.extraMin===90 && /Lembur \+1j 30m/.test(w.flexNoteHtml(m)), 'lebih dari 8 jam -> tercatat lembur +1j 30m');
  set('FN',1,'09:30','17:00'); m=w.getMatchDay('FN',ym,1);
  ok(m.status==='telat' && m.lateMinutes===30 && /kurang dari 8 jam/.test(w.flexNoteHtml(m)), 'pulang sebelum 8 jam -> tetap Telat');
  set('AC',1,'09:20',null); m=w.getMatchDay('AC',ym,1);
  ok(m.status==='telat' && m.flex.pending && m.flex.needOut==='17:20' && !/[Jj]am fleksibel/.test(w.flexNoteHtml(m)), 'belum pulang -> sementara Telat (tanpa kalimat jam fleksibel)');
  set('PU',1,'21:00','05:30'); w.DB.schedules[ym].PU[1]={type:'kerja',start:'20:00',end:'04:00'}; m=w.getMatchDay('PU',ym,1);
  ok(m.status==='hadir' && m.flex.workedMin===510, 'shift lintas tengah malam dihitung benar');
  set('FO',1,'09:30','18:00'); m=w.getMatchDay('FO',ym,1);
  ok(m.status==='telat' && m.lateMinutes===30 && !m.flex, 'departemen lain (Front Office) tetap aturan biasa');

  console.log('\n[Payroll]');
  ok(w.computePayroll('MK',ym).lateDeduction===0 && w.computePayroll('FN',ym).lateDeduction===30000 && w.computePayroll('FO',ym).lateDeduction===30000, 'potongan telat hanya untuk yang belum 8 jam / non-fleksibel');

  console.log('\n[Notifikasi HR]');
  w.DB.officeLocations=[]; w.DB.notifications=[]; w.raiseAttendanceAlerts('AC',ym,1,'in','09:20');
  ok(!/Jam fleksibel/.test(w.DB.notifications[0].message) && /lewat/.test(w.DB.notifications[0].message) && !/TELAT/.test(w.DB.notifications[0].message), 'absen masuk telat (fleksibel): info tanpa kalimat jam fleksibel, bukan TELAT');
  w.DB.notifications=[]; w.raiseAttendanceAlerts('FN',ym,1,'out','17:00');
  ok(/kurang dari 8 jam/.test(w.DB.notifications[0].message) && /TELAT 30/.test(w.DB.notifications[0].message), 'pulang < 8 jam: HR diberi tahu TELAT');
  w.DB.notifications=[]; w.raiseAttendanceAlerts('MK',ym,1,'out','17:30');
  ok(/tidak dihitung telat/.test(w.DB.notifications[0].message), 'pulang >= 8 jam: HR diberi tahu tidak dihitung telat');
  w.DB.notifications=[]; w.raiseAttendanceAlerts('FO',ym,1,'in','09:30');
  ok(/TELAT 30/.test(w.DB.notifications[0].message), 'non-fleksibel: notifikasi TELAT seperti biasa');

  console.log('\n[Pengaturan HR]');
  w.SESSION={role:'hr',empId:null,hrAccountId:null}; w.STATE.view='settings'; w.render();
  var cbs=w.document.querySelectorAll('.s_flex');
  ok(cbs.length>0 && Array.prototype.some.call(cbs,function(c){ return c.value==='Marketing' && c.checked; }), 'HR melihat daftar departemen jam fleksibel');
  Array.prototype.forEach.call(cbs,function(c){ c.checked = c.value==='Finance'; });
  w.document.querySelector('[data-action="save-payroll-settings"]').dispatchEvent(new w.MouseEvent('click',{bubbles:true})); await sleep(80);
  ok(w.DB.settings.flexDepts.join()==='Finance' && !w.isFlexDept('Marketing') && w.getMatchDay('MK',ym,1).status==='telat', 'HR bisa mengubah departemen (Marketing dimatikan -> kembali Telat)');

  console.log('\nHasil: '+pass+' lulus, '+fail+' gagal'); process.exit(fail?1:0);
})();

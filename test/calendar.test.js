/* Tes: Google Calendar (feed iCal + kartu profil). */
var fs=require('fs'),path=require('path'),JSDOM=require('jsdom').JSDOM,M=require('module');
var pass=0,fail=0; function ok(c,n){ if(c){pass++;console.log('  ok   - '+n);}else{fail++;console.log('  FAIL - '+n);} }
function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}
(async function(){
  var src=fs.readFileSync(path.join(__dirname,'..','supabase','functions','calendar-ics','index.ts'),'utf8')
    .replace(/^import .*$/m,'').replace(/if \(import\.meta\.main\)[\s\S]*$/,'').replace(/Deno\.env\.get\([^)]*\)/g,'""').replace(/export function/g,'function');
  var js=M.stripTypeScriptTypes(src)+'\nmodule.exports={buildIcs};';
  var mod={exports:{}}; new Function('module','TextEncoder',js)(mod,TextEncoder); var buildIcs=mod.exports.buildIcs;
  var db={employees:[{id:'S1',name:'Sari',department:'Marketing'},{id:'S2',department:'Marketing'}],
    schedules:{'2026-11':{S1:{5:{type:'kerja',start:'08:00',end:'17:00'},6:{type:'kerja',start:'22:00',end:'06:00'},7:{type:'libur',leave:'sakit'},8:{type:'libur'}}}},
    leaveRequests:[{id:'L1',empId:'S1',status:'approved',startDate:'2026-11-20',endDate:'2026-11-21',type:'Cuti Tahunan'},{id:'L2',empId:'S1',status:'pending_hr',startDate:'2026-11-25'}],
    todos:[{id:'T1',ownerId:'S1',title:'Konten Reels',due:'2026-11-10',status:'todo'},{id:'T2',ownerId:'S1',title:'Selesai',due:'2026-11-10',status:'done'},{id:'T3',ownerId:'S2',title:'Orang lain',due:'2026-11-10'}],
    agenda:[{id:'A1',ownerId:'S2',scope:'departemen',title:'Rapat Marketing',date:'2026-11-12',startTime:'10:00',endTime:'11:00',location:'Padi'},{id:'A2',ownerId:'X',scope:'pribadi',title:'Rahasia',date:'2026-11-12'}]};
  var ics=buildIcs(db, db.employees[0], new Date('2026-11-04T05:00:00Z'));
  ok(/^BEGIN:VCALENDAR/.test(ics) && /END:VCALENDAR/.test(ics) && /\r\n/.test(ics), 'format iCal valid (CRLF)');
  ok(/SUMMARY:Shift Kerja 08:00–17:00/.test(ics) && /DTSTART;TZID=Asia\/Jakarta:20261105T080000/.test(ics) && /DTEND;TZID=Asia\/Jakarta:20261105T170000/.test(ics), 'shift pagi dengan jam WIB');
  ok(/DTSTART;TZID=Asia\/Jakarta:20261106T220000\r\nDTEND;TZID=Asia\/Jakarta:20261107T060000/.test(ics), 'shift malam berakhir hari berikutnya');
  ok(/SUMMARY:Sakit/.test(ics) && /SUMMARY:Libur/.test(ics), 'libur & sakit sebagai acara seharian');
  ok(/Cuti: Cuti Tahunan \(disetujui\)/.test(ics) && /DTEND;VALUE=DATE:20261122/.test(ics) && !/leave-L2/.test(ics), 'cuti disetujui saja, rentang tanggal benar');
  ok(/Tenggat: Konten Reels/.test(ics) && !/Selesai/.test(ics) && !/Orang lain/.test(ics), 'tenggat tugas milik sendiri yang belum selesai');
  ok(/Rapat Marketing/.test(ics) && /LOCATION:Padi/.test(ics) && !/Rahasia/.test(ics), 'agenda departemen tampil, pribadi orang lain tidak');
  /* kartu profil */
  var html=fs.readFileSync(path.join(__dirname,'..','web','index.html'),'utf8').replace(/var SUPABASE_URL = '[^']*'/,"var SUPABASE_URL = ''").replace(/var SUPABASE_ANON_KEY = '[^']*'/,"var SUPABASE_ANON_KEY = ''").replace(/var PUSH_FUNCTION_URL = '[^']*'/,"var PUSH_FUNCTION_URL = ''");
  var dom=new JSDOM(html,{url:'https://abcselaras.my.id/web/',runScripts:'dangerously',pretendToBeVisual:true});
  var w=dom.window; w.console.error=function(){}; w.scrollTo=function(){}; await sleep(400);
  var d=w.document; w.saveDB=function(){ return Promise.resolve(); };
  w.DB.employees=[{id:'S1',name:'Sari',department:'Marketing',active:true,username:'sari'}];
  w.SESSION={role:'staff',empId:'S1'}; w.STATE.view='my-profile'; w.render(); w.SUPABASE_URL='https://dxwrvrdvjjvmujrnawen.supabase.co';
  d.querySelector('[data-action="cal-enable"]').click(); await sleep(30);
  var tok=w.DB.employees[0].calToken;
  ok(/^[0-9a-f]{40}$/.test(tok), 'token kalender acak dibuat');
  var a=d.querySelector('a[href^="https://calendar.google.com/calendar/r?cid="]');
  ok(a && decodeURIComponent(a.href.split('cid=')[1]).indexOf('webcal://dxwrvrdvjjvmujrnawen.supabase.co/functions/v1/calendar-ics?e=S1&t='+tok)===0, 'tombol Tambahkan ke Google Calendar (webcal)');
  w.confirm=function(){return true;}; d.querySelector('[data-action="cal-reset"]').click(); await sleep(30);
  ok(w.DB.employees[0].calToken!==tok, 'reset link membuat token baru');
  console.log('\n'+pass+' lulus, '+fail+' gagal'); process.exit(fail?1:0);
})();

/* Tes: approval gate, Performance Review, Selaras Rekrut (publik + HR). */
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
    {id:'S1',name:'Sari Ayu',username:'sari',department:'Marketing',position:'Content',active:true},
    {id:'H1',name:'Budi Santoso',username:'budi',department:'Marketing',position:'Manager',active:true}
  ];
  w.DB.settings=w.DB.settings||{};

  console.log('\n[Approval gate]');
  w.DB.leaveRequests=[{id:'L1',empId:'S1',startDate:'2026-11-20',endDate:'2026-11-20',type:'Cuti Tahunan',reason:'x',status:'pending_hr',submittedAt:new Date().toISOString()}];
  w.SESSION={role:'hr',empId:null}; w.STATE.view='leave-approval'; w.render(); await sleep(30);
  ok(typeof w.approvalGateStart==='function' && w.APPROVAL_GATE_ACTIONS['approve-leave-request']===1, 'gerbang approval terpasang untuk persetujuan cuti');
  // simulate clicking approve -> should open APV modal, not approve directly
  w.approvalActorEmp && null;
  var fakeBtn=d.createElement('button'); fakeBtn.setAttribute('data-action','approve-leave-request'); fakeBtn.setAttribute('data-id','L1'); d.body.appendChild(fakeBtn);
  click(w, fakeBtn); await sleep(30);
  ok(w.APV && /Verifikasi/.test((d.getElementById('modalRoot')||{}).innerHTML||''), 'klik Setujui membuka verifikasi dulu (belum langsung disetujui)');
  ok(w.DB.leaveRequests[0].status==='pending_hr', 'status cuti belum berubah sebelum verifikasi');
  // bypass verification (skip path) -> dispatch
  w.apvDispatch(); await sleep(40);
  ok(w.DB.leaveRequests[0].status==='approved', 'setelah verifikasi, persetujuan diproses');

  console.log('\n[Performance Review]');
  w.SESSION={role:'hr',empId:null}; w.STATE.view='perf-review'; w.render(); await sleep(20);
  ok(!!d.getElementById('perf_title'), 'HR melihat form buat Performance Review');
  d.getElementById('perf_title').value='Review Semester 2'; d.getElementById('perf_period').value='2026-11';
  click(w,'[data-action="perf-create"]'); await sleep(40);
  ok(w.perfActiveCycle() && w.perfActiveCycle().title==='Review Semester 2', 'siklus aktif terbuat dengan judul');
  // staff menilai HOD
  w.SESSION={role:'staff',empId:'S1'}; w.STATE.view='dashboard'; w.render(); await sleep(20);
  ok(/Performance Review/.test(d.getElementById('app').textContent) && d.querySelector('[data-action="perf-open"][data-id="H1"]'), 'staff melihat kartu untuk menilai HOD');
  click(w,'[data-action="perf-open"][data-id="H1"]'); await sleep(20);
  var crit=w.perfCriteriaFor('staff_to_hod');
  crit.forEach(function(c){ var dot=d.querySelector('[data-crit-dots="'+c.k+'"] [data-val="4"]'); click(w,dot); });
  click(w,'[data-action="perf-save"][data-id="H1"]'); await sleep(40);
  var res=w.perfResultsFor('H1', w.perfActiveCycle().id);
  ok(res.count===1 && Math.abs(res.avg-4)<0.01, 'penilaian staff->HOD tersimpan dengan rata-rata 4');
  // HR lihat hasil
  w.SESSION={role:'hr',empId:null}; w.STATE.view='perf-review'; w.render(); await sleep(20);
  ok(/Budi Santoso/.test(d.getElementById('app').textContent), 'HR melihat hasil penilaian di tabel');

  console.log('\n[Selaras Rekrut]');
  w.SESSION={role:'hr',empId:null}; w.STATE.recruitTab='tests'; w.STATE.view='recruit'; w.render(); await sleep(20);
  ok(!!d.querySelector('[data-action="recruit-new-test"]'), 'HR melihat tombol buat Selaras Test');
  // builder baru: soal dari bank, HR hanya pilih posisi & bagian
  w.STATE.recruitEdit={id:null,title:'Rekrut Cook',positionKey:'cook',position:'Chef / Cook / Dapur',intro:'',interview:{date:'2026-11-25',time:'10:00',address:'Briggs Inn Batu'},sections:{psikotest:true,iq:true,online:true}};
  var saveBtn=d.createElement('button'); saveBtn.setAttribute('data-action','recruit-save-test'); d.body.appendChild(saveBtn);
  w.openModal(w.recruitTestModalHtml());
  d.getElementById('rkt_title').value='Rekrut Cook';
  click(w, saveBtn); await sleep(40);
  var test=(w.DB.recruitTests||[])[0];
  var expLen=w.RECRUIT_BANK.psikotest.length+w.RECRUIT_BANK.iq.length+w.RECRUIT_BANK.online.cook.length;
  ok(test && test.active && test.questions.length===expLen, 'Selaras Test tersimpan & aktif dengan soal dari bank');

  // public candidate flow
  w.location.hash='#rekrut/'+test.id; w.SESSION={}; w.render(); await sleep(20);
  ok(w.recruitPublicRoute() && /Selaras Test/.test(d.getElementById('app').textContent), 'link publik menampilkan halaman Selaras Test tanpa login');
  click(w,'[data-action="recruit-pub-start"]'); await sleep(20);
  d.getElementById('rkd_name').value='ANDI PRATAMA';
  d.getElementById('rkd_phone').value='081234567890'; d.getElementById('rkd_email').value='andi@mail.com';
  d.getElementById('rkd_address').value='Jl. Mawar 1'; d.getElementById('rkd_birth').value='2000-01-01';
  click(w,'[data-action="recruit-pub-data"]'); await sleep(20);
  ok(w.STATE.recruitPub.step==='test' && w.STATE.recruitPub.data.name==='ANDI PRATAMA', 'data diri tersimpan & nama jadi KAPITAL');
  // jawab semua soal benar (mc -> correct, scale -> 5)
  test.questions.forEach(function(q){
    if(q.type==='scale'){ var s=d.querySelector('[name="rq_'+q.id+'"][value="5"]'); if(s) click(w,s); }
    else { var m=d.querySelector('[name="rq_'+q.id+'"][value="'+q.correct+'"]'); if(m) click(w,m); }
  });
  w.storageGet=function(){ return Promise.resolve({value:JSON.stringify(w.DB)}); };
  w.saveDB=function(){ return Promise.resolve(true); };
  click(w,'[data-action="recruit-pub-submit"]'); await sleep(80);
  var appRec=(w.DB.recruitApplicants||[])[0];
  ok(appRec && appRec.name==='ANDI PRATAMA' && appRec.scores.iq && appRec.scores.iq.pct===100, 'jawaban terkirim, skor IQ 100% terhitung');
  ok(w.STATE.recruitPub.step==='done' && /Interview/.test(d.getElementById('app').textContent), 'calon melihat jadwal interview setelah submit');
  click(w,'[data-action="recruit-pub-accept"]'); await sleep(40);
  ok((w.DB.recruitApplicants[0].interviewAccepted===true), 'calon menyetujui kehadiran interview');

  console.log('\nHASIL: '+pass+' lulus, '+fail+' gagal');
  process.exit(fail?1:0);
})().catch(function(e){ console.error(e); process.exit(1); });

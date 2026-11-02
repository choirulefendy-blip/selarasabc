/* Tes: impor paket dokumen (SOP, Job Description, Flowchart, Struktur Organisasi). */
var fs=require('fs'),path=require('path'),JSDOM=require('jsdom').JSDOM;
var html=fs.readFileSync(path.join(__dirname,'..','web','index.html'),'utf8')
  .replace(/var SUPABASE_URL = '[^']*'/,"var SUPABASE_URL = ''").replace(/var SUPABASE_ANON_KEY = '[^']*'/,"var SUPABASE_ANON_KEY = ''")
  .replace(/var PUSH_FUNCTION_URL = '[^']*'/,"var PUSH_FUNCTION_URL = ''").replace(/var EMAIL_FUNCTION_URL = '[^']*'/,"var EMAIL_FUNCTION_URL = ''");
var pass=0,fail=0; function ok(c,n){ if(c){pass++;console.log('  ok   - '+n);}else{fail++;console.log('  FAIL - '+n);} }
function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}
var REAL = process.env.PKG_FILE && fs.existsSync(process.env.PKG_FILE) ? fs.readFileSync(process.env.PKG_FILE,'utf8') : null;
var PKG = REAL ? JSON.parse(REAL) : {type:'abc-selaras-package',version:1,name:'Paket Uji',docs:[
  {key:'ABC-HMS-FULL',category:'Kebijakan',title:'Dokumen Lengkap',depts:[],desc:'Isi',file:{name:'a.docx',type:'application/octet-stream',data:Buffer.from('halo').toString('base64')}},
  {key:'ABC-FO-JD-001',category:'Job Description',title:'JD FOM',depts:['Front Office'],desc:'Tujuan: x\n\nSumber: uji'},
  {key:'ABC-FIN-JD-001',category:'Job Description',title:'JD Finance',depts:['Finance','Accounting'],desc:'x'},
  {key:'ABC-FLOW-001',category:'Flowchart',title:'Alur SOP',depts:[],desc:'Langkah 1\nLangkah 2\nLangkah 3'},
  {key:'ABC-GUIDE-001',category:'Panduan Kerja',title:'Panjang',depts:[],desc:new Array(60).join('teks panjang ')}],
  org:{group:[{key:'own',title:'Owner',parentKey:null},{key:'hm',title:'HM Cluster',parentKey:'own'},{key:'smr',title:'Sales, Marketing & Revenue',parentKey:'hm',dept:'Marketing'},{key:'fom',title:'FOM',parentKey:'hm',dept:'Front Office'}],
    props:{'Padi Heritage':[{key:'hm',title:'HM Cluster'},{key:'fo',title:'FO PIC',parentKey:'hm',dept:'Front Office'}],'Hotel Tidak Ada':[{key:'x',title:'X'}]}}};
(async function(){
  var dom=new JSDOM(html,{url:'https://abc.test/',runScripts:'dangerously',pretendToBeVisual:true});
  var w=dom.window; w.console.error=function(){}; w.scrollTo=function(){}; await sleep(400);
  var d=w.document; function app(){ return d.getElementById('app').textContent; }
  function emp(id,name,dept,props){ return {id:id,empCode:id,name:name,position:'Staff',department:dept,properties:props||[],joinDate:'2025-01-01',active:true,username:id,password:'p'}; }
  w.DB.employees=[emp('MK','Fendy','Marketing'),emp('FO','Rina FO','Front Office',['Padi Heritage']),emp('FN','Budi Fin','Finance'),emp('HK','Sari HK','Housekeeping')];
  w.DB.departmentHods={Marketing:['MK'],'Front Office':['FO']}; w.DB.sops=[]; w.DB.org={group:[],props:{}};
  w.SESSION={role:'hr',empId:null,hrAccountId:null}; w.STATE.view='sop'; w.render();
  ok(!!d.getElementById('pkgFile'), 'HR: tombol Impor Paket Dokumen di halaman SOP');
  w.PKG=w.pkgParse(JSON.stringify(PKG)); w.openModal(w.pkgModalHtml());
  ok(/dokumen ke halaman SOP/.test(d.getElementById('modalRoot').textContent) && d.querySelectorAll('.pkg-org').length===(REAL?4:2), 'pratinjau: jumlah dokumen + struktur (property yang tidak ada diabaikan)');
  d.querySelector('[data-action="pkg-apply"]').dispatchEvent(new w.MouseEvent('click',{bubbles:true})); await sleep(400);
  var sops=w.DB.sops.filter(function(x){ return !x.deleted; });
  ok(sops.length>=PKG.docs.length, 'dokumen masuk ke SOP ('+sops.length+')');
  var full=sops.filter(function(x){ return x.pkgKey==='ABC-HMS-FULL'; })[0];
  ok(full && full.fileKey && full.fileName, 'dokumen lengkap tersimpan beserta file Word');
  var jdFo=sops.filter(function(x){ return x.pkgKey==='ABC-FO-JD-001'; });
  ok(jdFo.length===1 && jdFo[0].dept==='Front Office' && jdFo[0].category==='Job Description' && jdFo[0].code==='ABC-FO-JD-001', 'JD FOM khusus departemen Front Office');
  var finD=sops.filter(function(x){ return x.pkgKey==='ABC-FIN-JD-001'; }).map(function(x){ return x.dept; }); console.log('  depts:', w.getDepartments().join('/'), '->', finD.join()); ok(finD.indexOf('Finance')!==-1 && finD.every(function(x){ return w.getDepartments().indexOf(x)!==-1 || w.DB.employees.some(function(e){ return e.department===x; }); }), 'JD Finance hanya ke departemen yang ada');
  var g=w.DB.org.group, smr=g.filter(function(n){ return /Sales, Marketing/.test(n.title); })[0], hm=g.filter(function(n){ return n.title==='HM Cluster'; })[0];
  ok(g.length>=4 && smr.empId==='MK' && smr.parentId===hm.id, 'struktur group tersusun, HOD Marketing otomatis mengisi jabatan Sales & Marketing');
  ok(w.DB.org.props['Padi Heritage'].some(function(n){ return n.empId==='FO'; }) && !w.DB.org.props['Hotel Tidak Ada'], 'struktur per property (Padi Heritage) + HOD FO terisi');
  ok(w.DB.notifications.filter(function(n){ return n.audience.empId==='HK'; }).length===1, 'satu notifikasi per karyawan (tidak dibanjiri)');
  w.render();
  ok(!!d.querySelector('.sop-flow .sop-flow-step') && d.querySelectorAll('.sop-flow-arrow').length>=2, 'Flowchart tampil sebagai langkah berpanah');
  ok(!!d.querySelector('.sop-clamp') && !!d.querySelector('[data-action="sop-more"]'), 'isi panjang dipotong + tombol Selengkapnya');
  d.querySelector('[data-action="sop-more"]').dispatchEvent(new w.MouseEvent('click',{bubbles:true})); await sleep(30);
  ok(d.querySelector('.sop-clamp.open'), 'Selengkapnya membuka isi');
  var n0=w.DB.sops.length; w.PKG=w.pkgParse(JSON.stringify(PKG)); w.openModal(w.pkgModalHtml());
  ok(/akan diperbarui/.test(d.getElementById('modalRoot').textContent), 'impor ulang: diberi tahu dokumen akan diperbarui');
  d.querySelector('[data-action="pkg-apply"]').dispatchEvent(new w.MouseEvent('click',{bubbles:true})); await sleep(400);
  ok(w.DB.sops.length===n0, 'impor ulang tidak membuat dokumen dobel');
  w.SESSION={role:'staff',empId:'HK'}; w.STATE.view='sop'; w.render();
  ok(!/JD FOM|Job Description — FOM/.test(app()) && !d.getElementById('pkgFile'), 'staf Housekeeping tidak melihat JD Front Office, tanpa tombol impor');
  w.SESSION={role:'staff',empId:'FO'}; w.render(); ok(/FOM/.test(app()), 'staf Front Office melihat JD FOM');
  try{ w.pkgParse('{"a":1}'); ok(false,'file tidak valid ditolak'); }catch(e){ ok(true,'file tidak valid ditolak'); }
  console.log('\nHasil: '+pass+' lulus, '+fail+' gagal'); process.exit(fail?1:0);
})();

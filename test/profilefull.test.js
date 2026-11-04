/* Tes: Profil karyawan lengkap (BPJS, properti, cuti, data pribadi). */
var fs=require('fs'),path=require('path'),JSDOM=require('jsdom').JSDOM;
var html=fs.readFileSync(path.join(__dirname,'..','web','index.html'),'utf8')
  .replace(/var SUPABASE_URL = '[^']*'/,"var SUPABASE_URL = ''").replace(/var SUPABASE_ANON_KEY = '[^']*'/,"var SUPABASE_ANON_KEY = ''")
  .replace(/var PUSH_FUNCTION_URL = '[^']*'/,"var PUSH_FUNCTION_URL = ''");
var pass=0,fail=0; function ok(c,n){ if(c){pass++;console.log('  ok   - '+n);}else{fail++;console.log('  FAIL - '+n);} }
function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}
(async function(){
  var dom=new JSDOM(html,{url:'https://abcselaras.my.id/web/',runScripts:'dangerously',pretendToBeVisual:true});
  var w=dom.window; w.console.error=function(){}; w.scrollTo=function(){}; await sleep(400);
  var d=w.document; function app(){ return d.getElementById('app').textContent; }
  w.DB.employees=[{id:'S1',empCode:'MKT-001',name:'Sari',position:'Content Creator',department:'Marketing',properties:['Briggs Inn','Padi Heritage Resort'],joinDate:'2024-03-01',dateOfBirth:'1999-05-10',gender:'Perempuan',phone:'0812',email:'sari@gmail.com',address:'Jl. Ijen 5 Malang',active:true,username:'sari',password:'p',bpjsTkNo:'12345678901',bpjsKesNo:'0001234567890',contractUntil:'2027-05-31',baseSalary:5000000}];
  w.SESSION={role:'staff',empId:'S1'}; w.STATE.view='my-profile'; w.render();
  var t=app();
  ok(/Data Kepegawaian/.test(t)&&/MKT-001/.test(t)&&/Content Creator/.test(t), 'data kepegawaian tampil');
  ok(/Briggs Inn, Padi Heritage Resort/.test(t), 'properti bergabung tampil');
  ok(/12345678901/.test(t)&&/0001234567890/.test(t), 'nomor BPJS TK & Kesehatan tampil');
  ok(/Cuti Tahunan/.test(t)&&/Sisa Cuti/.test(t)&&/12 hari/.test(t), 'jatah cuti tampil');
  ok(/Jl. Ijen 5 Malang/.test(t)&&/Perempuan/.test(t)&&/Kontrak s\/d/.test(t), 'data pribadi & kontrak tampil');
  ok(!/5\.000\.000/.test(t), 'gaji tidak ditampilkan di profil');
  /* pengumuman dihapus HR ikut terhapus di staff */
  w.DB.announcements=[{id:'A1',title:'Rapat Bulanan',message:'x',recipients:['all'],createdAt:'2026-11-01T01:00:00Z'}];
  w.STATE.view='announcements'; w.render(); ok(/Rapat Bulanan/.test(app()),'staff lihat pengumuman');
  w.mergeLiveData({announcements:[{id:'A1',title:'Rapat Bulanan',message:'x',recipients:['all'],createdAt:'2026-11-01T01:00:00Z',deleted:true,deletedAt:'2026-11-04T01:00:00Z'}]});
  w.render(); ok(!/Rapat Bulanan/.test(app()),'setelah sinkron, pengumuman terhapus di staff');
  w.mergeLiveData({announcements:[{id:'A1',title:'Rapat Bulanan',message:'x',recipients:['all'],createdAt:'2026-11-01T01:00:00Z'}]});
  ok(w.DB.announcements[0].deleted===true,'salinan lama tidak menghidupkan lagi');
  console.log('\n'+pass+' lulus, '+fail+' gagal'); process.exit(fail?1:0);
})();

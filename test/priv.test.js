/* Tes: Hak Akses Staff + Impor Excel Aset. */
var fs=require('fs'),path=require('path'),JSDOM=require('jsdom').JSDOM,XLSX=require('xlsx');
var html=fs.readFileSync(path.join(__dirname,'..','web','index.html'),'utf8')
  .replace(/var SUPABASE_URL = '[^']*'/,"var SUPABASE_URL = ''").replace(/var SUPABASE_ANON_KEY = '[^']*'/,"var SUPABASE_ANON_KEY = ''")
  .replace(/var PUSH_FUNCTION_URL = '[^']*'/,"var PUSH_FUNCTION_URL = ''").replace(/var EMAIL_FUNCTION_URL = '[^']*'/,"var EMAIL_FUNCTION_URL = ''");
var pass=0,fail=0; function ok(c,n){ if(c){pass++;console.log('  ok   - '+n);}else{fail++;console.log('  FAIL - '+n);} }
function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}
(async function(){
  var dom=new JSDOM(html,{url:'https://abc.test/',runScripts:'dangerously',pretendToBeVisual:true});
  var w=dom.window; w.console.error=function(){}; w.scrollTo=function(){}; await sleep(400);
  var d=w.document; function app(){ return d.getElementById('app').innerHTML; }
  function emp(id,name,dept){ return {id:id,empCode:id,name:name,position:'Staff',department:dept,properties:[],joinDate:'2025-01-01',dateOfBirth:'1995-01-01',gender:'Laki-laki',baseSalary:1,mealAllowance:0,transportAllowance:0,address:'',phone:'',email:'',username:id,password:'p',active:true}; }
  w.DB.employees=[emp('H1','Moch Choirul Efendi','Marketing'),emp('S1','Afrizal Tegar','Marketing'),emp('S2','Selly Tri','Marketing'),emp('F1','Fajar FO','Front Office')];
  w.DB.departmentHods={Marketing:['H1']};
  function as(role,id,view){ w.SESSION= role==='hr'?{role:'hr',empId:null,hrAccountId:null}:{role:role,empId:id}; w.STATE.view=view; w.render(); }
  async function click(sel){ var el=typeof sel==='string'?d.querySelector(sel):sel; if(!el) throw new Error('tidak ada: '+sel); el.dispatchEvent(new w.MouseEvent('click',{bubbles:true})); await sleep(60); }
  function setv(id,v){ var el=d.getElementById(id); el.value=v; el.dispatchEvent(new w.Event('change',{bubbles:true})); }
  function navViews(){ return Array.prototype.map.call(d.querySelectorAll('.nav-item'), function(b){ return b.getAttribute('data-view'); }); }

  console.log('\n[Hak Akses Staff]');
  as('hod','H1','privileges'); ok(/Hak Akses Default/.test(app()) && d.querySelectorAll('[data-action="priv-toggle"]').length===16, 'HOD membuka Hak Akses Staff (16 fitur)');
  await click('[data-action="priv-toggle"][data-key="chat"]');
  ok(w.DB.privileges.dept.Marketing.chat===false, 'default departemen: Chat diblokir');
  as('staff','S1','dashboard'); ok(navViews().indexOf('chat')===-1 && !d.querySelector('.bottom-nav [data-view="chat"]') && !d.querySelector('.chat-fab'), 'staf Marketing: menu, bottom nav & tombol Chat hilang');
  w.STATE.view='chat'; w.render(); ok(w.STATE.view==='dashboard', 'buka paksa halaman Chat -> dialihkan ke Dashboard');
  as('staff','F1','dashboard'); ok(navViews().indexOf('chat')!==-1, 'staf departemen lain tidak terpengaruh');
  as('hod','H1','privileges'); setv('privTarget','S2'); ok(/Hak Akses Khusus/.test(app()) && /Selly Tri/.test(app()), 'pilih staff tertentu');
  await click('[data-action="priv-toggle"][data-key="chat"]'); await click('[data-action="priv-toggle"][data-key="my-payslip"]'); await click('[data-action="priv-toggle"][data-key="assets"]');
  ok(w.staffCan('chat','S2')===true && w.staffCan('my-payslip','S2')===false && w.staffCan('assets','S2')===true && w.staffCan('chat','S1')===false, 'pengaturan khusus per staff menimpa default departemen');
  as('staff','S2','dashboard'); ok(navViews().indexOf('chat')!==-1 && navViews().indexOf('my-payslip')===-1 && navViews().indexOf('assets')!==-1 && !/data-view="my-payslip"/.test(d.querySelector('.dash-quick-actions').outerHTML), 'Selly: Chat & Aset terbuka, Slip Gaji hilang (menu & tombol cepat)');
  w.STATE.view='assets'; w.render(); ok(/Total Aset/.test(app()) && !d.querySelector('[data-action="as-new"]'), 'staf dengan akses "lihat" tidak bisa menambah aset');
  as('hod','H1','privileges'); ok(/Ringkasan Akses Staff/.test(app()) && /Slip Gaji/.test(app()), 'ringkasan blokir/akses tambahan per staff');
  setv('privTarget','S2'); await click('[data-action="priv-reset"]'); ok(!w.DB.privileges.emp.S2, 'kembalikan ke default departemen');
  as('hr',null,'privileges'); ok(!!d.getElementById('privDept'), 'HR bisa memilih semua departemen');

  console.log('\n[Impor Excel Aset]');
  var aoa=[['Nama ','Jumlah','Aset','Checklist'],['Nikon D300',1,null,null],['Lensa Fujifilm 35mm',1,null,null],['Baterai Enelop ',3,null,null],['Micro HDMI to HDMI Vention',1,null,null],['Wireless Mic Hollyland',1,null,null],['SSD Transcend 1TB',1,null,null],['Macbook Pro 2015 13" 256GB',1,null,null]];
  var rows=w.assetParseSheet(aoa);
  ok(rows.length===7 && rows[2].qty===3 && rows[2].brand==='Eneloop' && rows[0].category==='Kamera & Fotografi', 'baca file: nama, jumlah, merek & kategori otomatis');
  ok(rows[3].category==='Kabel & Aksesoris' && rows[4].category==='Audio & Lighting' && rows[5].category==='Penyimpanan & Memori' && rows[6].category==='Komputer & IT', 'kategori otomatis tepat (HDMI, mic, SSD, Macbook)');
  var r1=w.assetImportRows(rows,'Marketing','H1','', 'tes'); var r2=w.assetImportRows(rows,'Marketing','H1','', 'tes');
  ok(r1.added===7 && r2.added===0 && r2.skipped===7, 'impor 7 barang, impor ulang tidak dobel');
  ok(w.DB.assets[0].code==='AST-MAR-0001' && w.DB.assets[6].code==='AST-MAR-0007' && w.DB.assets[0].holderEmpId==='H1', 'kode berurutan & pemegang terisi');
  as('hod','H1','assets'); ok(/Nikon D300/.test(app()) && /×3/.test(app()) && /9 unit/.test(app()), 'tampil di Aset Inventaris (jumlah unit)');
  console.log('\n'+pass+' ok, '+fail+' gagal'); process.exit(fail?1:0);
})();

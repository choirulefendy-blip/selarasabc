/* Tes: gagal koneksi -> coba ulang, mode offline dari cache, tidak menyimpan. */
var fs=require('fs'),path=require('path'),JSDOM=require('jsdom').JSDOM;
var html=fs.readFileSync(path.join(__dirname,'..','web','index.html'),'utf8')
  .replace(/var SUPABASE_URL = '[^']*'/,"var SUPABASE_URL = ''").replace(/var SUPABASE_ANON_KEY = '[^']*'/,"var SUPABASE_ANON_KEY = ''");
var pass=0,fail=0; function ok(c,n){ if(c){pass++;console.log('  ok   - '+n);}else{fail++;console.log('  FAIL - '+n);} }
function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}
(async function(){
  var dom=new JSDOM(html,{url:'https://abc.test/',runScripts:'dangerously',pretendToBeVisual:true});
  var w=dom.window; w.console.error=function(){}; w.scrollTo=function(){}; await sleep(400);
  var d=w.document;
  var calls=0, up=true, sets=0, data=JSON.stringify(w.DB);
  w.fetch=function(){ return Promise.reject(new Error('offline')); };
  w.hasRemoteStorage=function(){ return true; };
  w.remoteGet=function(){ calls++; return up ? Promise.resolve({key:'hrdb',value:data}) : Promise.reject(new Error('Failed to fetch')); };
  w.remoteSet=function(){ sets++; return Promise.resolve({}); };
  await w.loadDB(); ok(!!w.localStorage.getItem('abcSelarasCache'), 'data terakhir disimpan di perangkat');
  up=false; calls=0; await w.loadDB();
  ok(calls===3, 'gagal -> dicoba ulang 3 kali');
  ok(w.STATE.offline===true && w.STATE.loaded===true && !w.STATE.loadError, 'ada cache -> buka mode offline (bukan layar error)');
  w.SESSION={role:'hr',empId:null,hrAccountId:null}; w.STATE.view='dashboard'; w.render();
  ok(/Mode offline/.test(d.getElementById('app').innerHTML), 'banner mode offline tampil');
  sets=0; var rej=false; await w.saveDB().catch(function(){ rej=true; }); ok(rej && sets===0, 'mode offline tidak menyimpan ke server');
  up=true; await w.loadDB(); ok(w.STATE.offline===false, 'koneksi pulih -> keluar dari mode offline');
  w.localStorage.removeItem('abcSelarasCache'); up=false; await w.loadDB(); ok(w.STATE.loadError===true, 'tanpa cache -> layar error seperti biasa');
  console.log('\n'+pass+' ok, '+fail+' gagal'); process.exit(fail?1:0);
})();

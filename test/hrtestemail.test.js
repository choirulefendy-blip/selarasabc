var fs=require('fs'),path=require('path'),JSDOM=require('jsdom').JSDOM;
var html=fs.readFileSync(path.join(__dirname,'..','web','index.html'),'utf8').replace(/var SUPABASE_URL = '[^']*'/,"var SUPABASE_URL = ''").replace(/var SUPABASE_ANON_KEY = '[^']*'/,"var SUPABASE_ANON_KEY = ''").replace(/var PUSH_FUNCTION_URL = '[^']*'/,"var PUSH_FUNCTION_URL = ''");
var pass=0,fail=0; function ok(c,n){ if(c){pass++;console.log('  ok   - '+n);}else{fail++;console.log('  FAIL - '+n);} }
function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}
(async function(){
  var dom=new JSDOM(html,{url:'https://abcselaras.my.id/web/',runScripts:'dangerously',pretendToBeVisual:true});
  var w=dom.window; w.console.error=function(){}; w.scrollTo=function(){}; await sleep(400);
  var sent=null; w.fetch=function(u,o){ if(/send-email/.test(u)){ sent=JSON.parse(o.body); return Promise.resolve({ok:true,json:function(){return Promise.resolve({ok:true});}}); } return Promise.resolve({ok:true,json:function(){return Promise.resolve({});},text:function(){return Promise.resolve('');}}); };
  w.emailConfigured=function(){return true;}; w.SESSION={role:'hr'}; var t=w.hrProfileTarget(); t.email='admin@abcselaras.my.id'; w.STATE.view='hr-profile'; w.render();
  var b=w.document.querySelector('[data-action="hr-test-email"]'); ok(b&&!b.disabled,'tombol Kirim Email Tes ada');
  b.click(); await sleep(50);
  ok(sent&&sent.to==='admin@abcselaras.my.id'&&/Tes email/.test(sent.subject),'email tes terkirim ke email HR');
  console.log('\n'+pass+' lulus, '+fail+' gagal'); process.exit(fail?1:0);
})();

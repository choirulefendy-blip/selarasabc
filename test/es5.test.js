/* Tes: seluruh JavaScript aplikasi wajib ES5 (WebView Android / iOS lama).
   Satu sintaks modern (?. => let const `...` ??) membuat SELURUH aplikasi gagal dimuat di perangkat lama. */
var fs = require('fs'), path = require('path'), acorn = require('acorn');
var pass = 0, fail = 0; function ok(c, n){ if(c){ pass++; console.log('  ok   - '+n); } else { fail++; console.log('  FAIL - '+n); } }
['web/index.html','web/privacy.html','web/terms.html'].forEach(function(f){
  var p = path.join(__dirname, '..', f); if(!fs.existsSync(p)) return;
  var html = fs.readFileSync(p, 'utf8'), re = /<script(?![^>]*\bsrc=)(?![^>]*type="text\/x-)[^>]*>([\s\S]*?)<\/script>/g, m, n = 0;
  while((m = re.exec(html))){
    n++; var line0 = html.slice(0, m.index).split('\n').length, msg = '';
    try{ acorn.parse(m[1], {ecmaVersion:5}); }catch(e){ msg = e.message.replace(/\s*\(\d+:\d+\)$/, '')+' di baris '+((e.loc ? e.loc.line : 1) + line0 - 1); }
    ok(!msg, f+' script #'+n+' ES5'+(msg ? ' — '+msg : ''));
  }
});
console.log('\n'+pass+' lulus, '+fail+' gagal'); process.exit(fail ? 1 : 0);

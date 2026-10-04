// Builds dist/bookmarklet.txt — paste it as the URL of a bookmark, open any page on your phone or
// in desktop device mode, tap the bookmark. Results show in a small panel and in the console.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const audit = readFileSync(new URL('../src/audit.js', import.meta.url), 'utf8')
  .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
const panel = `
(function(){
  var r = mobileFeelAudit([]);
  console.log('[mobile-feel-audit]', r); try { console.table(r.checks.map(function(c){return {id:c.id,severity:c.severity,status:c.status,count:c.count};})); } catch(e) {}
  var old = document.getElementById('mfa-panel'); if (old) old.remove();
  var d = document.createElement('div'); d.id = 'mfa-panel';
  d.style.cssText = 'position:fixed;left:8px;right:8px;bottom:8px;max-height:60vh;overflow:auto;z-index:2147483647;background:#fff;color:#111;font:13px/1.4 system-ui,sans-serif;border:1px solid #ccc;border-radius:10px;padding:10px 12px;box-shadow:0 6px 24px rgba(0,0,0,.2)';
  var esc = function(s){return String(s).replace(/[&<>]/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[m];});};
  var rows = r.checks.filter(function(c){return c.status==='fail';}).map(function(c){
    return '<li style="margin:6px 0"><b>'+esc(c.id)+'</b> · '+c.severity+' · '+c.count+'<br>'+esc(c.message)+'<br><i>fix: '+esc(c.fix)+'</i></li>';}).join('');
  d.innerHTML = '<div style="display:flex;justify-content:space-between;gap:8px"><b>mobile-feel-audit</b><button id="mfa-x" style="border:0;background:none;font-size:18px">×</button></div>'+
    '<div>'+r.summary.error+' error · '+r.summary.warn+' warn · '+r.summary.info+' info'+(r.unreadableStylesheets?' · '+r.unreadableStylesheets+' cross-origin stylesheet(s) not checked':'')+'</div>'+
    (rows ? '<ul style="padding-left:18px;margin:6px 0 0">'+rows+'</ul>' : '<div>No tells found.</div>');
  document.body.appendChild(d); document.getElementById('mfa-x').onclick = function(){ d.remove(); };
})();`;
const code = `${audit}\n${panel}`;
mkdirSync(new URL('../dist/', import.meta.url), { recursive: true });
writeFileSync(new URL('../dist/bookmarklet.txt', import.meta.url), 'javascript:' + encodeURIComponent(code.replace(/\n\s*/g, '\n')));
writeFileSync(new URL('../dist/bookmarklet.js', import.meta.url), code);
console.log('dist/bookmarklet.txt written');

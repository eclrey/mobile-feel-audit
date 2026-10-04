function mobileFeelAudit(extraCss) {
  extraCss = extraCss || [];
  const checks = [];
  const add = (id, severity, failed, count, samples, message, fix) =>
    checks.push({ id, severity, status: failed === null ? 'skip' : failed ? 'fail' : 'pass',
      count: count || 0, samples: (samples || []).slice(0, 5), message, fix });
  const visible = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const label = (el) => {
    const t = (el.getAttribute('aria-label') || el.textContent || el.name || el.id || '').trim().replace(/\s+/g, ' ');
    return el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (t ? ' "' + t.slice(0, 24) + '"' : '');
  };

  const styleRules = []; let unreadable = 0; const cssTexts = [];
  const HOVER_GATE = /\((any-)?hover\s*:\s*hover\)/;
  const walk = (rules, gated) => {
    for (const r of rules) {
      const media = r.media && r.media.mediaText;
      const g = gated || (media ? HOVER_GATE.test(media) : false) ||
        (r.conditionText ? HOVER_GATE.test(r.conditionText) : false);
      if (r.selectorText !== undefined) styleRules.push({ rule: r, gated: g });
      if (r.cssRules && r.cssRules.length) walk(r.cssRules, g);
    }
  };
  for (const sheet of document.styleSheets) {
    try { walk(sheet.cssRules, false); cssTexts.push([...sheet.cssRules].map(r => r.cssText).join('\n')); }
    catch (e) { unreadable++; }
  }
  for (const text of extraCss) {
    try { const s = new CSSStyleSheet(); s.replaceSync(text); walk(s.cssRules, false); cssTexts.push(text); unreadable--; }
    catch (e) { /* unparsable — stays unreadable */ }
  }
  const allCss = cssTexts.join('\n');

  const vpEl = document.querySelector('meta[name="viewport"]');
  const vp = vpEl ? vpEl.content : '';
  add('viewport', 'error', !/width\s*=\s*device-width/.test(vp), vp ? 0 : 1, vp ? [vp] : [],
    'Without width=device-width phones render a zoomed-out desktop page.',
    '<meta name="viewport" content="width=device-width, initial-scale=1">');
  const maxScale = (vp.match(/maximum-scale\s*=\s*([\d.]+)/) || [])[1];
  const zoomBlocked = /user-scalable\s*=\s*(no|0)/.test(vp) || (maxScale !== undefined && parseFloat(maxScale) <= 1);
  add('zoom-blocked', 'error', zoomBlocked, zoomBlocked ? 1 : 0, zoomBlocked ? [vp] : [],
    'Blocking pinch-zoom is an accessibility failure; it is usually a workaround for input zoom.',
    'Remove user-scalable=no / maximum-scale=1 and give inputs a 16px font size instead.');

  const fields = [...document.querySelectorAll('input, textarea, select')].filter(el =>
    !/^(hidden|checkbox|radio|range|color|file|submit|button|reset|image)$/.test(el.type || '') && visible(el));
  const small = fields.filter(el => parseFloat(getComputedStyle(el).fontSize) < 16);
  add('input-font-size', 'error', fields.length ? small.length > 0 : null, small.length,
    small.map(el => label(el) + ' ' + getComputedStyle(el).fontSize),
    'iOS Safari zooms into inputs under 16px and does not zoom back out.',
    'input, textarea, select { font-size: 16px } (or max(16px, 1rem)).');

  const over = document.documentElement.scrollWidth - document.documentElement.clientWidth;
  add('horizontal-overflow', 'error', over > 0, over > 0 ? over : 0, over > 0 ? [over + 'px wider than the viewport'] : [],
    'Content wider than the screen lets the whole page slide sideways.',
    'Find the wide element (often a table, pre, or fixed width) and let it wrap or scroll inside itself.');

  const us = (el) => { const s = getComputedStyle(el); return s.userSelect || s.webkitUserSelect; };
  const bodyLocked = us(document.body) === 'none' || us(document.documentElement) === 'none';
  add('body-user-select', 'error', bodyLocked, bodyLocked ? 1 : 0, bodyLocked ? ['user-select: none on html/body'] : [],
    'Users copy addresses, order numbers and error messages; locking all text blocks that.',
    'Put user-select: none only on controls (buttons, tabs, drag handles).');

  const hover = styleRules.filter(x => /:hover/.test(x.rule.selectorText));
  const ungated = hover.filter(x => !x.gated);
  add('sticky-hover', 'warn', hover.length ? ungated.length > 0 : null, ungated.length,
    ungated.map(x => x.rule.selectorText.slice(0, 60)),
    'On touch screens a tap applies :hover and it stays until the next tap elsewhere.',
    'Wrap hover styles in @media (hover: hover) and (pointer: fine); give touch users :active feedback.');

  const vw = document.documentElement.clientWidth;
  const onscreen = (el) => { const r = el.getBoundingClientRect(); // skip links parked off-screen are not targets
    return r.right > 0 && r.left < vw && r.bottom + scrollY > 0; };
  const taps = [...document.querySelectorAll('a[href], button, [role="button"], input[type="submit"], input[type="button"], label[for], summary')]
    .filter(el => visible(el) && onscreen(el));
  const alpha = (c) => { const m = (c || '').match(/rgba?\(([^)]+)\)/); if (!m) return c === 'transparent' ? 0 : null;
    const p = m[1].split(',').map(s => s.trim()); return p.length === 4 ? parseFloat(p[3]) : 1; };
  const thc = (el) => getComputedStyle(el).getPropertyValue('-webkit-tap-highlight-color');
  const supported = taps.length && alpha(thc(taps[0])) !== null; // non-WebKit/Blink engines have no such property
  const flashing = supported ? taps.filter(el => alpha(thc(el)) > 0) : [];
  add('tap-highlight', 'warn', supported ? flashing.length > 0 : null, flashing.length,
    flashing.slice(0, 5).map(el => label(el) + ' ' + thc(el)),
    'Mobile browsers paint a translucent box over tapped elements — the loudest "this is a website" signal.',
    'html { -webkit-tap-highlight-color: transparent } and give every tappable an :active state.');

  const noManip = taps.filter(el => !/manipulation|none|pan-/.test(getComputedStyle(el).touchAction));
  add('touch-action', 'info', taps.length ? noManip.length === taps.length : null, noManip.length,
    noManip.slice(0, 5).map(label),
    'Without touch-action: manipulation some taps still wait for a possible double-tap.',
    'button, a, [role="button"] { touch-action: manipulation }');

  const tiny = taps.filter(el => {
    if (el.tagName === 'LABEL') return false; // its input is the equivalent target (WCAG 2.5.8 exception)
    const r = el.getBoundingClientRect(); if (r.width >= 24 && r.height >= 24) return false;
    const s = getComputedStyle(el);
    if (el.tagName === 'A' && s.display === 'inline' && el.parentElement &&
        el.parentElement.textContent.trim().length > el.textContent.trim().length + 10) return false;
    return true;
  });
  add('tap-target-size', 'warn', taps.length ? tiny.length > 0 : null, tiny.length,
    tiny.map(el => { const r = el.getBoundingClientRect(); return label(el) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height); }),
    'Targets under 24x24 CSS px are easy to miss with a thumb (WCAG 2.5.8).',
    'Grow the hit area with padding or min-height/min-width; keep the visual size if you like.');

  const vhRules = styleRules.filter(x => ['height', 'min-height', 'max-height']
    .some(p => /(^|[^\w.])100vh/.test(x.rule.style ? x.rule.style.getPropertyValue(p) : '')));
  const vhInline = [...document.querySelectorAll('[style*="100vh"]')];
  const vhCount = vhRules.length + vhInline.length;
  add('viewport-height', 'warn', vhCount > 0, vhCount,
    vhRules.map(x => x.rule.selectorText.slice(0, 60)).concat(vhInline.map(label)),
    '100vh is the height with the browser bar hidden, so on load the bottom of the box sits under the bar.',
    'Use 100dvh for app shells and bottom-pinned UI, 100svh for first-screen heroes.');

  const tcs = [...document.querySelectorAll('meta[name="theme-color"]')];
  const cs = document.querySelector('meta[name="color-scheme"]');
  const darkAware = /prefers-color-scheme\s*:\s*dark/.test(allCss) || (cs && /dark/.test(cs.content)) ||
    /dark/.test(getComputedStyle(document.documentElement).colorScheme || '');
  const perScheme = tcs.some(m => /prefers-color-scheme/.test(m.media || ''));
  add('theme-color', 'warn', tcs.length === 0, tcs.length === 0 ? 1 : 0, [],
    'Without theme-color the status bar and browser chrome do not match the page.',
    '<meta name="theme-color" content="#ffffff"> matching the top of the page.');
  add('theme-color-dark', 'info', tcs.length && darkAware ? !perScheme : null, tcs.length && darkAware && !perScheme ? 1 : 0, [],
    'The page has a dark mode but one theme-color, so one scheme gets a mismatched status bar.',
    'Add one theme-color per scheme with media="(prefers-color-scheme: dark)".');

  const cover = /viewport-fit\s*=\s*cover/.test(vp);
  add('safe-area', 'warn', cover ? !/safe-area-inset/.test(allCss) : null, cover && !/safe-area-inset/.test(allCss) ? 1 : 0, [],
    'viewport-fit=cover draws under the notch and home bar; without env(safe-area-inset-*) content goes there too.',
    'Pad fixed headers, bottom bars and sheets with env(safe-area-inset-top/bottom, 0px).');

  const KB = [[/e-?mail/i, 'email', 'email'], [/phone|tel|mobile/i, 'tel', 'tel'], [/zip|postal|biz.?no|amount|qty|quantity|otp|code/i, null, 'numeric']];
  const wrongKb = fields.filter(el => el.tagName === 'INPUT' && (el.type || 'text') === 'text').filter(el => {
    const key = (el.name || '') + ' ' + (el.id || '') + ' ' + (el.autocomplete || '');
    const hit = KB.find(k => k[0].test(key)); if (!hit) return false;
    return !(el.inputMode === hit[2] || el.inputMode === 'decimal');
  });
  add('input-keyboard', 'info', fields.length ? wrongKb.length > 0 : null, wrongKb.length, wrongKb.map(label),
    'Fields for email, phone or numbers open the full text keyboard.',
    'Use type="email" / type="tel", or inputmode="numeric" / "decimal".');

  const summary = { error: 0, warn: 0, info: 0 };
  for (const c of checks) if (c.status === 'fail') summary[c.severity]++;
  return { tool: 'mobile-feel-audit', version: '0.1.1', url: location.href,
    viewport: { width: innerWidth, height: innerHeight }, unreadableStylesheets: Math.max(0, unreadable),
    summary, checks };
}


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
})();
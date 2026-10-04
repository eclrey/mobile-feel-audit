import { readFileSync } from 'node:fs';
import { launch } from './chrome.mjs';

export const AUDIT_SOURCE = readFileSync(new URL('./audit.js', import.meta.url), 'utf8');
const MOBILE_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const UNREADABLE = `[...document.styleSheets].filter(s=>{try{s.cssRules;return false}catch(e){return true}}).map(s=>s.href).filter(Boolean)`;

async function fetchCss(hrefs, timeoutMs = 8000) {
  const out = [];
  for (const href of hrefs.slice(0, 20)) {
    try {
      const r = await fetch(href, { signal: AbortSignal.timeout(timeoutMs) });
      if (r.ok) out.push(await r.text());
    } catch { /* leave it unreadable */ }
  }
  return out;
}

/** Audit each URL in a phone-sized, touch-enabled headless Chrome. Returns one result per URL. */
export async function audit(urls, { width = 390, height = 844, dark = false, chromePath, settleMs = 800 } = {}) {
  const browser = await launch({ chromePath });
  const results = [];
  try {
    for (const url of urls) {
      const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' });
      const { sessionId } = await browser.send('Target.attachToTarget', { targetId, flatten: true });
      const s = (m, p) => browser.send(m, p, sessionId);
      try {
        await s('Page.enable');
        await s('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 3, mobile: true });
        await s('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
        await s('Emulation.setUserAgentOverride', { userAgent: MOBILE_UA });
        await s('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' }] });
        const loaded = browser.once('Page.loadEventFired', sessionId);
        const nav = await s('Page.navigate', { url });
        if (nav.errorText) throw new Error(`${url}: ${nav.errorText}`);
        await loaded;
        await new Promise((r) => setTimeout(r, settleMs));
        const hrefs = (await s('Runtime.evaluate', { expression: UNREADABLE, returnByValue: true })).result.value || [];
        const extra = await fetchCss(hrefs);
        const expr = `${AUDIT_SOURCE}\n;mobileFeelAudit(${JSON.stringify(extra)})`;
        const r = await s('Runtime.evaluate', { expression: expr, returnByValue: true });
        if (r.exceptionDetails) throw new Error(`${url}: ${r.exceptionDetails.exception?.description || r.exceptionDetails.text}`);
        results.push(r.result.value);
      } catch (e) {
        results.push({ tool: 'mobile-feel-audit', url, error: e.message });
      } finally {
        await browser.send('Target.closeTarget', { targetId }).catch(() => {});
      }
    }
  } finally {
    browser.close();
  }
  return results;
}

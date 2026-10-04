import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { audit } from '../src/run.mjs';
import { findChrome } from '../src/chrome.mjs';

const fixture = (name) => pathToFileURL(new URL(`./fixtures/${name}`, import.meta.url).pathname).href;
const byId = (r) => Object.fromEntries(r.checks.map((c) => [c.id, c]));
const skip = findChrome() ? false : 'no Chrome/Chromium found (set CHROME_PATH)';

test('bad fixture fails the checks it was built to fail', { skip }, async () => {
  const [r] = await audit([fixture('bad.html')]);
  assert.equal(r.error, undefined, r.error);
  const c = byId(r);
  for (const id of ['zoom-blocked', 'input-font-size', 'horizontal-overflow', 'body-user-select', 'sticky-hover',
    'viewport-height', 'theme-color', 'safe-area', 'tap-target-size', 'input-keyboard', 'touch-action']) {
    assert.equal(c[id].status, 'fail', `${id} should fail`);
  }
  assert.equal(c['sticky-hover'].count, 2);
  assert.equal(c['input-font-size'].count, 2);
  assert.equal(c['input-keyboard'].count, 2);
  assert.equal(c.viewport.status, 'pass');
});

test('good fixture passes every check', { skip }, async () => {
  const [r] = await audit([fixture('good.html')]);
  assert.equal(r.error, undefined, r.error);
  const failed = r.checks.filter((c) => c.status === 'fail').map((c) => `${c.id}: ${c.samples.join(', ')}`);
  assert.deepEqual(failed, []);
  assert.deepEqual(r.summary, { error: 0, warn: 0, info: 0 });
});

test('bookmarklet runs and shows a panel', { skip }, async () => {
  const { readFileSync } = await import('node:fs');
  const { launch } = await import('../src/chrome.mjs');
  const text = readFileSync(new URL('../dist/bookmarklet.txt', import.meta.url), 'utf8');
  const code = decodeURIComponent(text.slice('javascript:'.length));
  const b = await launch();
  try {
    const { targetId } = await b.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await b.send('Target.attachToTarget', { targetId, flatten: true });
    await b.send('Page.enable', {}, sessionId);
    const loaded = b.once('Page.loadEventFired', sessionId);
    await b.send('Page.navigate', { url: fixture('bad.html') }, sessionId);
    await loaded;
    await b.send('Runtime.evaluate', { expression: code }, sessionId);
    const r = await b.send('Runtime.evaluate', { expression: "document.getElementById('mfa-panel')?.textContent || ''", returnByValue: true }, sessionId);
    assert.match(r.result.value, /mobile-feel-audit/);
    assert.match(r.result.value, /sticky-hover/);
  } finally { b.close(); }
});

test('unreachable URL is reported, not thrown', { skip }, async () => {
  const [r] = await audit(['http://127.0.0.1:9/nothing-here']);
  assert.match(r.error, /ERR_/);
});

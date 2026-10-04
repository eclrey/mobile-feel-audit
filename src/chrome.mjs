// Minimal Chrome DevTools Protocol driver — no dependencies (Node 22+ has a global WebSocket).
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CANDIDATES = {
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  ],
  linux: ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium'],
  win32: [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ],
};

export function findChrome(explicit) {
  const list = [explicit, process.env.CHROME_PATH, ...(CANDIDATES[process.platform] || [])].filter(Boolean);
  return list.find((p) => existsSync(p)) || null;
}

export async function launch({ chromePath, timeoutMs = 15000 } = {}) {
  const bin = findChrome(chromePath);
  if (!bin) throw new Error('No Chrome/Chromium/Edge found. Set CHROME_PATH or pass --chrome <path>.');
  const dir = mkdtempSync(join(tmpdir(), 'mfa-'));
  const proc = spawn(bin, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${dir}`,
    '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore' });
  const portFile = join(dir, 'DevToolsActivePort');
  const start = Date.now();
  while (!existsSync(portFile)) {
    if (Date.now() - start > timeoutMs) { proc.kill(); throw new Error('Chrome did not start in time.'); }
    await new Promise((r) => setTimeout(r, 100));
  }
  const [port, path] = readFileSync(portFile, 'utf8').split('\n');
  const ws = new WebSocket(`ws://127.0.0.1:${port}${path}`);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const waiting = new Map(); const listeners = [];
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); }
    else if (m.method) for (const l of listeners) l(m);
  };
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const i = ++id;
    waiting.set(i, (m) => (m.error ? reject(new Error(`${method}: ${m.error.message}`)) : resolve(m.result)));
    ws.send(JSON.stringify({ id: i, method, params, sessionId }));
  });
  const once = (method, sessionId, ms = 30000) => new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), ms);
    t.unref(); // a navigation that fails early must not keep the process alive
    listeners.push(function l(m) {
      if (m.method === method && m.sessionId === sessionId) { clearTimeout(t); listeners.splice(listeners.indexOf(l), 1); resolve(m); }
    });
  });
  const close = () => { try { ws.close(); } catch {} proc.kill(); try { rmSync(dir, { recursive: true, force: true }); } catch {} };
  return { send, once, close };
}

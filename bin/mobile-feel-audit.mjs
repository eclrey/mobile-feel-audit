#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { audit } from '../src/run.mjs';

const HELP = `mobile-feel-audit — find the tells that make a web app feel like a website on a phone.

Usage: mobile-feel-audit <url | file.html> [more ...] [options]

Options
  --json             print JSON (one array of results)
  --width <px>       viewport width (default 390)
  --height <px>      viewport height (default 844)
  --dark             emulate prefers-color-scheme: dark
  --fail-on <level>  exit 1 when a check fails at this level or above: error | warn | info | none (default error)
  --chrome <path>    Chrome/Chromium/Edge binary (or set CHROME_PATH)
  -h, --help         show this help

Runs a local headless Chrome you already have. Nothing is sent anywhere except requests to the pages you audit.`;

const args = process.argv.slice(2);
if (!args.length || args.includes('-h') || args.includes('--help')) { console.log(HELP); process.exit(args.length ? 0 : 2); }
const opt = { json: false, width: 390, height: 844, dark: false, failOn: 'error', chrome: undefined };
const urls = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--json') opt.json = true;
  else if (a === '--dark') opt.dark = true;
  else if (a === '--width') opt.width = Number(args[++i]);
  else if (a === '--height') opt.height = Number(args[++i]);
  else if (a === '--fail-on') opt.failOn = args[++i];
  else if (a === '--chrome') opt.chrome = args[++i];
  else if (a.startsWith('-')) { console.error(`Unknown option ${a}\n\n${HELP}`); process.exit(2); }
  else if (/^[a-z]+:\/\//i.test(a)) urls.push(a);
  else if (existsSync(a)) urls.push(pathToFileURL(resolve(a)).href); // a local .html file
  else urls.push(`https://${a}`);
}
const LEVELS = ['error', 'warn', 'info'];
if (![...LEVELS, 'none'].includes(opt.failOn)) { console.error('--fail-on must be error, warn, info or none'); process.exit(2); }

let results;
try {
  results = await audit(urls, { width: opt.width, height: opt.height, dark: opt.dark, chromePath: opt.chrome });
} catch (e) { console.error(e.message); process.exit(2); }

const ICON = { fail: { error: '✗', warn: '!', info: '·' }, pass: '✓', skip: '-' };
if (opt.json) console.log(JSON.stringify(results, null, 2));
else for (const r of results) {
  console.log(`\n${r.url}`);
  if (r.error) { console.log(`  could not audit: ${r.error}`); continue; }
  console.log(`  ${r.viewport.width}x${r.viewport.height} · ${r.summary.error} error · ${r.summary.warn} warn · ${r.summary.info} info` +
    (r.unreadableStylesheets ? ` · ${r.unreadableStylesheets} stylesheet(s) unreadable` : ''));
  for (const c of r.checks) {
    const icon = c.status === 'fail' ? ICON.fail[c.severity] : ICON[c.status];
    console.log(`  ${icon} ${c.id.padEnd(20)} ${c.status === 'fail' ? `${c.severity.padEnd(5)} ${c.count}` : c.status}`);
    if (c.status === 'fail') {
      console.log(`      ${c.message}`);
      for (const s of c.samples) console.log(`      - ${s}`);
      console.log(`      fix: ${c.fix}`);
    }
  }
}
const limit = opt.failOn === 'none' ? -1 : LEVELS.indexOf(opt.failOn);
const failed = results.some((r) => r.error || r.checks.some((c) => c.status === 'fail' && LEVELS.indexOf(c.severity) <= limit));
process.exit(failed ? 1 : 0);

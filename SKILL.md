---
name: mobile-feel-audit
description: Audit a web page for the tells that make it feel like a website on a phone (sticky hover, tap highlight flash, 100vh under the address bar, inputs under 16px that make iOS zoom, tiny tap targets, missing theme-color, safe-area, blocked zoom) and fix them with the project's own styles. Use after building or changing any page that people open on phones, before shipping a mobile-facing change, or when someone says a site "feels janky on my phone".
---

# mobile-feel-audit

## Run

```bash
npx github:eclrey/mobile-feel-audit <url> [more urls] --json --fail-on none
```

Use the dev server URL for local work (for example `http://localhost:3000/checkout`). Audit the pages people actually use on phones: landing, sign-in, the main form, checkout. Add `--dark` if the site has a dark mode. Needs Node 22+ and a local Chrome, Chromium, Edge or Brave (`CHROME_PATH` if it is somewhere unusual).

## Read the result

Each URL gives `summary` plus `checks[]` with `id`, `severity` (error / warn / info), `status` (pass / fail / skip), `count`, `samples` (elements or selectors) and a one-line `fix`. `skip` means the check did not apply (no inputs, no hover rules). `unreadableStylesheets > 0` means some cross-origin CSS could not be fetched, so hover and vh checks may be incomplete. Say so.

## Fix

Fix in the project's stylesheet and tokens. Do not paste a new reset.

- **errors first**: `zoom-blocked` (remove `user-scalable=no` / `maximum-scale=1` and fix the input size instead), `input-font-size` (16px minimum on inputs), `horizontal-overflow` (find the wide element), `body-user-select` (move `user-select: none` to controls only).
- **sticky-hover**: move each `:hover` rule into `@media (hover: hover) and (pointer: fine)`. Add an `:active` state so touch users still get feedback.
- **tap-highlight**: `html { -webkit-tap-highlight-color: transparent }`, with `:active` styles on tappables.
- **viewport-height**: `100dvh` for app shells and bottom-pinned UI, `100svh` for first-screen heroes. Keep `100vh` only as a fallback line before them.
- **theme-color**: one `<meta name="theme-color">` matching the top of the page. Use one per color scheme if there is a dark mode.
- **tap-target-size**: grow the hit area with padding or `min-height`. The icon can stay small.
- **touch-action / input-keyboard** (info): `touch-action: manipulation` on buttons and links; `type="email"` / `type="tel"` / `inputmode="numeric"` on matching fields.

Then run the audit again and report before → after counts per check. Say what still needs a real phone to confirm (sticky hover, tap delay, address bar, keyboard). Do not claim those are fixed from emulation alone.

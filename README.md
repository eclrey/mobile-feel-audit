# mobile-feel-audit

Find the small things that make a web app feel like *a website in a browser* on a phone, instead of something installed.

Lighthouse tells you about speed and the viewport tag. It does not tell you that a button stays highlighted after you tap it, that the page flashes gray on every tap, that your full-height layout hides its bottom bar under the address bar, or that iOS zooms into your form and never zooms back. This tool checks those, on any URL, in one pass.

- **Zero dependencies.** It drives the Chrome, Chromium, Edge or Brave you already have over the DevTools protocol. Nothing to download.
- **Three ways to run it:** a CLI for any URL, a bookmarklet for the page in front of you, and a `SKILL.md` so coding agents can run it and fix what it finds.
- **Nothing leaves your machine** except the requests to the pages you audit.

## What it checks

| Check | Level | What goes wrong on a phone |
|---|---|---|
| `viewport` | error | No `width=device-width`: the phone renders a zoomed-out desktop page |
| `zoom-blocked` | error | `user-scalable=no` / `maximum-scale=1` blocks pinch-zoom (accessibility failure) |
| `input-font-size` | error | Inputs under 16px make iOS Safari zoom in and stay zoomed |
| `horizontal-overflow` | error | The page is wider than the screen and slides sideways |
| `body-user-select` | error | `user-select: none` on the whole page blocks copying addresses and order numbers |
| `sticky-hover` | warn | `:hover` rules outside `@media (hover: hover)` stick after a tap |
| `tap-highlight` | warn | The browser paints a translucent box over every tapped element |
| `viewport-height` | warn | `100vh` includes the hidden browser bar, so bottom UI starts under it |
| `tap-target-size` | warn | Targets under 24×24 px (WCAG 2.5.8; inline text links excepted) |
| `theme-color` | warn | No `theme-color`: the status bar does not match the page |
| `safe-area` | warn | `viewport-fit=cover` without `env(safe-area-inset-*)` puts content under the notch |
| `theme-color-dark` | info | Dark mode exists but there is only one `theme-color` |
| `touch-action` | info | No `touch-action: manipulation` on tappables (some taps still wait for a double-tap) |
| `input-keyboard` | info | Email, phone or number fields open the full text keyboard |

Every failed check comes with the elements or selectors it found and a one-line fix.

## Run it

```bash
# any URL, phone-sized (390×844), touch on
npx github:eclrey/mobile-feel-audit https://example.com

# several pages, JSON out, fail CI on warnings too
npx github:eclrey/mobile-feel-audit https://example.com https://example.com/checkout --json --fail-on warn
```

Options: `--width`, `--height`, `--dark` (emulate dark mode), `--fail-on error|warn|info|none` (default `error`), `--chrome <path>` (or `CHROME_PATH`). Needs Node 22+.

Or clone and run `node bin/mobile-feel-audit.mjs <url>`.

**Bookmarklet:** run `npm run build`, then make a bookmark whose URL is the content of `dist/bookmarklet.txt`. Open a page on your phone (or desktop device mode) and tap it. A small panel lists what it found. Cross-origin stylesheets cannot be read from inside a page, so the bookmarklet skips them; the CLI fetches and checks them.

**Agents:** point your coding agent at [`SKILL.md`](SKILL.md). It runs the CLI, reads the JSON, and fixes what it can with the project's own tokens.

## Limits

These are signals read from the code and the rendered page in an emulated phone. Sticky hover, tap delay, the address bar and the keyboard are real-hardware behaviors: confirm the fixes on a real phone. The checks flag patterns, not intent. A `100vh` on a print stylesheet or an intentionally small icon button can be fine, so read the samples before you change things.

## Why we built it

We run a few small web products and ran this checklist by hand on four of our own pages. Every one of them had four or five of these issues, and our existing 375px review did not catch any of them. Fixing them takes about ten lines of CSS and two meta tags, so we wanted a one-command check we could run on every page and every agent change.

## Credits

The checklist was shaped by Emil Kowalski's [`mobile-native`](https://github.com/emilkowalski/skills) skill (MIT), a guide for making web apps feel native on phones. This tool turns those rules into automated checks; the wording and code here are our own.

## 한국어

웹앱이 휴대폰에서 "앱"이 아니라 "브라우저 속 웹사이트"처럼 느껴지게 만드는 작은 결함을 한 번에 찾는 도구입니다. 탭 뒤에 남는 hover, 탭할 때 번쩍임, 주소창 때문에 가려지는 `100vh`, 16px 미만 입력칸의 iOS 확대, 너무 작은 터치 영역, 상태바 색 같은 것들입니다. 설치할 것 없이 이미 깔린 크롬으로 돌고, CLI · 북마클릿 · 에이전트용 `SKILL.md` 로 씁니다. 우리 화면 네 곳에 손으로 돌려 보니 모두 4~5건씩 나왔고, 기존 375px 점검은 하나도 잡지 못했습니다.

## License

MIT © eclrey

# Contributing

Thanks for helping make Too Smart To Be Tube better! This guide covers how to set up the project and what a good
pull request looks like.

## Getting started

```sh
git clone https://github.com/iagosaito/too-smart-to-be-tube.git
cd too-smart-to-be-tube
npm install
npm run build
```

Load the folder as an unpacked extension (see the [README](README.md#installation)), then open youtube.com.

| Command | What it does |
| --- | --- |
| `npm run build` | Bundles `src/content/main.js` into `dist/content.js` |
| `npm run watch` | Rebuilds on every change |
| `npm test` | Runs the unit tests (Vitest + jsdom) |
| `npm run lint` | Runs ESLint |

After rebuilding, click **Reload** on the extension in `chrome://extensions` **and refresh the YouTube tab**: a
tab that stays open keeps running the old script.

## Guidelines

- **Small, readable functions.** Aim for functions of roughly 5–25 lines with a single responsibility.
- **Comments explain why, not what.** The code says what it does; comments record the decision behind it
  (a YouTube quirk, a browser limitation, a UX trade-off). Write them in English.
- **Keep YouTube selectors in one place.** All DOM selectors live in `src/dom/selectors.js`, so a YouTube
  redesign is fixed in a single file.
- **Never use `innerHTML`.** YouTube enforces Trusted Types, and channel names are untrusted input. Build DOM
  with the `el()` helper in `src/ui/elements.js`.
- **Pure logic goes in `src/core`.** Code there must not touch the DOM or `chrome.*`, which keeps it trivial to
  test.
- **Minimal permissions.** The extension only requests `storage`. Changes that need new permissions must justify
  them in the pull request.

## Adding a language

The interface language follows YouTube's `<html lang>`; translations live in `src/i18n/locales/`.

1. Copy `src/i18n/locales/en.js` to a new file named after the language code (e.g. `fr.js`) and translate every
   value. Keys with `{ one, other }` are plurals; keep the `{placeholders}` as they are.
2. Register it in `DICTIONARIES` and add its full tag (e.g. `fr: 'fr'`) to `LOCALE_TAGS` in
   `src/i18n/i18n.js`.
3. Add `_locales/<code>/messages.json` with the extension name and description.
4. Run `npm test`: the dictionary parity test fails if any key is missing or has a different shape.

The CSV format stays in English on purpose, so files work the same in every language.

## Tests

Every change ships with tests. For **bug fixes**, write a test that reproduces the bug first, check that it
fails for the right reason, then fix the code and watch it pass. That test stays as a regression guard.

## Checking on real YouTube

Unit tests run on jsdom and fixtures. Some behavior only shows on the real site: YouTube's router rewriting
URLs, its layout reacting to our DOM, its SPA navigation events. `npm run e2e:youtube` builds the extension and
runs scenarios from `tests/e2e/youtube/scenarios/` on youtube.com in headless Chrome:

```sh
npm run e2e:youtube                 # every scenario
npm run e2e:youtube -- category-url # just one
```

Each step prints ✓ or ✗; a failure saves a screenshot in `tests/e2e/youtube/output/` and exits non-zero. Set
`CHROME_PATH` if Chrome isn't on your `PATH` as `google-chrome`.

Limits to keep in mind:

- The session is **logged out**, so anything that needs the account (the subscriptions sync) can't run here.
- The extension is **injected**, not loaded (branded Chrome 137+ ignores `--load-extension`). It runs in the
  page's main world with a fake `chrome.storage.local` seeded from `tests/e2e/youtube/seed.js`.
- It talks to the real youtube.com, so it isn't part of CI.

Run it after changing DOM selectors, SPA navigation, URLs and history, or how the feed loads and scrolls. A
scenario is a file exporting `{ description, seed, steps }`, where each step has a `label`, an `action(browser)`
and an `expect` with any of `url`, `open`, `tab`, `sidebarEntry` and `lastHistory` (see `harness.js`).

## Pull requests

1. Create a branch from `main`.
2. Keep the change focused; unrelated refactors belong in a separate pull request.
3. Make sure `npm run lint` and `npm test` pass locally. CI runs them on Node 22 and 24, along with CodeQL and a
   dependency review.
4. For visual changes, attach screenshots in both light and dark themes.

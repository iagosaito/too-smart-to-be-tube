# Too Smart To Be Tube

Chrome MV3 extension that organizes YouTube subscriptions into categories, drawn inside YouTube itself: a
Categories section in the sidebar and a page with a feed per category (Videos · Shorts · Channels).

@CONTRIBUTING.md

## Map

| Folder | What lives there |
| --- | --- |
| `src/content/` | Entry point (`main.js`): SPA wiring, sidebar setup, sync coordinator, opening the page from its URL |
| `src/core/` | Pure rules for channels, categories and text (no DOM, no `chrome.*`) |
| `src/dom/` | YouTube selectors (single source), sidebar injection, DOM scraping, `waitFor` |
| `src/feed/` | Per-category feed: ordering, controller (pages of 24, batches of 8 channels), channel tab cache |
| `src/sync/` | Request queue shared across tabs, sync coordinator |
| `src/storage/` | `chrome.storage.local` access; the store is injected so tests use a fake |
| `src/ui/` | The Categories page: render, components, view rules, URL route |
| `src/youtube/` | InnerTube requests and parsing (subscriptions, feed, channel tabs) |
| `src/i18n/`, `src/import/`, `src/export/` | Translations (en/pt/es), CSV import/export (format always English) |
| `tests/` | Vitest + jsdom unit tests; `tests/e2e/youtube/` runs on the real site |

## Commands

| Command | Use |
| --- | --- |
| `npm run lint` | ESLint |
| `npm test` | Unit tests (`npx vitest run <file>` for one file) |
| `npm run build` | Bundle to `dist/content.js` |
| `npm run e2e:youtube [-- scenario]` | Build and check on real youtube.com (see CONTRIBUTING) |

Run lint, tests and build before every commit. Run `npm run e2e:youtube` after changing DOM selectors, SPA
navigation, URLs and history, or how the feed loads and scrolls.

## Workflow

- **Bug fixes are test-first.** Reproduce the bug in a test and watch it fail for the right reason. Fix it.
  Then revert the fix for a moment and confirm the test fails again: a test that passes either way guards
  nothing. Keep it as a regression test whose header comment starts with `// Regression:`. A design decision
  the user disagrees with is not a bug: just change it. `/bug-fix` walks through this.
- **Security fixes get their own branch and PR.** Other changes: one concern per PR.
- **Never merge, and never push to `main`,** unless the user asks. The user merges with squash. A branch
  stacked on a squash-merged one needs `git rebase --onto main <old-base> <branch>` and a
  `--force-with-lease` push.
- **No legacy code.** The extension is not published yet, so there are no users to migrate: change formats and
  keys directly, without compatibility or cleanup code for the old ones.
- **Everything in the repo is in English:** code comments, test names, commit messages, PR titles and bodies,
  and issues. Only UI strings are translated, in `src/i18n/locales/` (all three dictionaries, or the parity test
  fails).
- **PR bodies:** What / Why / Checks, with a short manual-testing note when the UI or YouTube integration
  changed.
- **Ideas to study later** become GitHub issues with the problem, the proposal, implementation notes and the
  tests to write.
- **Independent review:** for non-trivial changes, `/independent-review <PR>` runs a fresh, read-only reviewer
  and then verifies its findings before acting on them.

## YouTube facts (verified on the real site)

- **SPA:** the content script runs once. `yt-navigate-start` and `yt-navigate-finish` fire on every page change,
  and YouTube redraws its menus and removes nodes that aren't its own. Our sidebar items are kept in place by
  observers in `src/dom/sidebar.js`.
- **Trusted Types:** `innerHTML` throws. Build DOM with `el()` (`src/ui/elements.js`).
- **Isolated world:** the content script can't read `ytcfg` or `ytInitialData`. They are parsed from the
  downloaded HTML (`src/youtube/pageData.js`).
- **URLs:** YouTube's router drops unknown query parameters right after loading but keeps the fragment, so the
  Categories URL is `/feed/subscriptions#tstb=<category>&tab=<tab>` (`src/ui/categoryRoute.js`).
- **Account safety:**
  - Channel tabs are public and fetched logged out (`credentials: 'omit'`), through the request queue. The
    queue allows 2 concurrent requests, 350 ms between starts, 60 per 10 min, and a 10 min pause on a 429, all
    shared across tabs through storage.
  - Authenticated requests (the subscriptions list and feed) only happen in a sync. A sync runs on opening the
    page when the last one is over 1 h old, in a visible tab only, or from the Sync button (60 s cooldown).
- **Cross-tab:** several YouTube tabs share `chrome.storage.local`. Read right before writing and merge;
  never write back a whole object loaded earlier. Keep `storage.onChanged` payloads small (one key per channel
  and tab for the feed cache).

## Testing conventions

- Test names (`describe`/`it`) and comments are in English. Assertions on UI text use Portuguese, because
  `tests/setup/locale.js` pins the page to pt-BR. `tests/ui/pageLocales.test.js` covers en and es.
- Reuse `tests/helpers/fakeStorage.js` (an in-memory `chrome.storage.local`) and the fixtures in
  `tests/helpers/` and `tests/fixtures/`.
- Content-script tests import `src/content/main.js` once per file: listeners stay registered, so a file is one
  scenario in sequence.
- jsdom's history is real: walk it with `history.back()` and `history.go()` rather than faking `popstate`.
- For races, hold storage calls behind a gate and navigate while they wait
  (see `tests/content/categoryUrlRaces.test.js`).

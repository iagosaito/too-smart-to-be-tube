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
  (a YouTube quirk, a browser limitation, a UX trade-off).
- **Keep YouTube selectors in one place.** All DOM selectors live in `src/dom/selectors.js`, so a YouTube
  redesign is fixed in a single file.
- **Never use `innerHTML`.** YouTube enforces Trusted Types, and channel names are untrusted input. Build DOM
  with the `el()` helper in `src/ui/elements.js`.
- **Pure logic goes in `src/core`.** Code there must not touch the DOM or `chrome.*`, which keeps it trivial to
  test.
- **Minimal permissions.** The extension only requests `storage`. Changes that need new permissions must justify
  them in the pull request.

## Tests

Every change ships with tests. For **bug fixes**, write a test that reproduces the bug first, check that it
fails for the right reason, then fix the code and watch it pass. That test stays as a regression guard.

## Pull requests

1. Create a branch from `main`.
2. Keep the change focused; unrelated refactors belong in a separate pull request.
3. Make sure `npm run lint` and `npm test` pass locally. CI runs them on Node 22 and 24, along with CodeQL and a
   dependency review.
4. For visual changes, attach screenshots in both light and dark themes.

---
name: youtube-check
description: Check the extension on real youtube.com with the headless-Chrome harness (npm run e2e:youtube), read the results, and add a scenario when the change needs one.
argument-hint: "[scenario …]"
---

# Check on real YouTube

Use this after changing DOM selectors, SPA navigation, URLs and history, or how the feed loads and scrolls:
jsdom can't show how YouTube's router and layout react.

1. **Run** `npm run e2e:youtube -- $ARGUMENTS`. With no arguments it runs every scenario in
   `tests/e2e/youtube/scenarios/`. It builds first. A run takes about a minute per scenario, so use a timeout of
   a few minutes.
2. **Read the output.** Each step is ✓ or ✗ with the expected and actual values. A failure saves a screenshot in
   `tests/e2e/youtube/output/`: open it with Read before guessing the cause.
3. **Know the limits** before concluding anything:
   - The session is logged out, so the subscriptions sync can't run. Scenarios seed storage with a fresh sync
     (`tests/e2e/youtube/seed.js`).
   - The extension is injected into the page's main world with a fake `chrome.storage.local`, not loaded:
     branded Chrome 137+ ignores `--load-extension`.
   - The UI runs in English (`--lang=en-US`), so labels are English.
   - YouTube changes over time. When a step fails on something YouTube controls, check the screenshot and say
     so instead of "fixing" the extension.
4. **Add a scenario** when the change has behavior worth keeping:
   - Create a file in `scenarios/` exporting `{ description, seed, steps }`.
   - Each step is `{ label, action: (browser) => …, wait?, expect }`.
   - `browser` offers `navigate`, `reload`, `go`, `click(selector or visible text)`, `evaluate`, `state` and
     `screenshot`.
   - `expect` takes any of `url`, `open`, `tab`, `sidebarEntry` and `lastHistory`. To check something new,
     extend `readState` in `harness.js`.
5. **Report** the step table to the user, and say what was not covered (anything behind login).

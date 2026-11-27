---
name: bug-fix
description: Fix a bug test-first. Reproduce it in a failing test, fix it, prove the test guards the fix, then open a PR.
argument-hint: "<what is broken>"
---

# Bug fix, test-first

Bug: $ARGUMENTS

A design decision the user wants changed is not a bug: change it without this ceremony. This flow is for
behavior that contradicts what the code means to do.

1. **Branch.** Create `fix/<short-name>` from an up-to-date `main`. For a security issue, keep it alone in its
   own branch and PR.
2. **Find the cause** before writing code: trace the path from the trigger to the wrong outcome.
3. **Write the reproducing test.**
   - Put it in the test file that owns the behavior.
   - Start it with a `// Regression: …` comment that says what used to happen and why.
   - Give it an English test name.
   - Use the existing helpers (`tests/helpers/fakeStorage.js`, the fixtures). For races, use a storage gate
     like `tests/content/categoryUrlRaces.test.js` does.
4. **Watch it fail for the right reason.** Run `npx vitest run <file>` and show the failure. A test that fails
   on a typo or a missing import proves nothing.
5. **Fix** with the smallest change that addresses the cause. Comments explain why, in English.
6. **Mutation check.** Revert the fix for a moment (or remove its key line) and run the test again. It must
   fail. Restore the fix and confirm it passes.
7. **Run the checks:** `npm run lint`, `npm test`, `npm run build`. If the bug involved YouTube's DOM,
   navigation, URLs or scrolling, also run `npm run e2e:youtube`, adding a scenario when it helps.
8. **Commit and open the PR, in English.**
   - The commit message describes the bug and the fix.
   - The PR body has What / Why / Checks and names the regression test.
   - Don't merge.

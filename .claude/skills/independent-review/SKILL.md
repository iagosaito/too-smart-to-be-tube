---
name: independent-review
description: Run an independent, read-only review of a pull request (or the current branch) in a fresh agent, then verify its findings before acting on them.
argument-hint: "[PR number]"
---

# Independent review

The reviewer starts cold on purpose: it doesn't share this conversation's assumptions about the change.

1. **Identify the target.** Use the PR number in `$ARGUMENTS`. Without one, use the current branch's PR
   (`gh pr view --json number`), or the branch diff against `main` if there is no PR.
2. **Brief the reviewer** by spawning the `independent-reviewer` agent in the background. Give it:
   - the PR number and branch;
   - what the change is meant to do, in two or three sentences;
   - the key files;
   - the risky areas you already know of (races, history, storage, request budgets, untrusted input).

   Don't hand it your conclusions: it should find problems you missed.
3. **While it runs,** tell the user it started, and what it will look at (correctness, security, quality). Don't
   predict its results.
4. **Verify every finding** when the report arrives. Read the code path yourself. Rerun its reproduction if it
   left one. Separate confirmed bugs from plausible ones and from findings that are wrong.
5. **Report to the user** in their language. Rank the findings by severity, give each a one-line failure
   scenario, and propose fixes. Say plainly which findings you disagree with and why.
6. **Fix only after the user agrees.** Bugs follow `/bug-fix` (a failing test first), inside the same PR.
   Update the PR body with a short "fixed after an independent review" section.

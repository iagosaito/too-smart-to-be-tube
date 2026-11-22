# Security Policy

## Supported versions

Only the latest version on the `main` branch receives security fixes.

## Reporting a vulnerability

Please **do not open a public issue** for security problems.

Report it privately through GitHub:
[Security → Report a vulnerability](https://github.com/iagosaito/too-smart-to-be-tube/security/advisories/new).

Include what you found, how to reproduce it and the impact you expect. You should get a first reply within a
week. Once a fix is released, the advisory will be published with credit to the reporter (unless you prefer to
stay anonymous).

## Scope

Things that are especially relevant for this extension:

- Ways for content from YouTube (channel names, descriptions, video titles) to execute script or inject HTML into
  the Categories page.
- Ways for the extension to send subscription data anywhere other than `chrome.storage.local` and youtube.com.
- Requests made with the user's YouTube session that go beyond reading their own subscriptions and feed.
- Formula injection in exported CSV files.

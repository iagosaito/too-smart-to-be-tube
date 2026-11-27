// The content script runs in an "isolated world": it can't see the page's JS variables (ytcfg,
// ytInitialData). That's why we read this data straight from the downloaded HTML, which YouTube
// embeds in inline <script> tags.

export function extractInitialData(html) {
  // YouTube escapes "<" inside the JSON as <, so "};</script>" only appears at the real end of the
  // object and the non-greedy match is safe.
  const match = html.match(/ytInitialData\s*=\s*(\{.+?\});\s*<\/script>/s);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

export function extractConfig(html) {
  return {
    clientVersion: matchConfigValue(html, 'INNERTUBE_CLIENT_VERSION'),
    apiKey: matchConfigValue(html, 'INNERTUBE_API_KEY'),
    // Index of the logged-in Google account; matters when there are several accounts in the
    // browser.
    sessionIndex: matchConfigValue(html, 'SESSION_INDEX') ?? '0',
    // Present when the user is on a brand account.
    delegatedSessionId: matchConfigValue(html, 'DELEGATED_SESSION_ID'),
  };
}

function matchConfigValue(html, key) {
  // Accepts values with or without quotes because SESSION_INDEX comes as a number.
  const match = html.match(new RegExp(`"${key}"\\s*:\\s*"?([^",}]+)"?`));
  return match ? match[1] : null;
}

// The client version is also in the open page's own <script> tags; reading it from there avoids
// downloading another page just to find it.
export function clientVersionFromDocument(doc = document) {
  for (const script of doc.querySelectorAll('script')) {
    const text = script.textContent;
    if (text.includes('INNERTUBE_CLIENT_VERSION')) return extractConfig(text).clientVersion;
  }
  return null;
}

// Trimmed JSON mimicking the real responses of /feed/channels and /youtubei/v1/browse.

export function channelRenderer(handle, name, { thumb = `//yt3.example/${handle}.jpg`, withHandle = true } = {}) {
  return {
    channelRenderer: {
      channelId: `UC${handle}`,
      title: { simpleText: name },
      thumbnail: { thumbnails: [{ url: `${thumb}?s=88` }, { url: thumb }] },
      navigationEndpoint: { browseEndpoint: withHandle ? { canonicalBaseUrl: `/@${handle}` } : {} },
    },
  };
}

export function continuationItem(token) {
  return { continuationItemRenderer: { continuationEndpoint: { continuationCommand: { token } } } };
}

export function initialData(items) {
  return {
    contents: {
      twoColumnBrowseResultsRenderer: {
        tabs: [{ tabRenderer: { content: { sectionListRenderer: { contents: [
          { itemSectionRenderer: { contents: [{ shelfRenderer: { content: { expandedShelfContentsRenderer: { items } } } }] } },
        ] } } } }],
      },
    },
  };
}

export function continuationResponse(items) {
  return { onResponseReceivedActions: [{ appendContinuationItemsAction: { continuationItems: items } }] };
}

export function channelsPageHtml(data, config = {}) {
  const cfg = { INNERTUBE_CLIENT_VERSION: '2.20261120.00.00', INNERTUBE_API_KEY: 'KEY', SESSION_INDEX: 0, ...config };
  // JSON.stringify doesn't escape "<", so we mimic the escaping YouTube does.
  const json = JSON.stringify(data).replaceAll('<', '\\u003c');
  return `<html><script>ytcfg.set(${JSON.stringify(cfg)});</script>
    <script>var ytInitialData = ${json};</script><body></body></html>`;
}

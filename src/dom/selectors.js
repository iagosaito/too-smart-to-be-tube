// All YouTube selectors live here because the site's HTML changes often: when something breaks,
// this is the only file to fix.
export const SELECTORS = {
  guide: 'ytd-guide-renderer',
  guideSection: 'ytd-guide-section-renderer',
  // Collapsed version of the menu: a different component. Today YouTube already mounts it hidden on
  // load, but it may mount it only when it is shown.
  miniGuide: 'ytd-mini-guide-renderer',
  miniGuideItems: 'ytd-mini-guide-renderer #items',
  // Drawer of the expanded menu: it exists empty from page load and YouTube only creates the
  // sections inside it when the menu opens.
  guideDrawer: 'tp-yt-app-drawer#guide',
  miniGuideEntry: 'ytd-mini-guide-entry-renderer',
  // The Categories item goes right before Subscriptions (or after Shorts, if Subscriptions is
  // missing).
  miniGuideSubscriptions: 'a[href="/feed/subscriptions"]',
  miniGuideShorts: 'a[href^="/shorts"]',
  guideEntryLink: 'ytd-guide-entry-renderer a#endpoint',
  // The subscriptions section is the only one whose header/footer points to /feed/channels.
  subscriptionsMarker: 'a[href="/feed/channels"]',
  feedChannel: 'ytd-channel-renderer',
  feedChannelLink: 'a#main-link',
  feedChannelName: 'ytd-channel-name #text',
  image: 'img',
  // Container for YouTube's pages; the Categories page is mounted inside it.
  pageManager: 'ytd-page-manager',
};

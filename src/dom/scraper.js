import { createChannel } from '../core/channels.js';
import { SELECTORS } from './selectors.js';

export function scrapeChannels(doc) {
  // Two sources because the sidebar may not list every subscription, while /feed/channels lists
  // them all (but only when the user is there).
  return [...scrapeGuideChannels(doc), ...scrapeFeedChannels(doc)];
}

export function scrapeGuideChannels(doc) {
  const section = findSubscriptionsSection(doc);
  if (!section) return [];
  return [...section.querySelectorAll(SELECTORS.guideEntryLink)].map(guideLinkToChannel).filter(Boolean);
}

export function scrapeFeedChannels(doc) {
  return [...doc.querySelectorAll(SELECTORS.feedChannel)].map(feedRendererToChannel).filter(Boolean);
}

function findSubscriptionsSection(doc) {
  // Restricted to the subscriptions section: the "You" section also has channel links (e.g. "Your
  // channel") that aren't subscriptions.
  const sections = [...doc.querySelectorAll(SELECTORS.guideSection)];
  return sections.find((section) => section.querySelector(SELECTORS.subscriptionsMarker)) ?? null;
}

function guideLinkToChannel(link) {
  return createChannel({
    href: link.getAttribute('href'),
    // The title attribute has the clean name, without "new video" badges.
    name: link.getAttribute('title') ?? link.textContent,
    avatar: link.querySelector(SELECTORS.image)?.getAttribute('src'),
  });
}

function feedRendererToChannel(renderer) {
  return createChannel({
    href: renderer.querySelector(SELECTORS.feedChannelLink)?.getAttribute('href'),
    name: renderer.querySelector(SELECTORS.feedChannelName)?.textContent,
    avatar: renderer.querySelector(SELECTORS.image)?.getAttribute('src'),
  });
}

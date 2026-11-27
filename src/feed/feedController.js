import { categoryVideos, FEED_TAB, interleave, nextChannels, orderByActivity } from './categoryFeed.js';

// Feed state of a Categories page: one session per category and tab. Two separate measures: the
// screen shows one page of items at a time, and channels are queried in batches only when what was
// already downloaded can't fill the next page (each channel brings dozens of Shorts: one batch
// yields several pages without any new request). Everything happens on explicit action ("Load
// more"), except the first batch of Shorts, which is what opening the tab asks for.
export const BATCH_SIZE = 8;
// 4 rows of 6 Shorts or 8 rows of 3 videos: enough to scroll, few enough that the end of the page
// stays close.
export const PAGE_SIZE = 24;

export function createFeedController({ source, onChange, batchSize = BATCH_SIZE, pageSize = PAGE_SIZE }) {
  const sessions = new Map();

  function sessionFor(category, tab, channels, latestUploads) {
    const signature = `${category.id}:${tab}:${channels.map((channel) => channel.id).join(',')}`;
    if (sessions.get(`${category.id}:${tab}`)?.signature !== signature) {
      const session = { signature, tab, ordered: orderByActivity(channels, latestUploads), requested: new Set(), results: new Map(), pending: new Set(), errorKey: null, visible: pageSize };
      sessions.set(`${category.id}:${tab}`, session);
      // The first batch of Shorts waits for the cache: channels already cached must not take slots
      // in the batch that goes to the network, and if the cache already fills the first page
      // nothing goes to the network.
      hydrateFromCache(session).then(() => tab === FEED_TAB.SHORTS && fillPage(session));
    }
    return sessions.get(`${category.id}:${tab}`);
  }

  async function hydrateFromCache(session) {
    // No network: everything already in the cache shows at no cost.
    const cached = await Promise.all(session.ordered.filter((channel) => channel.ucid).map(async (channel) => [channel, await source.cached(channel, session.tab)]));
    for (const [channel, items] of cached) {
      if (!items || session.requested.has(channel.id)) continue;
      session.requested.add(channel.id);
      session.results.set(channel.id, items);
    }
    if (cached.some(([, items]) => items)) onChange();
  }

  // Shows the next page; only queries channels if what was already downloaded isn't enough to fill
  // it.
  function loadMore(session, feedItems = []) {
    session.visible += pageSize;
    fillPage(session, feedItems);
  }

  function fillPage(session, feedItems = []) {
    session.errorKey = null;
    if (allItems(session, feedItems).length < session.visible) {
      for (const channel of nextChannels(session.ordered, session.requested, batchSize)) loadChannel(session, channel);
    }
    onChange();
  }

  function loadChannel(session, channel) {
    session.requested.add(channel.id);
    session.pending.add(channel.id);
    source.load(channel, session.tab)
      .then((items) => session.results.set(channel.id, items))
      .catch((error) => {
        // Frees the channel for a new attempt and shows the reason (e.g. the request limit).
        session.requested.delete(channel.id);
        session.errorKey = error?.key ?? 'error.feedUnavailable';
      })
      .finally(() => {
        session.pending.delete(channel.id);
        onChange();
      });
  }

  return { sessionFor, loadMore, modelOf };
}

function allItems(session, feedItems) {
  const lists = session.ordered.filter((channel) => session.results.has(channel.id)).map((channel) => session.results.get(channel.id));
  return session.tab === FEED_TAB.SHORTS ? interleave(lists) : categoryVideos(feedItems, session.ordered.map((channel) => channel.id), lists);
}

export function modelOf(session, feedItems = []) {
  const items = allItems(session, feedItems);
  return {
    items: items.slice(0, session.visible),
    loading: session.pending.size,
    // There is more if something already downloaded is left over or some channel is still to be
    // queried.
    hasMore: items.length > session.visible || nextChannels(session.ordered, session.requested, 1).length > 0,
    missingIds: session.ordered.filter((channel) => !channel.ucid).length,
    channelCount: session.ordered.length,
    errorKey: session.errorKey,
  };
}

// When the automatic refresh fetches what. The feed is cheap (usually one request, the same as
// reloading YouTube's subscriptions page), so it runs often. The subscriptions list has to be walked
// to the end on every fetch, so it only runs once a day or when the feed shows a new channel.
export const FEED_REFRESH_MS = 5 * 60_000;
export const LIST_SYNC_MS = 24 * 60 * 60_000;
// A failed list fetch (logged out, 429) is retried at most this often, not on every feed tick.
export const LIST_RETRY_MS = 60 * 60_000;

const olderThan = (at, interval, now) => at == null || now - at >= interval;

export function feedRefreshDue(state, now) {
  return olderThan(state.feedCheckedAt, FEED_REFRESH_MS, now);
}

export function listSyncDue(state, now) {
  return olderThan(state.lastSyncedAt, LIST_SYNC_MS, now) && olderThan(state.listCheckedAt, LIST_RETRY_MS, now);
}

// Throttles the unknown-channel trigger: a channel that shows in the feed but never in
// /feed/channels would otherwise fetch the whole list on every feed refresh.
export function listTriggerAllowed(state, now) {
  return olderThan(state.lastSyncedAt, LIST_RETRY_MS, now) && olderThan(state.listCheckedAt, LIST_RETRY_MS, now);
}

// The feed only carries subscribed channels, so a channel missing from the stored list is a new
// subscription. The feed may name a channel by /channel/UC… where the list used its handle, so the
// ucid counts as known too.
export function unknownChannelIds(videos, channels) {
  const known = new Set(Object.keys(channels));
  for (const channel of Object.values(channels)) if (channel.ucid) known.add(`/channel/${channel.ucid}`);
  return [...new Set(videos.map((video) => video.channelId))].filter((id) => !known.has(id));
}

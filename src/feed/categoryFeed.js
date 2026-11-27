// Pure rules for the per-category feed (no DOM, no network).

export const FEED_TAB = { VIDEOS: 'videos', SHORTS: 'shorts', CHANNELS: 'channels' };

// Most active channels first: loading in this order makes the first batches bring what is most
// likely new, with fewer requests.
export function orderByActivity(channels, latestUploads = {}) {
  const activity = (channel) => latestUploads[channel.id] ?? -Infinity;
  return [...channels].sort((a, b) => activity(b) - activity(a) || a.name.localeCompare(b.name));
}

// The category's videos: those from the subscriptions feed (already downloaded by the sync) plus
// those loaded channel by channel, without duplicates, newest to oldest.
export function categoryVideos(feedItems, channelIds, extraLists = []) {
  const ids = new Set(channelIds);
  const all = [...feedItems.filter((video) => ids.has(video.channelId)), ...extraLists.flat()];
  return [...new Map(all.map((video) => [video.videoId, video])).values()].sort((a, b) => b.publishedAt - a.publishedAt);
}

// Shorts have no date: interleaves one from each channel at a time (in activity order), so a very
// prolific channel doesn't take over the whole screen.
export function interleave(lists) {
  const result = [];
  const longest = Math.max(0, ...lists.map((list) => list.length));
  for (let index = 0; index < longest; index += 1) {
    for (const list of lists) if (index < list.length) result.push(list[index]);
  }
  return result;
}

// Next batch of not-yet-requested channels that can be queried (they have a ucid).
export function nextChannels(ordered, requested, size) {
  return ordered.filter((channel) => channel.ucid && !requested.has(channel.id)).slice(0, size);
}

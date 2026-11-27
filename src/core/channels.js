const YOUTUBE_ORIGIN = 'https://www.youtube.com';

// We only accept channel paths: the sidebar also has links like /feed/channels or /playlist, which
// must not become "channels".
const CHANNEL_PATH = /^\/(@[^/?#]+|channel\/[^/?#]+|c\/[^/?#]+|user\/[^/?#]+)/;

export function channelIdFromHref(href) {
  if (!href) return null;
  try {
    // The base lets us accept both relative and absolute hrefs.
    const { pathname } = new URL(href, YOUTUBE_ORIGIN);
    const match = pathname.match(CHANNEL_PATH);
    return match ? `/${match[1]}` : null;
  } catch {
    return null;
  }
}

// YouTube's internal id (UC + 22 characters): the public channel API requires it to fetch videos
// and Shorts; the handle (/@name) doesn't work.
const UCID = /^UC[\w-]{22}$/;

export function createChannel({ href, name, avatar, ucid }) {
  const id = channelIdFromHref(href);
  const cleanName = name?.trim();
  // Without an id or name the channel can't be displayed or identified later.
  if (!id || !cleanName) return null;
  const channel = { id, name: cleanName, url: `${YOUTUBE_ORIGIN}${id}`, avatar: avatar || '' };
  return UCID.test(ucid ?? '') ? { ...channel, ucid } : channel;
}

export function mergeChannels(existing, incoming) {
  const merged = { ...existing };
  for (const channel of incoming) {
    const previous = merged[channel.id];
    // Avatars are lazy-loaded on YouTube; we don't lose an avatar we already know just because the
    // image hasn't loaded in this read.
    const ucid = channel.ucid ?? previous?.ucid;
    // The sidebar doesn't carry the ucid; reading it must not erase what the sync stored.
    merged[channel.id] = { ...channel, avatar: channel.avatar || previous?.avatar || '', ...(ucid ? { ucid } : {}) };
  }
  return merged;
}

// Optional locale (e.g. "pt-BR"): alphabetical order differs between languages. The core doesn't
// know which language is active; the caller provides it.
export function sortByName(channels, locale) {
  // localeCompare sorts accents and capitals naturally.
  return [...channels].sort((a, b) => a.name.localeCompare(b.name, locale, { sensitivity: 'base' }));
}

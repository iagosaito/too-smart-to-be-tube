import { LocalizedError } from '../i18n/errors.js';
import { YOUTUBE_ORIGIN } from './auth.js';
import { shortsFromPage, videosFromPage } from './videoItems.js';

// Params for a channel's "Videos" and "Shorts" tabs, as YouTube itself sends them when switching
// tabs (read from a real channel page).
export const CHANNEL_TAB_PARAMS = {
  videos: 'EgZ2aWRlb3PyBgQKAjoA',
  shorts: 'EgZzaG9ydHPyBgUKA5oBAA==',
};
const BROWSE_URL = `${YOUTUBE_ORIGIN}/youtubei/v1/browse?prettyPrint=false`;

// Fetches a channel tab **without cookies** (credentials: 'omit'): a channel's videos and Shorts
// are public, so the request isn't tied to the user's account — no risk to the account, even with
// many requests.
export async function fetchChannelTab({ channel, tab, clientVersion, fetchFn = fetch, now = Date.now() }) {
  const body = JSON.stringify({
    context: { client: { clientName: 'WEB', clientVersion, hl: 'en' } },
    browseId: channel.ucid,
    params: CHANNEL_TAB_PARAMS[tab],
  });
  const response = await fetchFn(BROWSE_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, credentials: 'omit' });
  if (!response.ok) throw new LocalizedError('error.http', { status: response.status });
  const data = await response.json();
  return tab === 'shorts' ? shortsFromPage(data, channel.id) : videosFromPage(data, now, channel.id);
}

import { describe, expect, it } from 'vitest';
import { FEED_REFRESH_MS, feedRefreshDue, LIST_RETRY_MS, LIST_SYNC_MS, listSyncDue, listTriggerAllowed, unknownChannelIds } from '../../src/sync/syncSchedule.js';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

describe('intervals', () => {
  it('feed every 5 minutes, list once a day, failed list retried hourly', () => {
    expect([FEED_REFRESH_MS, LIST_SYNC_MS, LIST_RETRY_MS]).toEqual([5 * MINUTE, 24 * HOUR, HOUR]);
  });
});

describe('feedRefreshDue', () => {
  it('is due when never checked or after 5 minutes', () => {
    expect(feedRefreshDue({ feedCheckedAt: null }, 0)).toBe(true);
    expect(feedRefreshDue({ feedCheckedAt: 0 }, 5 * MINUTE - 1)).toBe(false);
    expect(feedRefreshDue({ feedCheckedAt: 0 }, 5 * MINUTE)).toBe(true);
  });
});

describe('listSyncDue', () => {
  it('is due on a fresh install and once the last list is a day old', () => {
    expect(listSyncDue({ lastSyncedAt: null, listCheckedAt: null }, 0)).toBe(true);
    expect(listSyncDue({ lastSyncedAt: 0, listCheckedAt: 0 }, 24 * HOUR - 1)).toBe(false);
    expect(listSyncDue({ lastSyncedAt: 0, listCheckedAt: 0 }, 24 * HOUR)).toBe(true);
  });

  it('after a failed attempt, waits an hour before trying again', () => {
    expect(listSyncDue({ lastSyncedAt: null, listCheckedAt: 0 }, HOUR - 1)).toBe(false);
    expect(listSyncDue({ lastSyncedAt: null, listCheckedAt: 0 }, HOUR)).toBe(true);
  });
});

describe('listTriggerAllowed', () => {
  it('allows the unknown-channel trigger at most once an hour', () => {
    expect(listTriggerAllowed({ lastSyncedAt: 0, listCheckedAt: 0 }, HOUR - 1)).toBe(false);
    expect(listTriggerAllowed({ lastSyncedAt: 0, listCheckedAt: 0 }, HOUR)).toBe(true);
  });
});

describe('unknownChannelIds', () => {
  const channels = { '/@alura': { id: '/@alura', ucid: 'UCalura0000000000000000' } };

  it('lists the channels in the feed that are not stored, once each', () => {
    const videos = [{ channelId: '/@alura' }, { channelId: '/@novo' }, { channelId: '/@novo' }];
    expect(unknownChannelIds(videos, channels)).toEqual(['/@novo']);
  });

  it('a stored channel named by its /channel/UC… id is known', () => {
    expect(unknownChannelIds([{ channelId: '/channel/UCalura0000000000000000' }], channels)).toEqual([]);
  });
});

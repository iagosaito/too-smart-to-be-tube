# Design: a video feed per category

Status: implemented on `feat/category-feed`.

## Problem

Categories organize channels, but the user still has to open each channel to watch. The goal is a **feed per
category** — the latest **videos and Shorts** from just the channels in it — that:

- feels native to YouTube and is fast to reach;
- stays fast with hundreds of subscriptions;
- does not put the user's account at risk (no request bursts with their session).

## Data: where the feed comes from (validated against live YouTube data)

| Need | Source | Cost | Account risk |
| --- | --- | --- | --- |
| Recent videos of every subscription | `/feed/subscriptions` (already fetched on each sync, ≤ 16 pages) — we now keep the items, not just dates | **0 extra requests** | Same as today (one sync per hour at most) |
| Older videos of a category | Channel **Videos** tab via InnerTube `browse`, **logged out** (`credentials: 'omit'`) | 1 request per channel, on demand | None: public, no cookies |
| Shorts of a category | Channel **Shorts** tab via `browse`, logged out | 1 request per channel, on demand | None: public, no cookies |

Findings from real responses (Nov 2026):

- Logged-out `browse` with the channel `UC…` id and the tab `params` works; Videos ≈ 30 items / 460 KB / 0.4 s,
  Shorts ≈ 48 items / 335 KB / 0.35 s. Tab `params` taken from the channel page.
- Video lockups carry thumbnail, duration badge, views and "1 day ago"; the feed's author part is skipped when
  reading dates (fixed in a separate branch).
- **Shorts carry no publish date.** The Shorts grid therefore orders channels by their latest known upload and
  interleaves their Shorts (newest first per channel), like YouTube's own Shorts shelf, which shows views only.
- The vertical Shorts thumbnail is `i.ytimg.com/vi/<id>/oar2.jpg` (1080×1920, ~60 KB), loaded lazily.

### Request safety

All on-demand requests go through one queue per tab (`src/sync/requestQueue.js`):

- at most **2 concurrent** requests and **350 ms** between starts;
- at most **60 channel requests per 10 minutes**; beyond that the UI asks the user to wait;
- on **429/5xx**: truncated exponential backoff with jitter (2 retries), and a 429 pauses the queue for 10 minutes
  ([Google Cloud retry strategy](https://docs.cloud.google.com/iam/docs/retry-strategy));
- results cached per channel and tab for **3 h (videos) / 6 h (Shorts)**, capped at 150 channels (LRU).

Network loads are **explicit** ("Load more"), never triggered by scrolling: each click is a deliberate, bounded
batch of channels (Baymard/NN/g favour "Load more" when loads are costly).

What is *shown* and what is *fetched* are separate: the feed displays **24 items per page** (4 rows of Shorts, 8
rows of videos) and "Load more" reveals the next 24. A batch of **8 channels** is only fetched when the items
already downloaded can't fill the next page — a channel's Shorts tab returns ~48 Shorts, so one batch yields
several pages with no new requests.

## UX decisions and the research behind them

1. **Categories in YouTube's sidebar.** The expanded sidebar gets a *Categories* section listing each category
   (folder icon + name, A–Z), showing 7 and a "Show more" toggle — the same pattern YouTube uses for
   Subscriptions, so it is instantly familiar. One click opens that category's feed. The section header still opens
   the management page. (Navigation drawers group destinations under labeled sections with dividers, labels
   truncated rather than wrapped — [Material navigation drawer](https://m2.material.io/components/navigation-drawer),
   [Android Compose drawer](https://developer.android.com/develop/ui/compose/components/drawer).)
2. **Tabs inside a category: Videos · Shorts · Channels.** This mirrors YouTube's channel page tabs. Tabs switch
   *views of the same object*; labels are 1 word, ordered by relevance (Videos first, the default), one tab always
   selected, arrow-key navigation ([NN/g, Tabs used right](https://www.nngroup.com/articles/tabs-used-right/)).
   Management tools (sort, bulk selection, rename/delete) belong to *Channels*, keeping the feed uncluttered
   ([NN/g, Progressive disclosure](https://www.nngroup.com/videos/progressive-disclosure/)).
3. **"All" and "No category" stay management views.** A feed of *all* subscriptions already exists on YouTube;
   duplicating it would add requests without new value.
4. **Video cards follow YouTube's grid.** 16:9 thumbnail first, duration badge, two-line title, channel avatar and
   name, "views • time ago" — the thumbnail drives the decision, the title explains
   ([YouTube Creators: thumbnail & title tips](https://support.google.com/youtube/answer/12340300)).
5. **Shorts as a grid of 9:16 tiles**, never letterboxed into 16:9 slots
   ([Idukki: vertical video on desktop](https://idukki.io/blog/vertical-video-on-desktop-ux-problem),
   [YouTube: Shorts on the big screen](https://blog.youtube/news-and-events/youtube-shorts-arrive-on-the-big-screen-design-process/)).
   A grid instead of a carousel avoids hidden content and carousel accessibility pitfalls
   ([W3C WAI carousels tutorial](https://www.w3.org/WAI/tutorials/carousels)).
6. **Loading feedback by duration.** Cached content renders instantly (< 0.1 s, no indicator). Network batches show
   **skeleton cards** in the exact grid shape while loading (1–10 s range)
   ([NN/g, response time limits](https://www.nngroup.com/videos/3-response-time-limits-interaction-design/),
   [NN/g, skeleton screens](https://nngroup.com/articles/skeleton-screens/)).
7. **"Load more", not infinite scroll**, for network-backed loads: users keep control, the footer stays reachable and
   every batch is a bounded number of requests
   ([NN/g, infinite scrolling tips](https://nngroup.com/articles/infinite-scrolling-tips),
   [Smashing/Baymard, pagination vs load more](https://smashingmagazine.com/2016/03/pagination-infinite-scrolling-load-more-buttons)).
8. **Empty and error states explain and offer the next step** — e.g. "No videos in the last weeks" + "Load older
   videos"; rate limit → plain explanation and when to retry
   ([NN/g, empty states](https://nngroup.com/articles/empty-state-interface-design)).
9. **Freshness is visible**: the header keeps "Synced 5 minutes ago", so users know what the feed reflects.

## Competitive context

PocketTube filters YouTube's own subscriptions page by group and keeps some features behind Patreon; recent reviews
report filters breaking after YouTube changes, and its policy sends usage events to Mixpanel
([AMO listing and reviews](https://addons.mozilla.org/firefox/addon/youtube-subscription-groups/),
[PocketTube privacy policy](https://pockettube.io/privacy.html)). This feed is a standalone page with its own
data layer, local-only storage and no analytics.

## Performance

- Videos tab renders from data already in `chrome.storage.local` (no network on open).
- Cards are cached by video id and reused across renders; images are lazy with async decoding; cards use
  `content-visibility: auto`.
- Feed items kept: newest 800 (~120 KB). Channel cache capped at 150 channels.

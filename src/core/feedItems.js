// The automatic refresh only brings the newest pages of the feed, so it merges instead of replacing:
// new videos come in, known ones are updated (current views, a more precise date read from fresher
// relative text) and the rest stays.
export function mergeFeedItems(current, fresh, limit) {
  const byId = new Map(current.map((video) => [video.videoId, video]));
  for (const video of fresh) byId.set(video.videoId, video);
  return [...byId.values()].sort((a, b) => b.publishedAt - a.publishedAt).slice(0, limit);
}

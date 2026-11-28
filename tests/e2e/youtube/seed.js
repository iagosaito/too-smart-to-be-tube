// Storage the scenarios start from. A fresh sync keeps the page from trying the account sync,
// which needs a logged-in session.
export function seededStorage() {
  const now = Date.now();
  return {
    channels: { '/@alura': { id: '/@alura', name: 'Alura', url: 'https://www.youtube.com/@alura', avatar: '' } },
    categories: [{ id: 'prog', name: 'Programming', channelIds: ['/@alura'] }],
    lastSyncedAt: now, uploadsSyncedAt: now, feedSyncedAt: now, feedAttemptedAt: now, feedItems: [],
  };
}

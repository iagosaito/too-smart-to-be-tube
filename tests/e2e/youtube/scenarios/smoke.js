import { seededStorage } from '../seed.js';

export default {
  description: 'the sidebar entry appears, and the Categories page opens and closes with YouTube navigation',
  seed: seededStorage(),
  steps: [
    { label: 'load the home page', action: (b) => b.navigate('/'), wait: 8_000, expect: { url: '/', open: false, sidebarEntry: true } },
    { label: 'open Categories from the sidebar', action: (b) => b.click('#tstb-sidebar-entry button, #tstb-mini-entry button'), expect: { open: true } },
    { label: 'a YouTube link closes the page', action: (b) => b.click('ytd-topbar-logo-renderer a, a#logo'), expect: { url: '/', open: false } },
  ],
};

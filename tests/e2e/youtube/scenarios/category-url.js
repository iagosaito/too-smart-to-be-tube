// The URL behavior from PR #27, checked against YouTube's real router: it drops unknown query
// parameters but keeps the fragment, and it also listens to popstate.
import { seededStorage } from '../seed.js';

export default {
  description: 'each view has a URL that survives refresh and Back/Forward',
  seed: seededStorage(),
  steps: [
    { label: 'load a category URL', action: (b) => b.navigate('/feed/subscriptions#tstb=prog&tab=channels'), wait: 9_000, expect: { url: '/feed/subscriptions#tstb=prog&tab=channels', open: true, tab: 'Channels' } },
    { label: 'refresh keeps the view', action: (b) => b.reload(), wait: 9_000, expect: { url: '/feed/subscriptions#tstb=prog&tab=channels', open: true, tab: 'Channels' } },
    { label: 'load the home page', action: (b) => b.navigate('/'), wait: 8_000, expect: { url: '/', open: false } },
    { label: 'opening from the sidebar pushes an entry', action: (b) => b.click('#tstb-sidebar-entry button, #tstb-mini-entry button'), expect: { url: '/feed/subscriptions#tstb=all', open: true, lastHistory: 'pushState #tstb=all' } },
    { label: 'switching category replaces it', action: (b) => b.click('Programming'), wait: 2_000, expect: { url: '/feed/subscriptions#tstb=prog', lastHistory: 'replaceState #tstb=prog' } },
    { label: 'switching tab replaces it', action: (b) => b.click('Shorts'), wait: 2_000, expect: { url: '/feed/subscriptions#tstb=prog&tab=shorts', tab: 'Shorts', lastHistory: 'replaceState #tstb=prog&tab=shorts' } },
    { label: 'refresh keeps the tab', action: (b) => b.reload(), wait: 9_000, expect: { url: '/feed/subscriptions#tstb=prog&tab=shorts', open: true, tab: 'Shorts' } },
    { label: 'one Back leaves the page', action: (b) => b.go(-1), expect: { url: '/', open: false } },
    { label: 'Forward reopens the view', action: (b) => b.go(1), wait: 6_000, expect: { url: '/feed/subscriptions#tstb=prog&tab=shorts', open: true, tab: 'Shorts' } },
    { label: 'a YouTube link closes the page', action: (b) => b.click('ytd-topbar-logo-renderer a, a#logo'), wait: 5_000, expect: { url: '/', open: false } },
    { label: 'Back returns to the view', action: (b) => b.go(-1), wait: 6_000, expect: { url: '/feed/subscriptions#tstb=prog&tab=shorts', open: true, tab: 'Shorts' } },
  ],
};

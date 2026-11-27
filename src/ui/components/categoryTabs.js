import { FEED_TAB } from '../../feed/categoryFeed.js';
import { t } from '../../i18n/i18n.js';
import { el } from '../elements.js';

// Videos · Shorts · Channels, like the tabs on a YouTube channel page. Ordered by relevance
// (watching comes before organizing), one-word labels and always one tab selected (NN/g, "Tabs,
// Used Right").
export const TAB_ORDER = [FEED_TAB.VIDEOS, FEED_TAB.SHORTS, FEED_TAB.CHANNELS];
export const TABPANEL_ID = 'tstb-tabpanel';

export function renderCategoryTabs(activeTab, actions) {
  const tabs = TAB_ORDER.map((tab) => renderTab(tab, tab === activeTab, actions));
  const list = el('div', { className: 'tstb-tabs', role: 'tablist', 'aria-label': t('tabs.label') }, tabs);
  list.addEventListener('keydown', (event) => moveWithArrows(event, activeTab, actions));
  return list;
}

function renderTab(tab, active, actions) {
  return el(
    'button',
    {
      type: 'button',
      role: 'tab',
      id: `tstb-tab-${tab}`,
      className: active ? 'tstb-tab tstb-tab-active' : 'tstb-tab',
      'aria-selected': String(active),
      'aria-controls': TABPANEL_ID,
      // Only the active tab is in the Tab order; arrow keys switch between them (WAI-ARIA pattern).
      tabindex: active ? '0' : '-1',
      'data-focus-key': `tab:${tab}`,
      onClick: () => actions.setTab(tab),
    },
    t(`tabs.${tab}`),
  );
}

function moveWithArrows(event, activeTab, actions) {
  const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
  if (!step) return;
  event.preventDefault();
  const index = (TAB_ORDER.indexOf(activeTab) + step + TAB_ORDER.length) % TAB_ORDER.length;
  actions.setTab(TAB_ORDER[index]);
}

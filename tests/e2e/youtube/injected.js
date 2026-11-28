// Runs in every youtube.com document before its own scripts: a fake storage that survives reloads
// (sessionStorage, seeded once), a log of history writes, then our CSS and bundle. harness.js reads this
// file as text and fills in the placeholders, so it stays a classic script with no outside references.
(() => {
  const host = location.hostname;
  if (host !== 'youtube.com' && !host.endsWith('.youtube.com')) return;
  const SEED = /*SEED*/null;
  const CSS = /*CSS*/'';
  const KEY = 'tstb-e2e-storage';

  installStorage();
  recordHistory();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  function installStorage() {
    if (!sessionStorage.getItem(KEY)) sessionStorage.setItem(KEY, JSON.stringify(SEED));
    const read = () => JSON.parse(sessionStorage.getItem(KEY));
    const write = (data) => sessionStorage.setItem(KEY, JSON.stringify(data));
    window.chrome = window.chrome || {};
    window.chrome.runtime = { id: 'e2e' };
    window.chrome.storage = {
      local: {
        get: async (keys) => {
          const all = read();
          const list = keys == null ? Object.keys(all) : [].concat(keys);
          return Object.fromEntries(list.filter((key) => key in all).map((key) => [key, all[key]]));
        },
        set: async (items) => write({ ...read(), ...items }),
        remove: async (keys) => {
          const all = read();
          for (const key of [].concat(keys)) delete all[key];
          write(all);
        },
      },
      onChanged: { addListener: () => {} },
    };
  }

  function recordHistory() {
    window.__tstbHistory = [];
    for (const method of ['pushState', 'replaceState']) {
      const original = history[method].bind(history);
      history[method] = (state, title, url) => {
        if (url != null) window.__tstbHistory.push(method + ' ' + new URL(url, location.href).hash);
        return original(state, title, url);
      };
    }
  }

  function start() {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.documentElement.append(style);
    /*BUNDLE*/
  }
})();

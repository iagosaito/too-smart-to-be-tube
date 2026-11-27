// YouTube is an SPA that mounts the sidebar after document_idle, so we observe the DOM instead of
// assuming the element already exists. The timeout avoids an observer living forever on pages
// without a menu (e.g. embeds); a null timeout waits indefinitely, for elements that only appear
// after a user action.
export function waitFor(selector, { root = document, timeout = 10000 } = {}) {
  const found = root.querySelector(selector);
  if (found) return Promise.resolve(found);

  return new Promise((resolve, reject) => {
    const observer = new MutationObserver(() => {
      const element = root.querySelector(selector);
      if (element) finish(() => resolve(element));
    });
    const timer = timeout === null ? null : setTimeout(() => finish(() => reject(new Error(`Timeout esperando ${selector}`))), timeout);

    function finish(settle) {
      observer.disconnect();
      clearTimeout(timer);
      settle();
    }

    observer.observe(root.documentElement ?? root, { childList: true, subtree: true });
  });
}

// O YouTube é uma SPA que monta o menu lateral depois do document_idle, então
// observamos o DOM em vez de supor que o elemento já existe. O timeout evita
// um observer vivo para sempre em páginas sem menu (ex.: embeds); timeout
// null espera indefinidamente, para elementos que só surgem por ação do usuário.
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

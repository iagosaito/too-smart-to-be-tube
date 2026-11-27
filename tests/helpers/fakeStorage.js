// Mimics the chrome.storage.local API (get/set with Promises) in memory.
export function createFakeStorageArea(initial = {}) {
  let data = structuredClone(initial);
  return {
    async get(keys) {
      return Object.fromEntries(keys.filter((key) => key in data).map((key) => [key, structuredClone(data[key])]));
    },
    async set(items) {
      data = { ...data, ...structuredClone(items) };
    },
    async remove(keys) {
      for (const key of [].concat(keys)) delete data[key];
    },
    dump: () => structuredClone(data),
  };
}

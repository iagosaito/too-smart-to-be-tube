// When the extension is reloaded or updated, the script already running in the tab becomes
// "orphaned": the DOM is still accessible, but any call to chrome.* throws "Extension context
// invalidated". Detecting this avoids console errors and lets us tell the user to reload the page.

export function isExtensionAlive(chromeApi = globalThis.chrome) {
  try {
    // runtime.id disappears (or accessing it throws) as soon as the context is invalidated.
    return Boolean(chromeApi?.runtime?.id);
  } catch {
    return false;
  }
}

export function isContextInvalidated(error) {
  return /extension context invalidated/i.test(String(error?.message ?? error));
}

// Runs the task only if the extension is still alive; if the context is lost midway, calls
// onOrphaned instead of letting the error escape.
export async function runIfAlive(task, onOrphaned, chromeApi = globalThis.chrome) {
  if (!isExtensionAlive(chromeApi)) return onOrphaned();
  try {
    return await task();
  } catch (error) {
    if (isContextInvalidated(error) || !isExtensionAlive(chromeApi)) return onOrphaned();
    throw error;
  }
}

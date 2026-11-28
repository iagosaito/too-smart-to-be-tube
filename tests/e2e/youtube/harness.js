// Runs the built content script on real youtube.com in headless Chrome, driven over the Chrome
// DevTools Protocol. Unit tests run on jsdom and fixtures; this catches what only the real site
// shows: YouTube's router rewriting URLs, its layout reacting to our DOM, its SPA events.
//
// The extension is injected instead of loaded: branded Chrome 137+ ignores --load-extension. The
// injected copy runs in the page's main world (a real install runs in an isolated world) with a
// fake chrome.storage.local, in a logged-out session. Anything that depends on the account (the
// subscriptions sync) is out of reach here.
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const YOUTUBE = 'https://www.youtube.com';
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function launch({ repo, seed, outputDir }) {
  const port = await freePort();
  const profile = mkdtempSync(join(tmpdir(), 'tstb-e2e-'));
  const chrome = spawn(process.env.CHROME_PATH ?? 'google-chrome', [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--window-size=1400,900', '--lang=en-US', 'about:blank',
  ], { stdio: 'ignore' });
  const cdp = await connect(port);
  await cdp.send('Page.enable');
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: injection(repo, seed) });
  const browser = createBrowser(cdp, outputDir);
  browser.close = async () => {
    cdp.close();
    // Chrome keeps writing to its profile until it exits.
    const exited = new Promise((resolve) => chrome.once('exit', resolve));
    chrome.kill();
    await exited;
    rmSync(profile, { recursive: true, force: true, maxRetries: 5 });
  };
  return browser;
}

function createBrowser(cdp, outputDir) {
  const evaluate = async (expression) => {
    const { result, exceptionDetails } = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
    return result.value;
  };
  return {
    evaluate,
    navigate: (path) => cdp.send('Page.navigate', { url: new URL(path, YOUTUBE).href }),
    reload: () => cdp.send('Page.reload'),
    go: (delta) => evaluate(`history.go(${Number(delta)})`),
    // By CSS selector, or by visible text inside the Categories page (tabs, chips, buttons).
    click: (target) => evaluate(`(${clickIn})(${JSON.stringify(target)})`),
    state: () => evaluate(`(${readState})()`),
    screenshot: async (name) => {
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
      const file = join(outputDir, `${name}.png`);
      writeFileSync(file, Buffer.from(data, 'base64'));
      return file;
    },
  };
}

// Serialized into the page: keep these free of outside references.
function clickIn(target) {
  // A chip's text also holds its channel count; its label is what the user reads.
  const label = (node) => (node.querySelector('.tstb-chip-label') ?? node).textContent.trim();
  const byText = [...document.querySelectorAll('#tstb-page [role=tab], #tstb-page .tstb-chip, #tstb-page button')]
    .find((node) => label(node) === target);
  const element = byText ?? document.querySelector(target);
  if (!element) throw new Error(`Nothing to click: ${target}`);
  element.click();
}

function readState() {
  const page = document.getElementById('tstb-page');
  return {
    url: location.pathname + location.search + location.hash,
    open: Boolean(page),
    tab: page?.querySelector('[role=tab][aria-selected=true]')?.textContent ?? null,
    sidebarEntry: Boolean(document.querySelector('#tstb-sidebar-entry, #tstb-mini-entry')),
    history: window.__tstbHistory ?? [],
  };
}

// The script every youtube.com document runs before its own scripts: a fake storage that survives
// reloads (sessionStorage, seeded once), a log of history writes, then our CSS and bundle.
function injection(repo, seed) {
  const bundle = readFileSync(join(repo, 'dist/content.js'), 'utf8');
  const css = readFileSync(join(repo, 'src/ui/styles.css'), 'utf8');
  return `(() => {
    if (!location.hostname.endsWith('youtube.com')) return;
    const KEY = 'tstb-e2e-storage';
    if (!sessionStorage.getItem(KEY)) sessionStorage.setItem(KEY, ${JSON.stringify(JSON.stringify(seed))});
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
    window.__tstbHistory = [];
    for (const method of ['pushState', 'replaceState']) {
      const original = history[method].bind(history);
      history[method] = (state, title, url) => {
        if (url != null) window.__tstbHistory.push(method + ' ' + new URL(url, location.href).hash);
        return original(state, title, url);
      };
    }
    const start = () => {
      const style = document.createElement('style');
      style.textContent = ${JSON.stringify(css)};
      document.documentElement.append(style);
      ${bundle}
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
  })();`;
}

async function connect(port) {
  const targets = await retry(async () => (await fetch(`http://127.0.0.1:${port}/json`)).json());
  const socket = new WebSocket(targets.find((target) => target.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve);
    socket.addEventListener('error', reject);
  });
  let nextId = 0;
  const pending = new Map();
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  });
  return {
    send: (method, params = {}) => new Promise((resolve, reject) => {
      nextId += 1;
      pending.set(nextId, { resolve, reject });
      socket.send(JSON.stringify({ id: nextId, method, params }));
    }),
    close: () => socket.close(),
  };
}

// Chrome takes a moment to open its debugging port.
async function retry(task, attempts = 50) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      if (attempt >= attempts) throw error;
      await sleep(200);
    }
  }
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

// Usage: npm run e2e:youtube [-- scenario …]   (all scenarios when none is given)
// Prints one line per step and exits non-zero if any expectation fails.
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, sleep } from './harness.js';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '../../..');
const outputDir = join(here, 'output');
const DEFAULT_WAIT_MS = 4_000;

const requested = process.argv.slice(2);
const available = readdirSync(join(here, 'scenarios')).filter((file) => file.endsWith('.js')).map((file) => file.slice(0, -3));
const names = requested.length ? requested : available;
const unknown = names.filter((name) => !available.includes(name));
if (unknown.length) fail(`Unknown scenario: ${unknown.join(', ')}. Available: ${available.join(', ')}`);
assertFreshBuild();
mkdirSync(outputDir, { recursive: true });

let failures = 0;
for (const name of names) failures += await runScenario(name);
process.exit(failures ? 1 : 0);

async function runScenario(name) {
  const { default: scenario } = await import(`./scenarios/${name}.js`);
  console.log(`\n${name}: ${scenario.description}`);
  const browser = await launch({ repo, seed: scenario.seed, outputDir });
  let failed = 0;
  try {
    for (const [index, step] of scenario.steps.entries()) {
      await step.action?.(browser);
      await sleep(step.wait ?? DEFAULT_WAIT_MS);
      const problems = check(await browser.state(), step.expect ?? {});
      console.log(`  ${problems.length ? '✗' : '✓'} ${step.label}${problems.length ? `\n      ${problems.join('\n      ')}` : ''}`);
      if (problems.length) {
        failed += 1;
        console.log(`      screenshot: ${relative(repo, await browser.screenshot(`${name}-${index + 1}`))}`);
      }
    }
    console.log(`  screenshot: ${relative(repo, await browser.screenshot(`${name}-final`))}`);
  } catch (error) {
    failed += 1;
    console.log(`  ✗ ${error.message}`);
  } finally {
    await browser.close();
  }
  return failed;
}

// expect: { url, open, tab, sidebarEntry, lastHistory } — only the keys given are checked.
function check(state, expected) {
  const actual = { ...state, lastHistory: state.history.at(-1) ?? null };
  return Object.entries(expected)
    .filter(([key, value]) => actual[key] !== value)
    .map(([key, value]) => `${key}: expected ${JSON.stringify(value)}, got ${JSON.stringify(actual[key])}`);
}

// The harness injects dist/content.js: a stale build would test old code.
function assertFreshBuild() {
  const bundle = join(repo, 'dist/content.js');
  if (!existsSync(bundle)) fail('dist/content.js is missing: run npm run build (npm run e2e:youtube does it).');
  const newest = newestSource(join(repo, 'src'));
  if (newest > statSync(bundle).mtimeMs) fail('dist/content.js is older than src/: run npm run build first.');
}

function newestSource(dir) {
  return Math.max(...readdirSync(dir, { withFileTypes: true }).map((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? newestSource(path) : statSync(path).mtimeMs;
  }));
}

function fail(message) {
  console.error(message);
  process.exit(2);
}

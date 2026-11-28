// PostToolUse hook: lint the file Claude just edited, so mistakes surface right away instead of at
// the next full `npm run lint`. Exit code 2 sends ESLint's output back to Claude; anything else is
// silent. Plain Node (no jq), because contributors may not have jq installed.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';

const input = JSON.parse(readFileSync(0, 'utf8'));
const repo = process.env.CLAUDE_PROJECT_DIR ?? input.cwd ?? process.cwd();
const file = input.tool_input?.file_path;
if (!file || !/\.m?js$/.test(file)) process.exit(0);
const path = relative(repo, resolve(repo, file));
// Outside the repository, or in folders ESLint ignores anyway.
if (path.startsWith('..') || /^(node_modules|dist|coverage)\//.test(path)) process.exit(0);

try {
  execFileSync('npx', ['eslint', '--no-warn-ignored', path], { cwd: repo, encoding: 'utf8', stdio: 'pipe' });
} catch (error) {
  process.stderr.write(`ESLint found problems in ${path}:\n${error.stdout || error.stderr || error.message}`);
  process.exit(2);
}

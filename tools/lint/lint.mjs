// Lint src/js: the files are joined into ONE script by tools/build.py (they share top-level names),
// so they are linted the same way, joined in the order of src/index.html; errors point back to file:line.
//   npm ci --prefix tools/lint && node tools/lint/lint.mjs
// Catches: names used but never declared (typos, a function that was renamed or removed), unused
// variables (dead code), unreachable code, duplicate keys/cases, comparisons that are always true/false.
import { ESLint } from 'eslint';
import globals from 'globals';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SRC = path.join(ROOT, 'src');
const html = fs.readFileSync(path.join(SRC, 'index.html'), 'utf8');
const files = [...html.matchAll(/^<script src="(js\/[^"]+)"><\/script>/gm)].map(m => m[1]);
const map = []; let code = '', line = 1;
for (const f of files) {
  let t = fs.readFileSync(path.join(SRC, f), 'utf8'); if (t.endsWith('\n')) t = t.slice(0, -1);
  const n = t.split('\n').length; map.push({ f, from: line, to: line + n - 1 });
  code += (code ? '\n' : '') + t; line += n;
}
const where = l => { const m = map.find(m => l >= m.from && l <= m.to); return m ? `src/${m.f}:${l - m.from + 1}` : `?:${l}`; };

const eslint = new ESLint({
  cwd: ROOT, overrideConfigFile: true,
  overrideConfig: [{
    languageOptions: { ecmaVersion: 2024, sourceType: 'script', globals: { ...globals.browser, ort: 'readonly' } },
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    rules: {
      'no-undef': 'error', 'no-unused-vars': ['error', { vars: 'all', args: 'none', caughtErrors: 'none' }],
      'no-unreachable': 'error', 'no-dupe-keys': 'error', 'no-redeclare': 'error', 'no-self-assign': 'error',
      'no-dupe-else-if': 'error', 'no-duplicate-case': 'error', 'no-unsafe-negation': 'error', 'use-isnan': 'error',
      'valid-typeof': 'error', 'no-const-assign': 'error', 'no-func-assign': 'error', 'no-loss-of-precision': 'error',
      'no-constant-binary-expression': 'error', 'no-self-compare': 'error', 'no-sparse-arrays': 'error',
      'no-invalid-regexp': 'error', 'no-empty-character-class': 'error', 'getter-return': 'error', 'no-setter-return': 'error',
    },
  }],
});
const [res] = await eslint.lintText(code, { filePath: path.join(SRC, 'app.js') });
for (const m of res.messages) console.log(`${where(m.line)}:${m.column}  ${m.ruleId || 'parse'}  ${m.message}`);
const n = res.messages.length;
console.log(n ? `\n${n} problem(s) in ${files.length} files` : `lint ok (${files.length} files)`);
process.exit(n ? 1 : 0);

// Pre-compile JSX inside index.html so the browser doesn't need Babel at runtime.
// Run: node .build/compile.mjs   (from project root)
// Output: rewrites index.html in place.

import { readFileSync, writeFileSync } from 'node:fs';
import { transformSync } from '@babel/core';
import babelPresetReact from '@babel/preset-react';

const HTML_PATH = new URL('../index.html', import.meta.url);
const html = readFileSync(HTML_PATH, 'utf8');

// 1) Extract the babel script block (greedy across newlines).
const SCRIPT_RE = /<script\s+type="text\/babel"\s+data-type="module">([\s\S]*?)<\/script>/;
const m = html.match(SCRIPT_RE);
if (!m) {
  console.error('No <script type="text/babel" data-type="module"> block found.');
  process.exit(1);
}
const jsx = m[1];

// 2) Transform JSX → JS (keep ESM imports intact).
const out = transformSync(jsx, {
  filename: 'app.jsx',
  presets: [[babelPresetReact, { runtime: 'classic' }]],
  babelrc: false,
  configFile: false,
  sourceMaps: false,
  // We want plain ES2020+ output — modern browsers handle it natively.
});

if (!out || !out.code) {
  console.error('Babel returned no code.');
  process.exit(1);
}

const compiled = out.code;

// 3) Rebuild HTML: replace JSX block with compiled module + drop the Babel CDN script.
//    Use a function callback so the compiled JS is treated literally — otherwise
//    String.replace interprets `$'` (and other `$X` patterns) as backreferences,
//    and any `$'` in the JS (e.g. `prefix: '$'`) would inject the file's tail.
const replacement = `<script type="module">\n${compiled}\n  </script>`;
let next = html.replace(SCRIPT_RE, () => replacement);
next = next.replace(
  /\s*<!-- Babel for in-browser JSX compilation -->\s*\n\s*<script\s+src="https:\/\/unpkg\.com\/@babel\/standalone\/babel\.min\.js"><\/script>/,
  () => ''
);

writeFileSync(HTML_PATH, next, 'utf8');
console.log(`Compiled JSX → JS  (${jsx.length}B → ${compiled.length}B)`);
console.log(`Stripped Babel CDN script.`);

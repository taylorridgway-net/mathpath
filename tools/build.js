// Builds the student page into single self-contained HTML files in dist/.
// Apps Script can't serve separate script or style files, so everything
// (engine, curriculum data, page code, styles) is inlined into one file.
//
//   dist/student.html          full web page (what Apps Script will serve)
//   dist/student-preview.html  same page without the <html>/<head> wrapper,
//                              for the private claude.ai preview link
//
// Run with: npm run build

import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');

const bundle = await build({
  entryPoints: [new URL('web/student/main.js', root).pathname],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  write: false,
  minify: false,
  legalComments: 'none',
});
// A literal "</script" inside the code would end the script tag early.
const js = bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = read('web/student/style.css');

const head = [
  '<title>MathPath Fractions Check</title>',
  '<meta name="claude:viewport-fit-sides" content="cover">',
  `<style>\n${css}</style>`,
].join('\n');
const body = [
  '<div class="preview-banner">Preview with practice questions. Nothing is sent anywhere; progress is saved only on this device.</div>',
  '<main id="app" class="app"><noscript>This page needs JavaScript turned on.</noscript></main>',
  `<script>\n${js}</script>`,
].join('\n');

mkdirSync(new URL('dist/', root), { recursive: true });
writeFileSync(new URL('dist/student-preview.html', root), `${head}\n${body}\n`);
writeFileSync(
  new URL('dist/student.html', root),
  `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n`
  + '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
  + `${head}\n</head>\n<body>\n${body}\n</body>\n</html>\n`,
);
console.log(`Built dist/student.html (${Math.round((head.length + body.length) / 1024)} KB)`);

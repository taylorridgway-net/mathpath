// Builds the student page and the teacher dashboard into single self-contained
// HTML files in dist/. Apps Script can't serve separate script or style files,
// so everything (engine, curriculum data, page code, styles) is inlined.
//
//   dist/student.html          full student page (what Apps Script will serve)
//   dist/student-preview.html  same, without the <html>/<head> wrapper, for the
//                              private claude.ai preview link
//   dist/teacher.html          teacher dashboard (preview: with a pretend class)
//   dist/teacher-preview.html  same, for its own preview link
//   dist/apps-script/          everything Google Apps Script needs: Code.js (server,
//                              engine and curriculum), student.html, teacher.html,
//                              appsscript.json. Upload this folder (see docs/SETUP-GOOGLE.md).
//
// Run with: npm run build

import { build } from 'esbuild';
import { bundleServer } from './bundle-server.js';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');

const PAGES = [
  {
    name: 'student',
    entry: 'web/student/main.js',
    css: ['web/student/style.css'],
    title: 'MathPath Fractions',
    banner: 'Preview with practice questions. Nothing is sent anywhere; progress is saved only on this device.',
  },
  {
    name: 'teacher',
    entry: 'web/teacher/main.js',
    css: ['web/student/style.css', 'web/teacher/teacher.css'],
    title: 'MathPath Teacher',
    banner: 'Preview with a pretend class: every student is made up. Your changes are saved only on this device.',
    extraBody: '<div id="print-root" aria-hidden="true"></div>',
  },
];

mkdirSync(new URL('dist/', root), { recursive: true });

for (const page of PAGES) {
  const bundle = await build({
    entryPoints: [new URL(page.entry, root).pathname],
    bundle: true,
    format: 'iife',
    target: 'es2020',
    write: false,
    minify: false,
    legalComments: 'none',
  });
  // A literal "</script" inside the code would end the script tag early.
  const js = bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  const css = page.css.map(read).join('\n');

  const head = [
    `<title>${page.title}</title>`,
    '<meta name="claude:viewport-fit-sides" content="cover">',
    `<style>\n${css}</style>`,
  ].join('\n');
  const body = [
    `<div class="preview-banner">${page.banner}</div>`,
    '<main id="app" class="app"><noscript>This page needs JavaScript turned on.</noscript></main>',
    page.extraBody || '',
    `<script>\n${js}</script>`,
  ].join('\n');

  writeFileSync(new URL(`dist/${page.name}-preview.html`, root), `${head}\n${body}\n`);
  writeFileSync(
    new URL(`dist/${page.name}.html`, root),
    `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n`
    + '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
    + `${head}\n</head>\n<body>\n${body}\n</body>\n</html>\n`,
  );
  console.log(`Built dist/${page.name}.html (${Math.round((head.length + body.length) / 1024)} KB)`);
}

// ---------- the Apps Script project ----------
const code = await bundleServer();
mkdirSync(new URL('dist/apps-script/', root), { recursive: true });
writeFileSync(new URL('dist/apps-script/Code.js', root), code);
copyFileSync(new URL('dist/student.html', root), new URL('dist/apps-script/student.html', root));
copyFileSync(new URL('dist/teacher.html', root), new URL('dist/apps-script/teacher.html', root));
copyFileSync(new URL('server/apps-script/appsscript.json', root), new URL('dist/apps-script/appsscript.json', root));
console.log(`Built dist/apps-script/ (Code.js ${Math.round(code.length / 1024)} KB)`);

// Plain-text copies for pasting into the Apps Script editor: some apps (like the
// Claude app) won't open .js or .html files as text, but will open .txt.
mkdirSync(new URL('deploy-copy/', root), { recursive: true });
for (const f of ['Code.js', 'student.html', 'teacher.html', 'appsscript.json']) {
  copyFileSync(new URL(`dist/apps-script/${f}`, root), new URL(`deploy-copy/${f}.txt`, root));
}
console.log('Built deploy-copy/ (.txt copies to paste into Apps Script)');

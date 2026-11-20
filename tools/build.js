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
import { bundleServer, asciiJs } from './bundle-server.js';
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

// Shows any error that stops the page from starting, instead of a blank page.
// Runs before the app's own code, so it catches even a file that was cut off
// or garbled when it was pasted into Google (a SyntaxError).
// A file cut off mid-script doesn't even raise an error (the browser just doesn't
// run it), so it also checks a few seconds after loading that a screen appeared.
const EARLY_ERRORS = `<script>
(function () {
  function stuck(why) {
    var app = document.getElementById('app');
    if (!app || app.querySelector('.screen')) return;
    app.innerHTML = '';
    var h = document.createElement('h1'); h.className = 'title'; h.textContent = 'This page could not start';
    var p = document.createElement('p'); p.className = 'lede';
    p.textContent = 'If MathPath was just updated in Google Apps Script, a file may not have pasted completely. Paste it again (all of it, down to the last line, </html>) and make a new deployment version.';
    var d = document.createElement('p'); d.className = 'fine'; d.textContent = why;
    app.append(h, p, d);
  }
  window.addEventListener('error', function (e) {
    stuck('Error: ' + (e.message || e.error) + (e.lineno ? ' (line ' + e.lineno + ')' : ''));
  });
  window.addEventListener('load', function () {
    setTimeout(function () { stuck('The page loaded, but its program never started (the file may be cut off).'); }, 3000);
  });
})();
</script>`;

const bundleFor = async (entry, forGoogle) => (await build({
  entryPoints: [new URL(entry, root).pathname],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  write: false,
  // The Google copy is shortened (smaller to paste, but still in normal lines: the Apps
  // Script editor copes badly with one enormous line) and plain ASCII (nothing to garble).
  minifySyntax: forGoogle,
  minifyIdentifiers: forGoogle,
  charset: forGoogle ? 'ascii' : 'utf8',
  legalComments: 'none',
})).outputFiles[0].text.replace(/<\/script/gi, '<\\/script'); // a literal "</script" would end the tag early

// CSS for the Google copy: no comments, and any non-ASCII character as a CSS escape.
const asciiCss = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/[^\x00-\x7f]/g, (c) => `\\${c.codePointAt(0).toString(16)} `);

for (const page of PAGES) {
  const js = await bundleFor(page.entry, false);
  const css = page.css.map(read).join('\n');

  const head = [
    `<title>${page.title}</title>`,
    '<meta name="claude:viewport-fit-sides" content="cover">',
    `<style>\n${css}</style>`,
  ].join('\n');
  const bodyWith = (script) => [
    `<div class="preview-banner">${page.banner}</div>`,
    '<main id="app" class="app"><noscript>This page needs JavaScript turned on.</noscript></main>',
    page.extraBody || '',
    EARLY_ERRORS,
    `<script>\n${script}</script>`,
  ].join('\n');
  const body = bodyWith(js);

  writeFileSync(new URL(`dist/${page.name}-preview.html`, root), `${head}\n${body}\n`);
  writeFileSync(
    new URL(`dist/${page.name}.html`, root),
    `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n`
    + '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
    + `${head}\n</head>\n<body>\n${body}\n</body>\n</html>\n`,
  );
  console.log(`Built dist/${page.name}.html (${Math.round((head.length + body.length) / 1024)} KB)`);

  // The copy for Google: minified, ASCII only, and checked to end properly.
  const googleHead = [`<title>${page.title}</title>`, `<style>\n${asciiCss(css)}</style>`].join('\n');
  const googlePage = '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
    + '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
    + `${googleHead}\n</head>\n<body>\n${bodyWith(asciiJs(await bundleFor(page.entry, true)))}\n</body>\n</html>\n`;
  const bad = googlePage.match(/[^\x00-\x7f]/);
  if (bad) throw new Error(`${page.name}.html for Google has a non-ASCII character: ${bad[0]}`);
  mkdirSync(new URL('dist/apps-script/', root), { recursive: true });
  writeFileSync(new URL(`dist/apps-script/${page.name}.html`, root), googlePage);
  console.log(`Built dist/apps-script/${page.name}.html (${Math.round(googlePage.length / 1024)} KB, shortened)`);
}

// ---------- the Apps Script project ----------
const code = await bundleServer();
mkdirSync(new URL('dist/apps-script/', root), { recursive: true });
writeFileSync(new URL('dist/apps-script/Code.js', root), code);
copyFileSync(new URL('server/apps-script/appsscript.json', root), new URL('dist/apps-script/appsscript.json', root));
if (/[^\x00-\x7f]/.test(code)) throw new Error('Code.js has a non-ASCII character');
console.log(`Built dist/apps-script/ (Code.js ${Math.round(code.length / 1024)} KB)`);

// Plain-text copies for pasting into the Apps Script editor: some apps (like the
// Claude app) won't open .js or .html files as text, but will open .txt.
mkdirSync(new URL('deploy-copy/', root), { recursive: true });
for (const f of ['Code.js', 'student.html', 'teacher.html', 'appsscript.json']) {
  copyFileSync(new URL(`dist/apps-script/${f}`, root), new URL(`deploy-copy/${f}.txt`, root));
}
console.log('Built deploy-copy/ (.txt copies to paste into Apps Script)');

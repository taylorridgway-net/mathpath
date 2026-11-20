// curriculum/index.json lists every curriculum file; the bundles import them through
// curriculum/all.js and curriculum/papers.js. This keeps all three in step.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../../curriculum/${p}`, import.meta.url), 'utf8');
const index = JSON.parse(read('index.json'));
const imports = (file, dir) => [...read(file).matchAll(new RegExp(`from '\\./${dir}/([^']+)\\.json'`, 'g'))].map((m) => m[1]);

test('all.js imports exactly the lessons, misconceptions and graph files the index lists, in order', () => {
  assert.deepEqual(imports('all.js', 'lessons'), index.lessons);
  assert.deepEqual(imports('all.js', 'misconceptions'), index.misconceptions);
  const domains = JSON.parse(read('graph/domains.json')).domains.map((d) => d.file.replace('.json', ''));
  assert.deepEqual(imports('all.js', 'graph').filter((f) => f !== 'domains').sort(), [...domains].sort());
  for (const area of index.misconceptions) assert.match(read('all.js'), new RegExp(`\\.\\.\\.${area}Misconceptions\\.misconceptions`));
});

test('papers.js imports exactly the papers the index lists; every lesson and paper file is listed', () => {
  assert.deepEqual(imports('papers.js', 'paper'), index.papers);
  const files = (dir) => readdirSync(new URL(`../../curriculum/${dir}/`, import.meta.url)).map((f) => f.replace('.json', '')).sort();
  assert.deepEqual(files('lessons'), [...index.lessons].sort());
  assert.deepEqual(files('paper'), [...index.papers].sort());
  assert.deepEqual(files('misconceptions'), [...index.misconceptions].sort());
});

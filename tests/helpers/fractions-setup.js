// Loads the real fractions curriculum for tests.
import { readFileSync } from 'node:fs';
import { buildGraphIndex } from '../../engine/graph/graph-index.js';
import { generators } from '../../engine/generators/index.js';

const read = (path) => JSON.parse(readFileSync(new URL(`../../curriculum/${path}`, import.meta.url), 'utf8'));

export function loadFractions() {
  const index = read('graph/domains.json');
  const files = {};
  for (const d of index.domains) files[d.file] = read(`graph/${d.file}`);
  return {
    graph: buildGraphIndex(index, files),
    generators,
    misconceptions: [...read('misconceptions/frac.json').misconceptions, ...read('misconceptions/whole.json').misconceptions, ...read('misconceptions/int.json').misconceptions],
    config: read('diagnostic/frac.json'),
  };
}

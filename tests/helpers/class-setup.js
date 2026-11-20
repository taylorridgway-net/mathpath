// The real curriculum and engine pieces a synthetic class needs, for tests.
import { readFileSync } from 'node:fs';
import { loadFractions } from './fractions-setup.js';

const read = (path) => JSON.parse(readFileSync(new URL(`../../curriculum/${path}`, import.meta.url), 'utf8'));

export function loadClassSetup() {
  const f = loadFractions();
  return {
    graph: f.graph,
    generators: f.generators,
    misconceptions: f.misconceptions,
    diagnosticConfig: f.config,
    lessons: ['whole.add-sub', 'whole.mult-div', 'whole.factors-multiples', 'frac.meaning', 'frac.equivalent', 'frac.compare', 'frac.add-sub', 'frac.multiply'].map((s) => read(`lessons/${s}.json`)),
    rules: read('mastery.json').default,
  };
}

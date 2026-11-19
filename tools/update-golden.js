// Records reference problems for fixed seeds into tests/engine/generators/golden.json.
//
// Why: the server re-creates a student's problems from saved seeds. If a code
// change silently alters what a seed produces, saved work can't be re-checked.
// The golden test compares today's output with this file.
//
// Only run this (npm run update-golden) when you changed a generator ON PURPOSE
// and bumped its `version`.

import { writeFileSync } from 'node:fs';
import { generateProblem, generators, DIFFICULTIES } from '../engine/generators/index.js';

export const GOLDEN_SEEDS = ['golden-1', 'golden-2', 'golden-3'];

export function buildGolden() {
  const out = {};
  for (const id of Object.keys(generators).sort()) {
    out[id] = { version: generators[id].version, problems: [] };
    for (const difficulty of DIFFICULTIES) {
      for (const seed of GOLDEN_SEEDS) out[id].problems.push(generateProblem(id, seed, difficulty));
    }
  }
  return JSON.parse(JSON.stringify(out));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const path = new URL('../tests/engine/generators/golden.json', import.meta.url);
  writeFileSync(path, JSON.stringify(buildGolden(), null, 1) + '\n');
  console.log('Updated tests/engine/generators/golden.json');
}

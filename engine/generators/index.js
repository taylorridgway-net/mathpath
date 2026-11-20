// The list of every problem generator, and the one function the rest of the
// app uses to make problems.

import { createRng } from '../random.js';
import { addSubGenerators } from './frac/add-sub.js';
import { equivalentGenerators } from './frac/equivalent.js';
import { meaningGenerators } from './frac/meaning.js';
import { compareGenerators } from './frac/compare.js';
import { multiplyGenerators } from './frac/multiply.js';
import { divideGenerators } from './frac/divide.js';
import { integerGenerators } from './int/integers.js';
import { wholeAddSubGenerators } from './whole/add-sub.js';
import { wholeMultDivGenerators } from './whole/mult-div.js';
import { wholeFactorGenerators } from './whole/factors.js';

export const generators = {
  ...addSubGenerators,
  ...equivalentGenerators,
  ...meaningGenerators,
  ...compareGenerators,
  ...multiplyGenerators,
  ...divideGenerators,
  ...integerGenerators,
  ...wholeAddSubGenerators,
  ...wholeMultDivGenerators,
  ...wholeFactorGenerators,
};

export const DIFFICULTIES = [1, 2, 3];

// Make one problem. Same (generatorId, difficulty, seed) -> same problem, always.
export function generateProblem(generatorId, seed, difficulty = 1) {
  const generator = generators[generatorId];
  if (!generator) throw new Error(`No generator for "${generatorId}"`);
  if (!DIFFICULTIES.includes(difficulty)) throw new Error(`Difficulty must be 1, 2 or 3 (got ${difficulty})`);

  // The generator ID and difficulty are mixed into the seed so that different
  // generators given the same seed don't produce look-alike numbers.
  const rng = createRng(`${generatorId}|${difficulty}|${seed}`);
  return {
    generator: generatorId,
    version: generator.version,
    difficulty,
    seed,
    ...generator.generate(rng, difficulty),
  };
}

// Make a set of problems from one seed (e.g. a practice round).
// Question i uses the seed "<seed>#<i>".
export function generateSet(generatorId, seed, count, difficulty = 1) {
  return Array.from({ length: count }, (_, i) => generateProblem(generatorId, `${seed}#${i}`, difficulty));
}

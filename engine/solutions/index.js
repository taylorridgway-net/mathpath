// The worked solution for any problem the app can generate.
import { solveAddSub } from './frac-add-sub.js';
import { solveWhole } from './whole.js';
import { solveEquivalent } from './frac-equivalent.js';
import { solveMeaning } from './frac-meaning.js';
import { solveCompare } from './frac-compare.js';

export function solve(problem) {
  const kind = problem.part || problem.generator;
  if (kind.startsWith('whole.')) return solveWhole(problem);
  if (kind.startsWith('frac.equivalent')) return solveEquivalent(problem);
  if (kind.startsWith('frac.meaning')) return solveMeaning(problem);
  if (kind.startsWith('frac.compare')) return solveCompare(problem);
  return solveAddSub(problem);
}

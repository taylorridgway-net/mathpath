// The worked solution for any problem the app can generate.
import { solveAddSub } from './frac-add-sub.js';
import { solveWhole } from './whole.js';
import { solveEquivalent } from './frac-equivalent.js';

export function solve(problem) {
  const kind = problem.part || problem.generator;
  if (kind.startsWith('whole.')) return solveWhole(problem);
  if (kind.startsWith('frac.equivalent')) return solveEquivalent(problem);
  return solveAddSub(problem);
}

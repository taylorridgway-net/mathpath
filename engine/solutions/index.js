// The worked solution for any problem the app can generate.
import { solveAddSub } from './frac-add-sub.js';
import { solveWhole } from './whole.js';
import { solveEquivalent } from './frac-equivalent.js';
import { solveMeaning } from './frac-meaning.js';
import { solveCompare } from './frac-compare.js';
import { solveMultiply } from './frac-multiply.js';
import { solveDivide } from './frac-divide.js';
import { solveInt } from './int.js';
import { solveSigned } from './frac-signed.js';

export function solve(problem) {
  const kind = problem.part || problem.generator;
  if (kind.startsWith('whole.')) return solveWhole(problem);
  if (kind.startsWith('int.')) return solveInt(problem);
  if (kind.startsWith('frac.equivalent')) return solveEquivalent(problem);
  if (kind.startsWith('frac.meaning')) return solveMeaning(problem);
  if (kind.startsWith('frac.compare')) return solveCompare(problem);
  if (kind.startsWith('frac.multiply')) return solveMultiply(problem);
  if (kind.startsWith('frac.divide')) return solveDivide(problem);
  if (kind.startsWith('frac.signed')) return solveSigned(problem);
  return solveAddSub(problem);
}

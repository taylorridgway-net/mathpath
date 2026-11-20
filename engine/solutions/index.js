// The worked solution for any problem the app can generate.
import { solveAddSub } from './frac-add-sub.js';
import { solveWhole } from './whole.js';

export function solve(problem) {
  return (problem.part || problem.generator).startsWith('whole.') ? solveWhole(problem) : solveAddSub(problem);
}

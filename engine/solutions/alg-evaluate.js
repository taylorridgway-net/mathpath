// Worked solutions for evaluating expressions: put each number in for its letter
// (negatives in parentheses, and "3x" becomes "3 × x"), then follow the order of
// operations (engine/solutions/alg.js).

import { substitute } from '../generators/alg/substitute.js';
import { solveAlg } from './alg.js';
import { toText } from '../problem/text.js';

const show = (t) => t.replace(/-/g, '−').replace(/\^(\d+)/g, (_, e) => [...e].map((d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d]).join(''));

export function solveEvaluate(problem) {
  const e = problem.expression.type === 'eq' ? problem.expression.right : problem.expression;
  const values = problem.values;
  const filled = substitute(e, values);
  const which = Object.entries(values).map(([k, x]) => `${show(String(x))} in for ${k}`).join(' and ');
  const steps = [{ say: `Put ${which}. A number next to a letter means multiply, and a negative number goes in parentheses: ${show(toText(filled))}.` }];
  return [...steps, ...solveAlg({ ...problem, expression: filled })];
}

// Worked solutions for writing expressions and equations from words. A solution is a
// list of steps { say, show? }. The phrase is explained piece by piece from its wording.

import { toText } from '../problem/text.js';

const n = (v) => (v < 0 ? `−${-v}` : String(v));
// ax + b as text: "2x − 5", "−3x + 8", "x + 9", "6x".
export function exprText(a, b) {
  const ax = a === 1 ? 'x' : a === -1 ? '−x' : `${n(a)}x`;
  if (a === 0) return n(b);
  return b === 0 ? ax : `${ax} ${b < 0 ? '−' : '+'} ${Math.abs(b)}`;
}
const MULT = { twice: 2, 'three times': 3, 'four times': 4, 'five times': 5, 'six times': 6 };

// What each piece of a phrase means, in words.
function explain(phrase, a, b) {
  const p = phrase.toLowerCase();
  const steps = [{ say: 'Call the number x.' }];
  const mult = /(twice|\w+ times) (?:a number|the sum|the difference)/.exec(p);
  const product = /the product of (\d+) and a number/.exec(p);
  const k = mult ? MULT[mult[1]] : product ? Number(product[1]) : 1;
  if (mult && /a number/.test(mult[0])) steps.push({ say: `"${mult[1]} a number" means ${k} × x, written ${k}x (not x + ${k}).` });
  if (product) steps.push({ say: `"The product of ${k} and a number" means ${k} × x: ${k}x.` });
  const kx = k === 1 ? 'x' : `${k}x`;
  if (/the sum of a number and (\d+)/.test(p) || /the difference of a number and (\d+)/.test(p)) {
    const [, word, c] = /the (sum|difference) of a number and (\d+)/.exec(p);
    const inside = `x ${word === 'sum' ? '+' : '−'} ${c}`;
    steps.push({ say: `"The ${word} of a number and ${c}" is ${inside}. "${mult[1]}" that whole ${word} needs parentheses: ${k}(${inside}).` });
    steps.push({ say: `Distribute: ${k} × x = ${k}x and ${k} × ${c} = ${k * Number(c)}. So ${exprText(a, b)}.` });
    return steps;
  }
  let m;
  if ((m = /(\d+) less than/.exec(p))) steps.push({ say: `"${m[1]} less than ${kx === 'x' ? 'a number' : 'that'}" means start with ${kx} and take ${m[1]} away. The ${m[1]} comes second: ${exprText(a, b)} (not ${m[1]} − ${kx}).` });
  else if ((m = /^(\d+) decreased by/.exec(p))) steps.push({ say: `"${m[1]} decreased by ${kx === 'x' ? 'a number' : `${mult[1]} a number`}" starts with ${m[1]} and takes ${kx} away: ${exprText(a, b)}.` });
  else if ((m = /subtract .* from (\d+)/.exec(p))) steps.push({ say: `"Subtract ${kx} from ${m[1]}": start with ${m[1]} and take ${kx} away. The order flips from the words: ${exprText(a, b)}.` });
  else if ((m = /decreased by (\d+)/.exec(p))) steps.push({ say: `"Decreased by ${m[1]}" means subtract ${m[1]}: ${exprText(a, b)}.` });
  else if ((m = /(\d+) more than|increased by (\d+)|plus (\d+)/.exec(p))) steps.push({ say: `"${m[0]}" means add ${m[1] || m[2] || m[3]}: ${exprText(a, b)}.` });
  steps.push({ say: `So the expression is ${exprText(a, b)}.` });
  return steps;
}

export function solveTranslate(problem) {
  const kind = problem.part || problem.generator;
  const t = toText(problem.expression);
  const a = problem.answer;
  if (kind === 'alg.translate.expression') return explain(t, a.coef, a.constant);
  const x = a.value.n / a.value.d;
  let m;
  if ((m = /^(.+) is (negative )?(\d+)\. What is the number\?$/.exec(t))) {
    const total = (m[2] ? -1 : 1) * Number(m[3]);
    const [coef, constant] = readBack(m[1]);
    const steps = explain(m[1], coef, constant).slice(0, -1);
    steps.push({ say: `"Is" means "equals": ${exprText(coef, constant)} = ${n(total)}.` });
    if (constant !== 0) steps.push({ say: `${constant < 0 ? `Add ${-constant}` : `Subtract ${constant}`} on both sides: ${exprText(coef, 0)} = ${n(total - constant)}.` });
    if (coef !== 1) steps.push({ say: `Divide both sides by ${n(coef)}: x = ${n(x)}.` });
    steps.push({ say: `Check: put ${n(x)} back into the words. The number is ${n(x)}.` });
    return steps;
  }
  const nums = [...t.matchAll(/\$?(\d+)/g)].map((v) => Number(v[1]));
  const [start, rate, total] = nums;
  const money = t.includes('$') ? '$' : '';
  return [
    { say: `Let n be the number you're looking for. You start with ${money}${start}, and each one adds ${money}${rate}: that's ${start} + ${rate}n.` },
    { say: `That has to equal ${money}${total}: ${start} + ${rate}n = ${total}.` },
    { say: `Subtract ${start} on both sides: ${rate}n = ${total - start}. Divide by ${rate}: n = ${x}.` },
    { say: `Check: ${start} + ${rate} × ${x} = ${total}. The answer is ${x}.` },
  ];
}

// The phrase's ax + b (the same readings the generator uses, worked from the words).
function readBack(phrase) {
  const p = phrase.toLowerCase();
  const mult = /(twice|\w+ times) a number/.exec(p);
  const product = /the product of (\d+) and a number/.exec(p);
  const k = mult ? MULT[mult[1]] : product ? Number(product[1]) : 1;
  let m;
  if ((m = /(\d+) less than|decreased by (\d+)/.exec(p))) return [k, -Number(m[1] || m[2])];
  if ((m = /(\d+) more than|increased by (\d+)|plus (\d+)/.exec(p))) return [k, Number(m[1] || m[2] || m[3])];
  return [k, 0];
}

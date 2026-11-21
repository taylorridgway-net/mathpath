// Worked solutions for place value and rounding (whole.place-value) and comparing
// integers / absolute value (int.compare), from the problem's own numbers.
// A solution is a list of steps { say, show? }.

import { toText } from '../problem/text.js';

const PLACES = ['ones', 'tens', 'hundreds', 'thousands', 'ten thousands', 'hundred thousands'];
const num = (s) => Number(s.replace(/,/g, '').replace('−', '-'));
const show = (v) => (v < 0 ? `−${-v}` : String(v));
const commas = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export function solveNumberSense(problem) {
  const t = toText(problem.expression);
  const ins = problem.instruction;
  const a = problem.answer;
  let m;
  if ((m = /value of the (\d)\?/.exec(ins))) {
    const digits = t.replace(/,/g, '');
    const at = digits.length - 1 - digits.indexOf(m[1]);
    return [
      { say: `Find the ${m[1]} in ${t}. Counting places from the right (ones, tens, hundreds, …), it is in the ${PLACES[at]} place.` },
      { say: `So it is worth ${m[1]} ${PLACES[at]}: ${m[1]} × ${10 ** at} = ${a.value}. The answer is ${a.value}.` },
    ];
  }
  if ((m = /The (\d) in ([\d,]+) is how many times the value of the \d in ([\d,]+)\?/.exec(t))) {
    return [
      { say: 'Each place is worth 10 times the place to its right.' },
      { say: `The ${m[1]} in ${m[2]} is worth ${m[2]}; in ${m[3]} it is worth ${m[3]}. ${num(m[2])} ÷ ${num(m[3])} = ${a.value}. The answer is ${a.value}.` },
    ];
  }
  if ((m = /Round to the nearest (ten|hundred|thousand)\./.exec(ins))) {
    const unit = { ten: 10, hundred: 100, thousand: 1000 }[m[1]];
    const n = num(t);
    const down = Math.floor(n / unit) * unit;
    const look = Math.floor((n % unit) / (unit / 10));
    return [
      { say: `${t} is between ${commas(down)} and ${commas(down + unit)}.` },
      { say: `Look at the digit just to the right of the ${m[1]}s place: it's ${look}. ${look >= 5 ? '5 or more rounds up' : 'Less than 5 rounds down'}.` },
      { say: `So ${t} rounds to ${commas(a.value)}. The answer is ${a.value}.` },
    ];
  }
  if (problem.expression.type === 'compare') {
    const [l, r] = t.split(' ? ').map(num);
    const sign = a.options[a.correct];
    return [
      { say: 'On a number line, numbers get bigger to the right. A negative number is less than 0, and the further it is from 0, the less it is.' },
      { say: `${show(l)} is ${l < r ? 'to the left of' : l > r ? 'to the right of' : 'the same as'} ${show(r)}. So ${show(l)} ${sign} ${show(r)}. The answer is ${sign}.` },
    ];
  }
  if ((m = /the (least|greatest)\?/.exec(ins))) {
    const xs = t.split(',').map((s) => num(s.trim())).sort((p, q) => p - q);
    const right = a.options[a.correct];
    return [
      { say: `Put them in order from least to greatest (left to right on the number line): ${xs.map(show).join(', ')}.` },
      { say: `The ${m[1]} is the ${m[1] === 'least' ? 'first' : 'last'} one. The answer is ${right}.` },
    ];
  }
  if (t.includes('|')) {
    if ((m = /^-\|(-\d+)\|$/.exec(t))) {
      const v = -num(m[1]);
      return [
        { say: `First the absolute value: |${show(-v)}| = ${v} (its distance from 0).` },
        { say: `The negative sign outside the bars stays: −${v}. The answer is ${show(a.value)}.` },
      ];
    }
    if ((m = /^\|(\d+) - (\d+)\|$/.exec(t))) {
      return [
        { say: `Work inside the bars first: ${m[1]} − ${m[2]} = ${show(m[1] - m[2])}.` },
        { say: `The absolute value is the distance from 0: |${show(m[1] - m[2])}| = ${a.value}. The answer is ${a.value}.` },
      ];
    }
    if ((m = /^\|(-?\d+)\| \+ \|(-?\d+)\|$/.exec(t))) {
      const [x, y] = [Math.abs(num(m[1])), Math.abs(num(m[2]))];
      return [{ say: `Each absolute value is a distance from 0: |${show(num(m[1]))}| = ${x} and |${show(num(m[2]))}| = ${y}.` }, { say: `${x} + ${y} = ${a.value}. The answer is ${a.value}.` }];
    }
    const v = num(t.replace(/\|/g, ''));
    return [{ say: 'Absolute value is the distance from 0 on the number line, so it is never negative.' }, { say: `${show(v)} is ${Math.abs(v)} away from 0, so |${show(v)}| = ${a.value}. The answer is ${a.value}.` }];
  }
  const xs = (t.match(/−?\d+/g) || []).map(num);
  const [lo, hi] = [Math.min(...xs), Math.max(...xs)];
  return [
    { say: `${show(lo)} is ${-lo} below 0 and ${hi} is ${hi} above 0, so the distance crosses 0.` },
    { say: `Add the two distances: ${-lo} + ${hi} = ${a.value}. (Or subtract: ${hi} − (${show(lo)}) = ${a.value}.) The answer is ${a.value}.` },
  ];
}

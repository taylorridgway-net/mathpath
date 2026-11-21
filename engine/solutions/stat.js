// Worked solutions for statistics and probability, from the problem's own data.
// A solution is a list of steps { say, show? }.

import { toText } from '../problem/text.js';

const nums = (t) => (t.match(/-?\d+/g) || []).map(Number);
const n = (v) => (v < 0 ? `−${-v}` : String(v));
const pn = (v) => (v < 0 ? `(${n(v)})` : n(v));
const frac = (p, q) => { const g = (a, b) => (b ? g(b, a % b) : a); const k = g(p, q); return q / k === 1 ? String(p / k) : `${p / k}/${q / k}`; };

export function solveStat(problem) {
  const t = toText(problem.expression);
  const ins = problem.instruction;
  const a = problem.answer;
  const ans = a.type === 'decimal' ? a.value : a.value.d === 1 ? String(a.value.n) : `${a.value.n}/${a.value.d}`;
  let m;
  if (t.startsWith('[a dot plot')) {
    const values = [...t.matchAll(/(\d+) at (\d+)/g)].flatMap((x) => Array(+x[1]).fill(+x[2]));
    if (/How many/.test(ins)) return [{ say: 'Each dot is one data value. Count every dot, not the columns.' }, { say: `There are ${values.length} dots. So the answer is ${ans}.` }];
    if (/mode/.test(ins)) return [{ say: 'The mode is the value with the most dots (the tallest column).' }, { say: `So the mode is ${ans}.` }];
    return [{ say: `The median is the middle dot when you count from the left. There are ${values.length} dots, so the middle one is number ${(values.length + 1) / 2}.` }, { say: `Counting along, dot number ${(values.length + 1) / 2} is at ${ans}. So the median is ${ans}.` }];
  }
  if (t.startsWith('[a bar graph')) {
    const bars = Object.fromEntries([...t.matchAll(/(\w+) (\d+)/g)].map((x) => [x[1], +x[2]]));
    if ((m = /chose (\w+)\?/.exec(ins))) return [{ say: `Find the ${m[1]} bar and read across to the scale.` }, { say: `It reaches ${ans}. So the answer is ${ans}.` }];
    if ((m = /chose (\w+) than (\w+)/.exec(ins))) return [{ say: `Read both bars: ${m[1]} is ${bars[m[1]]} and ${m[2]} is ${bars[m[2]]}.` }, { say: `"How many more" means subtract: ${bars[m[1]]} − ${bars[m[2]]} = ${ans}. So the answer is ${ans}.` }];
    const vs = Object.values(bars);
    return [{ say: 'Every student is in one bar, so add all the bars.' }, { say: `${vs.join(' + ')} = ${ans}. So the answer is ${ans}.` }];
  }
  if (t.startsWith('[a box plot')) {
    const [min, q1, med, q3, max] = [...t.matchAll(/(?:min|Q1|median|Q3|max) (\d+)/g)].map((x) => +x[1]);
    if (/median/.test(ins)) return [{ say: 'In a box plot, the line inside the box is the median. The box edges are the quartiles.' }, { say: `The line is at ${med}. So the median is ${ans}.` }];
    if (/interquartile/.test(ins)) return [{ say: 'The interquartile range is the width of the box: Q3 − Q1.' }, { say: `${q3} − ${q1} = ${ans}. So the IQR is ${ans}.` }];
    return [{ say: 'The range is the whole spread, from the end of one whisker to the other: max − min.' }, { say: `${max} − ${min} = ${ans}. So the range is ${ans}.` }];
  }
  if ((m = /mean of (\d+) numbers is (\d+)\. \d+ of them are ([\d, ]+)\./.exec(t))) {
    const xs = nums(m[3]);
    const total = m[1] * m[2];
    const have = xs.reduce((s, v) => s + v, 0);
    return [
      { say: `If ${m[1]} numbers have a mean of ${m[2]}, they add up to ${m[1]} × ${m[2]} = ${total}.` },
      { say: `The ones you know add to ${xs.join(' + ')} = ${have}.` },
      { say: `The last number is what's left: ${total} − ${have} = ${ans}.` },
    ];
  }
  if (/^(Data|Morning temperatures)/.test(t)) {
    const xs = nums(t.split(': ')[1]);
    const sorted = [...xs].sort((p, q) => p - q);
    if (/mean/.test(ins)) {
      const total = xs.reduce((s, v) => s + v, 0);
      return [{ say: `Add all the values: ${xs.map(pn).join(' + ')} = ${total}.` }, { say: `Divide by how many there are (${xs.length}): ${total} ÷ ${xs.length} = ${ans}. So the mean is ${ans}.` }];
    }
    if (/median/.test(ins)) {
      const k = sorted.length;
      return [
        { say: `Put the values in order first: ${sorted.join(', ')}.` },
        k % 2 ? { say: `The middle one is number ${(k + 1) / 2}: ${ans}. So the median is ${ans}.` }
          : { say: `There's an even number of values, so average the two in the middle: (${sorted[k / 2 - 1]} + ${sorted[k / 2]}) ÷ 2 = ${ans}. So the median is ${ans}.` },
      ];
    }
    if (/mode/.test(ins)) return [{ say: 'The mode is the value that appears most often.' }, { say: `${ans} appears the most. So the mode is ${ans}.` }];
    const [lo, hi] = [sorted[0], sorted.at(-1)];
    return [{ say: `The range is the largest value minus the smallest: the largest is ${n(hi)} and the smallest is ${n(lo)}.` }, { say: `${n(hi)} − ${pn(lo)} = ${ans}. So the range is ${ans}.` }];
  }
  if ((m = /bag has (\d+) red, (\d+) blue and (\d+) green/.exec(t))) {
    const [r, b, g] = [+m[1], +m[2], +m[3]];
    const total = r + b + g;
    const fav = /NOT blue/.test(t) ? r + g : /red or blue/.test(t) ? r + b : r;
    const what = /NOT blue/.test(t) ? 'not blue (red or green)' : /red or blue/.test(t) ? 'red or blue' : 'red';
    return [
      { say: `Probability = the ways it can happen ÷ all the possible outcomes. There are ${r} + ${b} + ${g} = ${total} marbles in all.` },
      { say: `${what[0].toUpperCase()}${what.slice(1)}: ${fav} of them. So the probability is ${fav}/${total}${frac(fav, total) === `${fav}/${total}` ? '' : ` = ${frac(fav, total)}`}. The answer is ${ans}.` },
    ];
  }
  if ((m = /rolling (.+)\?/.exec(t))) {
    const tests = { 'an even number': [(v) => v % 2 === 0, 'even'], 'a number greater than 4': [(v) => v > 4, 'greater than 4'], 'a 6': [(v) => v === 6, 'a 6'], 'a number less than 3': [(v) => v < 3, 'less than 3'], 'a multiple of 3': [(v) => v % 3 === 0, 'multiples of 3'] };
    const [ok, word] = tests[m[1]];
    const hits = [1, 2, 3, 4, 5, 6].filter(ok);
    return [
      { say: 'A number cube has 6 equally likely outcomes: 1, 2, 3, 4, 5, 6.' },
      { say: `The ones that count (${word}): ${hits.join(', ')}. That's ${hits.length} out of 6, so the probability is ${hits.length}/6${hits.length === 1 ? '' : ` = ${frac(hits.length, 6)}`}. The answer is ${ans}.` },
    ];
  }
  // Probability of one simple event, from its words: [numerator, denominator, why].
  const one = (w) => {
    if (/heads|tails/.test(w)) return [1, 2, 'a coin has 2 sides'];
    if (/even number|odd number/.test(w)) return [3, 6, '3 of the 6 numbers'];
    const sp = /spinner with (\d+) equal parts/.exec(w);
    if (sp) return [1, +sp[1], `1 of the ${sp[1]} parts`];
    if (/less than 3/.test(w)) return [2, 6, '1 and 2'];
    return [1, 6, '1 of the 6 numbers'];
  };
  const show = ([p, q]) => (frac(p, q) === `${p}/${q}` ? `${p}/${q}` : `${p}/${q} = ${frac(p, q)}`);
  if ((m = /getting (.+) and (.+)\?$/.exec(t))) {
    const [a1, a2] = [one(m[1]), one(m[2])];
    const [p1, q1] = frac(a1[0], a1[1]).split('/').map(Number);
    const [p2, q2] = frac(a2[0], a2[1]).split('/').map(Number);
    return [
      { say: 'Two separate events both happening: find each probability, then multiply them (don’t add).' },
      { say: `First: ${m[1]} is ${show(a1)} (${a1[2]}). Second: ${m[2]} is ${show(a2)} (${a2[2]}).` },
      { say: `Multiply: ${p1}/${q1} × ${p2}/${q2} = ${p1 * p2}/${q1 * q2}${frac(p1 * p2, q1 * q2) === `${p1 * p2}/${q1 * q2}` ? '' : ` = ${frac(p1 * p2, q1 * q2)}`}. The answer is ${ans}.` },
    ];
  }
  if ((m = /You (.+) (\d+) times\. About how many times would you expect (.+)\?/.exec(t))) {
    const w = /coin/.test(m[1]) ? 'heads' : /spinner with (\d+)/.test(m[1]) ? m[1] : m[3];
    const [p, q] = frac(...one(w)).split('/').map(Number);
    return [
      { say: 'Expected count = probability × number of tries.' },
      { say: `The probability of ${m[3]} is ${p}/${q}. ${p}/${q} of ${m[2]} is ${m[2]} ÷ ${q}${p === 1 ? '' : ` × ${p}`} = ${ans}. So expect about ${ans} times.` },
    ];
  }
  throw new Error(`No worked solution for "${t}"`);
}

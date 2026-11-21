// Step-by-step worked solutions for decimal problems, built from the problem as
// displayed. Used for the worked example in a lesson and after a student misses
// twice. A solution is a list of steps: { say, show? }.

import { fraction, reduce, gcd } from '../math/fraction.js';
import { fromScaled, toScaled, placesOf, parseDecimal, decimalText, terminates } from '../math/decimal.js';
import { columnLayout } from '../problem/column.js';
import { toText } from '../problem/text.js';

const dec = (value) => ({ type: 'dec', value });
const eq = (left, right) => ({ type: 'eq', left, right });
const textOf = (node) => toText(node);
const PLACE_AFTER = ['tenths', 'hundredths', 'thousandths', 'ten-thousandths'];
const PLACE_BEFORE = ['ones', 'tens', 'hundreds', 'thousands'];
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const answerNode = (problem) => (problem.answer.type === 'decimal' ? dec(problem.answer.value)
  : problem.answer.type === 'fraction' ? { type: 'frac', n: problem.answer.value.n, d: problem.answer.value.d } : { type: 'int', value: problem.answer.value });

export function solveDecimal(problem) {
  const kind = problem.part || problem.generator;
  const e = problem.expression;
  switch (kind) {
    case 'dec.place-value.read': return e.type === 'dec' ? digitSteps(problem) : readSteps(problem);
    case 'dec.place-value.compare': return compareSteps(problem);
    case 'dec.place-value.round': return roundSteps(problem);
    case 'dec.convert.to-decimal': return toDecimalSteps(problem);
    case 'dec.convert.to-fraction': return toFractionSteps(problem);
    case 'dec.convert.repeating': return repeatingSteps(problem);
    case 'dec.signed.add-sub': return signedAddSubSteps(problem);
    case 'dec.signed.mult-div': return signedMultDivSteps(problem);
    case 'dec.add-sub.line-up':
    case 'dec.add-sub.whole-numbers': return columnSteps(e.op, textOf(e.left), textOf(e.right));
    case 'dec.multiply.powers-of-ten': return powersSteps(problem);
    case 'dec.multiply.place': return multiplySteps(problem);
    case 'dec.divide.by-whole': return byWholeSteps(problem);
    case 'dec.divide.by-decimal': return byDecimalSteps(problem);
    default: throw new Error(`No worked solution for "${kind}"`);
  }
}

// ---------- understand decimals ----------

function readSteps(problem) {
  const e = problem.expression;
  const places = String(e.d).length - 1;
  const name = PLACE_AFTER[places - 1];
  const steps = [];
  steps.push({ say: `The bottom is ${e.d}, so these are ${name}: ${places} ${places === 1 ? 'place' : 'places'} after the point.` });
  steps.push({ say: `Write ${e.n} so it ends in the ${name} place${String(e.n).length < places ? `, with zeros in front to fill the places: ${String(e.n).padStart(places, '0')}` : ''}.` });
  steps.push({ say: `So ${textOf(e)} = ${problem.answer.value}.`, show: eq(e, answerNode(problem)) });
  return steps;
}

function digitSteps(problem) {
  const text = problem.expression.value;
  const after = text.split('.')[1];
  const list = after.split('').map((d, i) => `${d} in the ${PLACE_AFTER[i]}`).join(', ');
  return [
    { say: `After the point, the places go tenths, hundredths, thousandths.` },
    { say: `In ${text}: ${list}.` },
    { say: `${problem.instruction.replace('Which digit is', 'The digit')} is ${problem.answer.value}.`.replace('place?', 'place') },
  ];
}

function compareSteps(problem) {
  const [a, b] = [problem.expression.left.value, problem.expression.right.value];
  const sym = problem.answer.options[problem.answer.correct];
  const word = { '<': 'is less than', '=': 'is equal to', '>': 'is greater than' }[sym];
  const steps = [];
  const [wa, wb] = [a.split('.')[0], b.split('.')[0]];
  if (wa !== wb) {
    steps.push({ say: `Compare the whole numbers first: ${wa} and ${wb}.` });
  } else {
    const p = Math.max(placesOf(a), placesOf(b));
    const [pa, pb] = [fromScaled(toScaled(a, p), p, { keepZeros: true }), fromScaled(toScaled(b, p), p, { keepZeros: true })];
    if (pa !== a || pb !== b) steps.push({ say: `Give them the same number of places by writing zeros on the end (that doesn't change the value): ${pa} and ${pb}.` });
    steps.push({ say: `Now compare the digits after the point like whole numbers: ${pa.split('.')[1]} and ${pb.split('.')[1]}.` });
  }
  steps.push({ say: `So ${a} ${word} ${b}: ${a} ${sym} ${b}.` });
  return steps;
}

function roundSteps(problem) {
  const text = problem.expression.value;
  const to = ['whole number', 'tenth', 'hundredth'].findIndex((w) => problem.instruction.includes(w));
  const after = text.split('.')[1] || '';
  const next = Number(after[to] ?? 0);
  const placeName = to === 0 ? 'ones' : PLACE_AFTER[to - 1];
  return [
    { say: `Rounding to the nearest ${['whole number', 'tenth', 'hundredth'][to]}: look at the digit just after the ${placeName} place. In ${text} it's ${next}.` },
    { say: next >= 5 ? `${next} is 5 or more, so round up: the ${placeName} digit goes up by 1.` : `${next} is less than 5, so round down: the ${placeName} digit stays the same.` },
    { say: `Drop the digits after the ${placeName} place. ${text} rounds to ${problem.answer.value}.`, show: eq(dec(text), dec(problem.answer.value)) },
  ];
}

// ---------- fractions and decimals ----------

function toDecimalSteps(problem) {
  const { n, d } = problem.expression;
  let k = 0;
  while ((10 ** k) % d !== 0) k++;
  const m = 10 ** k / d;
  const steps = [];
  if (m !== 1) steps.push({ say: `Make the bottom ${10 ** k}: multiply the top and bottom by ${m}. ${n}/${d} = ${n * m}/${10 ** k}.`, show: eq({ type: 'frac', n, d }, { type: 'frac', n: n * m, d: 10 ** k }) });
  steps.push({ say: `${n * m}/${10 ** k} is ${n * m} ${PLACE_AFTER[k - 1]}: ${problem.answer.value}.`, show: eq({ type: 'frac', n, d }, dec(problem.answer.value)) });
  return steps;
}

function toFractionSteps(problem) {
  const text = problem.expression.value;
  const p = placesOf(text);
  const scaled = toScaled(text, p);
  const g = gcd(scaled, 10 ** p);
  const r = reduce(fraction(scaled, 10 ** p));
  const steps = [{ say: `${text} has ${p} ${p === 1 ? 'place' : 'places'} after the point, so it's ${scaled} ${PLACE_AFTER[p - 1]}: ${scaled}/${10 ** p}.`, show: eq(dec(text), { type: 'frac', n: scaled, d: 10 ** p }) }];
  if (g > 1) steps.push({ say: `Simplify: divide the top and bottom by ${g}. ${scaled}/${10 ** p} = ${r.n}/${r.d}.`, show: eq(dec(text), { type: 'frac', n: r.n, d: r.d }) });
  return steps;
}

// ---------- add and subtract: line up the points, one column at a time ----------

export function columnSteps(op, a, b) {
  const places = Math.max(placesOf(a), placesOf(b));
  const [top, bottom] = [toScaled(a, places), toScaled(b, places)];
  const col = (done) => ({ type: 'column', op, top, bottom, done, places, topPlaces: placesOf(a), bottomPlaces: placesOf(b) });
  const filled = [a, b].filter((x) => placesOf(x) < places).map((x) => `${x} as ${fromScaled(toScaled(x, places), places, { keepZeros: true })}`);
  const steps = [{
    say: `Line up the decimal points${filled.length ? `, and fill in zeros so both have ${places} ${places === 1 ? 'place' : 'places'} after the point (write ${filled.join(' and ')})` : ''}. The point in the answer goes straight below. Then ${op === '+' ? 'add' : 'subtract'} one column at a time, starting on the right.`,
    show: col(0),
  }];
  const final = columnLayout(op, top, bottom, Infinity, { places });
  const name = (i) => (i < places ? PLACE_AFTER[places - 1 - i] : PLACE_BEFORE[i - places]);
  let carry = 0;
  for (let i = 0; i < final.columns.length; i++) {
    const before = columnLayout(op, top, bottom, i, { places });
    const after = columnLayout(op, top, bottom, i + 1, { places });
    const c = after.columns[i];
    if (c.result === null) break; // nothing left to write (no leading zeros)
    if (op === '+') {
      const parts = [c.top ?? 0, c.bottom ?? 0, ...(carry ? [carry] : [])];
      const sum = parts.reduce((s, x) => s + x, 0);
      steps.push({ say: `${cap(name(i))}: ${parts.join(' + ')} = ${sum}${carry ? ' (with the 1 carried)' : ''}.${sum >= 10 ? ` Write ${sum % 10} and carry 1.` : ''}`, show: col(i + 1) });
      carry = sum >= 10 ? 1 : 0;
    } else {
      const borrowed = before.columns[i].newTop === null && c.newTop !== null;
      const from = c.newTop ?? c.top ?? 0;
      const lent = !borrowed && c.newTop !== null ? `The ${c.top ?? 0} is now ${c.newTop} after lending 1. ` : '';
      steps.push({ say: `${cap(name(i))}: ${borrowed ? `${c.top ?? 0} is less than ${c.bottom ?? 0}, so borrow from the next place: it becomes ${from}. ` : lent}${from} − ${c.bottom ?? 0} = ${c.result ?? 0}.`, show: col(i + 1) });
    }
  }
  const x = parseDecimal(a);
  const y = parseDecimal(b);
  const value = op === '+' ? fraction(x.n * y.d + y.n * x.d, x.d * y.d) : fraction(x.n * y.d - y.n * x.d, x.d * y.d);
  const node = (t) => (t.includes('.') ? dec(t) : { type: 'int', value: Number(t) });
  steps.push({ say: `So ${a} ${op === '+' ? '+' : '−'} ${b} = ${decimalText(value)}.`, show: eq({ type: 'op', op, left: node(a), right: node(b) }, dec(decimalText(value))) });
  return steps;
}

// ---------- multiply ----------

function powersSteps(problem) {
  const e = problem.expression;
  const factor = textOf(e.right);
  const f = parseDecimal(factor);
  const times = e.op === '×';
  const k = Math.round(Math.log10(f.d === 1 ? f.n : f.d)); // 10, 100, 1000 or 0.1, 0.01
  const right = times === (f.d === 1); // × 10 or ÷ 0.1: bigger
  const what = f.d === 1 ? `${times ? 'Multiplying' : 'Dividing'} by ${factor}` : `Multiplying by ${factor} is the same as dividing by ${10 ** k}, so it`;
  return [
    { say: `${what} makes the number ${right ? `${10 ** k} times bigger` : `${10 ** k} times smaller`}: every digit moves ${k} ${k === 1 ? 'place' : 'places'} ${right ? 'left' : 'right'}. (Same as moving the point ${k} ${k === 1 ? 'place' : 'places'} ${right ? 'right' : 'left'}.)` },
    { say: right ? 'Fill in zeros if you run out of digits.' : 'Fill in zeros in front if you run out of digits.' },
    { say: `${textOf(e.left)} ${e.op} ${factor} = ${problem.answer.value}.`, show: eq(e, dec(problem.answer.value)) },
  ];
}

function multiplySteps(problem) {
  const e = problem.expression;
  const [a, b] = [textOf(e.left), textOf(e.right)];
  const [pa, pb] = [placesOf(a), placesOf(b)];
  const [x, y] = [toScaled(a, pa), toScaled(b, pb)];
  return [
    { say: `Multiply as if there were no points: ${x} × ${y} = ${x * y}.` },
    { say: `Count the places after the point in both numbers: ${a} has ${pa} and ${b} has ${pb}. That's ${pa + pb} in all.` },
    { say: `So the answer has ${pa + pb} ${pa + pb === 1 ? 'place' : 'places'} after the point${String(x * y).length < pa + pb ? ' (fill in zeros in front)' : ''}: ${shownWithZeros(x * y, pa + pb, problem.answer.value)}.`, show: eq(e, dec(problem.answer.value)) },
  ];
}

// ---------- divide ----------

// "0.10 = 0.1": the digits as worked out, then the answer without its trailing zeros.
function shownWithZeros(scaled, places, answer) {
  const full = fromScaled(scaled, places, { keepZeros: true });
  return full === answer ? answer : `${full} = ${answer}`;
}

function byWholeSteps(problem) {
  const e = problem.expression;
  const a = textOf(e.left);
  const d = e.right.value;
  // Enough places for the answer (2 ÷ 4: write 2 as 2.0).
  const p = Math.max(placesOf(a), placesOf(problem.answer.value));
  const scaled = toScaled(a, p);
  const asWritten = fromScaled(scaled, p, { keepZeros: true });
  return [
    ...(asWritten !== a ? [{ say: `Write ${a} as ${asWritten}: zeros after the point don't change it, and they give the answer room.` }] : []),
    { say: `Divide as if there were no point: ${scaled} ÷ ${d} = ${scaled / d}.` },
    { say: `The point stays where it is: ${asWritten} has ${p} ${p === 1 ? 'place' : 'places'} after the point, so the answer does too: ${shownWithZeros(scaled / d, p, problem.answer.value)}.` },
    { say: `Check: ${d} × ${problem.answer.value} = ${a}.`, show: eq(e, dec(problem.answer.value)) },
  ];
}

function byDecimalSteps(problem) {
  const e = problem.expression;
  const [a, b] = [textOf(e.left), textOf(e.right)];
  const k = placesOf(b);
  const newA = decimalText(fraction(parseDecimal(a).n * 10 ** k, parseDecimal(a).d));
  const newB = decimalText(fraction(parseDecimal(b).n * 10 ** k, parseDecimal(b).d));
  return [
    { say: `Make the number you divide by a whole number: move its point ${k} ${k === 1 ? 'place' : 'places'} right. ${b} becomes ${newB}.` },
    { say: `Move the point in ${a} the same ${k} ${k === 1 ? 'place' : 'places'} right: ${newA}. (Both numbers are ${10 ** k} times bigger, so the answer doesn't change.)` },
    { say: `Now divide: ${newA} ÷ ${newB} = ${problem.answer.value}.`, show: eq(e, dec(problem.answer.value)) },
  ];
}

// ---------- repeating decimals ----------

const MINUS = (t) => t.replace(/^-/, '−');

function repeatingSteps(problem) {
  const e = problem.expression;
  const a = problem.answer;
  if (/end, or repeat/.test(problem.instruction)) {
    const r = reduce(fraction(e.n, e.d));
    const factors = [];
    let d = r.d;
    for (let q = 2; d > 1; q++) while (d % q === 0) { factors.push(q); d /= q; }
    const ends = terminates(r);
    const steps = [];
    if (r.d !== e.d) steps.push({ say: `Simplify first: ${e.n}/${e.d} = ${r.n}/${r.d}.` });
    steps.push({ say: `A fraction's decimal ends only when the bottom (in simplest form) is made of 2s and 5s, because 10 = 2 × 5. Here the bottom is ${r.d}${factors.length > 1 ? ` = ${factors.join(' × ')}` : ''}.` });
    steps.push({ say: ends ? `Only 2s and 5s, so it ends: ${r.n}/${r.d} = ${decimalText(r)}. ${a.options[a.correct]}.`
      : `It has a ${factors.find((q) => q !== 2 && q !== 5)}, so the dividing never comes out even: ${a.options[a.correct]}.` });
    return steps;
  }
  if (a.type === 'choice') {
    // Long division, until a remainder comes back.
    const { n, d } = e;
    const lines = [];
    const seen = new Map();
    let rem = n % d;
    let digits = '';
    while (!seen.has(rem) && lines.length < 6) {
      seen.set(rem, digits.length);
      const q = Math.floor((rem * 10) / d);
      lines.push(`${d} goes into ${rem * 10} ${q === 0 ? 'no times' : q === 1 ? 'once' : `${q} times`}, ${(rem * 10) % d} left over`);
      digits += q;
      rem = (rem * 10) % d;
    }
    // Options within a tenth of the value (0.6 and 0.67 for 2/3, not 0.23).
    const close = a.options.filter((o, i) => i !== a.correct && /^0\.\d+$/.test(o)
      && Math.abs(parseDecimal(o).n * d - n * parseDecimal(o).d) * 10 < parseDecimal(o).d * d);
    return [
      { say: `${n}/${d} means ${n} ÷ ${d}. Divide: ${lines.join('; ')}.` },
      { say: `That leftover ${rem} already came up, so the same digits come round again forever. The decimal repeats: ${a.options[a.correct]} (also written with a bar over the repeating part).` },
      { say: `${close.length ? `Numbers that stop, like ${close.join(' or ')}, are close but not equal to ${n}/${d}. ` : ''}So ${n}/${d} = ${a.options[a.correct]}` },
    ];
  }
  // 0.555… or 0.2727… as a fraction.
  const text = e.value;
  const body = text.slice(2, -1);
  const len = body[0] === body[1] ? 1 : 2;
  const block = body.slice(0, len);
  const over = 10 ** len - 1;
  const r = a.value;
  const g = gcd(Number(block), over);
  const steps = [{ say: len === 1
    ? `One digit repeats. Call the number x. Then 10x = ${block}.${block.repeat(4)}…, and taking x away leaves 9x = ${block}, so x = ${block}/9. (1/9 = 0.111…, so ${block}/9 = ${text}.)`
    : `Two digits repeat. Call the number x. Then 100x = ${block}.${block.repeat(3)}…, and taking x away leaves 99x = ${Number(block)}, so x = ${Number(block)}/99.`,
  show: eq(dec(text), { type: 'frac', n: Number(block), d: over }) }];
  if (g > 1) steps.push({ say: `Simplify: divide the top and bottom by ${g}. ${Number(block)}/${over} = ${r.n}/${r.d}.`, show: eq(dec(text), { type: 'frac', n: r.n, d: r.d }) });
  else steps.push({ say: `It's already in simplest form: ${r.n}/${r.d}.` });
  return steps;
}

// ---------- negative decimals ----------

function signedAddSubSteps(problem) {
  const e = problem.expression;
  const [a, b0] = [textOf(e.left), textOf(e.right)];
  const steps = [];
  // Subtracting is adding the opposite.
  const b = e.op === '-' ? (b0.startsWith('-') ? b0.slice(1) : `-${b0}`) : b0;
  if (e.op === '-') steps.push({ say: `Subtracting is adding the opposite: ${MINUS(a)} − ${b0.startsWith('-') ? `(${MINUS(b0)})` : b0} is the same as ${MINUS(a)} + ${b.startsWith('-') ? `(${MINUS(b)})` : b}.` });
  const [sa, sb] = [a.replace('-', ''), b.replace('-', '')];
  const [na, nb] = [a.startsWith('-'), b.startsWith('-')];
  const answer = problem.answer.value;
  if (na === nb) {
    steps.push({ say: `Both are ${na ? 'negative' : 'positive'}: add their sizes and keep the sign.` });
    steps.push(...columnSteps('+', sa, sb).slice(0, -1));
    steps.push({ say: `${sa} + ${sb} = ${answer.replace('-', '')}, ${na ? 'negative' : 'positive'}. So the answer is ${MINUS(answer)}.`, show: eq(e, dec(answer)) });
  } else {
    const [x, y] = [parseDecimal(sa), parseDecimal(sb)];
    const aBigger = x.n * y.d > y.n * x.d;
    const [big, small] = aBigger ? [sa, sb] : [sb, sa];
    const bigNeg = aBigger ? na : nb;
    steps.push({ say: `One is negative and one is positive: subtract the smaller size from the bigger. The answer takes the sign of ${MINUS(aBigger ? a : b)}, the one farther from 0.` });
    steps.push(...columnSteps('-', big, small).slice(0, -1));
    steps.push({ say: `${big} − ${small} = ${answer.replace('-', '')}, and it's ${bigNeg ? 'negative' : 'positive'}. So the answer is ${MINUS(answer)}.`, show: eq(e, dec(answer)) });
  }
  return steps;
}

function signedMultDivSteps(problem) {
  const e = problem.expression;
  const [a, b] = [textOf(e.left), textOf(e.right)];
  const negatives = [a, b].filter((t) => t.startsWith('-')).length;
  const size = problem.answer.value.replace('-', '');
  const abs = (node) => (node.type === 'dec' ? dec(node.value.replace('-', '')) : { type: 'int', value: Math.abs(node.value) });
  const unsigned = { ...problem, expression: { ...e, left: abs(e.left), right: abs(e.right) }, answer: { ...problem.answer, value: size } };
  const divide = e.op === '÷';
  const [, , b2] = [0, 0, textOf(unsigned.expression.right)];
  const part = !divide ? 'dec.multiply.place' : b2.includes('.') ? 'dec.divide.by-decimal' : 'dec.divide.by-whole';
  const inner = solveDecimal({ ...unsigned, part }).map(({ say }) => ({ say }));
  return [
    { say: `First ${divide ? 'divide' : 'multiply'} the sizes, then decide the sign.` },
    ...inner,
    { say: `Signs: ${negatives === 2 ? 'two negatives make a positive' : 'one negative makes the answer negative'}. So ${MINUS(a)} ${e.op} ${b.startsWith('-') ? `(${MINUS(b)})` : b} = ${MINUS(problem.answer.value)}.`, show: eq(e, dec(problem.answer.value)) },
  ];
}

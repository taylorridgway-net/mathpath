// Worked solutions for exponents, roots and scientific notation, from the problem's own
// numbers. A solution is a list of steps { say, show? }.

import { toText } from '../problem/text.js';

const n = (v) => (v < 0 ? `−${-v}` : String(v));
const pn = (v) => (v < 0 ? `(${n(v)})` : n(v));
const SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '−': '⁻' };
const toSup = (e) => e.split('').map((c) => SUP[c] ?? c).join('');
const frText = (f) => (f.d === 1 ? n(f.n) : `${f.n < 0 ? '−' : ''}${Math.abs(f.n)}/${f.d}`);

export function solveExponent(problem) {
  const kind = problem.part || problem.generator;
  const t = toText(problem.expression);
  const a = problem.answer;
  const ans = a.type === 'choice' ? a.options[a.correct] : a.type === 'integer' ? n(a.value) : a.type === 'decimal' ? a.value : frText(a.value);
  let m;
  switch (kind) {
    case 'exp.rules.product':
      m = /\^(-?\d+) · .+\^(-?\d+) =/.exec(t);
      return [
        { say: `Multiplying powers of the same base: add the exponents. (x³ · x⁴ is three x's times four x's: seven x's.)` },
        { say: `${n(+m[1])} + ${pn(+m[2])} = ${ans}. So the exponent is ${ans}.` },
      ];
    case 'exp.rules.quotient':
      m = /\^(-?\d+)\/.+\^(-?\d+) =/.exec(t);
      return [
        { say: `Dividing powers of the same base: subtract the exponents, top minus bottom. (Matching factors on top and bottom cancel.)` },
        { say: `${n(+m[1])} − ${pn(+m[2])} = ${ans}. So the exponent is ${ans}.${a.value < 0 ? ' A negative exponent means more on the bottom.' : ''}` },
      ];
    case 'exp.rules.power':
      m = /\(.+\^(-?\d+)\)\^(-?\d+) =/.exec(t);
      return [
        { say: `A power of a power: multiply the exponents. ((x²)³ is x² three times: 2 + 2 + 2 = 6.)` },
        { say: `${n(+m[1])} × ${pn(+m[2])} = ${ans}. So the exponent is ${ans}.` },
      ];
    case 'exp.rules.negative': {
      if ((m = /^x\^(-\d+) = 1\/x\^\?$/.exec(t))) {
        return [
          { say: `A negative exponent means "one over": x${toSup(String(m[1]).replace('-', '−'))} = 1/x${toSup(String(-m[1]))}. The exponent turns positive on the bottom.` },
          { say: `So the exponent is ${ans}.` },
        ];
      }
      if ((m = /^(\d+)\^0$/.exec(t))) {
        return [
          { say: `Any nonzero number to the 0 power is 1. (Going down the powers of ${m[1]}, each step divides by ${m[1]}: ${m[1]}¹ = ${m[1]}, so ${m[1]}⁰ = ${m[1]} ÷ ${m[1]} = 1.)` },
          { say: `So the answer is ${ans}.` },
        ];
      }
      if ((m = /^\((\d+)\/(\d+)\)\^(-\d+)$/.exec(t))) {
        const k = -m[3];
        return [
          { say: `A negative exponent flips the fraction: (${m[1]}/${m[2]})${toSup(`−${k}`)} = (${m[2]}/${m[1]})${toSup(String(k))}.` },
          { say: `${k === 1 ? `That's ${m[2]}/${m[1]}.` : `Square the top and the bottom: ${m[2]}² = ${m[2] ** 2} and ${m[1]}² = ${m[1] ** 2}.`} So the answer is ${ans}.` },
        ];
      }
      m = /^(\d+)\^(-\d+)$/.exec(t);
      const [b, k] = [+m[1], -m[2]];
      return [
        { say: `A negative exponent means "one over" the positive power, not a negative number: ${b}${toSup(`−${k}`)} = 1/${b}${toSup(String(k))}.` },
        { say: `${b}${toSup(String(k))} = ${b ** k}. So the answer is ${ans}.` },
      ];
    }
    case 'exp.roots.perfect': {
      if ((m = /^∛(-?\d+)$/.exec(t))) {
        return [
          { say: `The cube root asks: what number times itself three times makes ${n(+m[1])}?` },
          { say: `${pn(a.value.n)} × ${pn(a.value.n)} × ${pn(a.value.n)} = ${n(+m[1])}. So the answer is ${ans}.` },
        ];
      }
      if ((m = /^√\((\d+)\/(\d+)\)$/.exec(t))) {
        return [{ say: `Take the square root of the top and the bottom: √${m[1]} = ${a.value.n} and √${m[2]} = ${a.value.d}.` }, { say: `So the answer is ${ans}.` }];
      }
      m = /^√(\d+)$/.exec(t);
      return [
        { say: `The square root asks: what number times itself makes ${m[1]}? (Not half of it.)` },
        { say: `${ans} × ${ans} = ${m[1]}. So the answer is ${ans}.` },
      ];
    }
    case 'exp.roots.estimate': {
      const v = +/^√(\d+)$/.exec(t)[1];
      const lo = Math.floor(Math.sqrt(v));
      return [
        { say: `Find the perfect squares on either side of ${v}: ${lo}² = ${lo * lo} and ${lo + 1}² = ${(lo + 1) ** 2}.` },
        { say: `${lo * lo} < ${v} < ${(lo + 1) ** 2}, so √${v} is between ${lo} and ${lo + 1}${a.options.length === 2 ? `. ${v} is ${v - lo * lo} away from ${lo * lo} and ${(lo + 1) ** 2 - v} away from ${(lo + 1) ** 2}` : ''}. So the answer is ${ans}.` },
      ];
    }
    case 'exp.roots.rational': {
      const why = t === 'π' ? 'π goes on forever without repeating (3.14159…), so it can\'t be written as a fraction.'
        : /^√\d+$/.test(t) ? (ans === 'Rational' ? `${t} is a whole number (a perfect square), and whole numbers are fractions like ${Math.round(Math.sqrt(+t.slice(1)))}/1.` : `${t.slice(1)} isn't a perfect square, so its square root goes on forever without repeating.`)
          : /…/.test(t) ? 'A repeating decimal can be written as a fraction (0.333… = 1/3), so it\'s rational.'
            : /^√\(/.test(t) ? 'The top and bottom are both perfect squares, so the root is a fraction.'
              : 'It\'s a fraction or a decimal that ends, so it can be written as a fraction.';
      return [{ say: `Rational means it can be written as a fraction of whole numbers. ${why}` }, { say: `So it's ${ans}.` }];
    }
    case 'exp.scinot.write': {
      if ((m = /^([\d.]+) = \? × 10\^(-?\d+)$/.exec(t))) {
        return [{ say: `The number in front must be at least 1 and less than 10. Move the decimal point in ${m[1]} until that's true: ${ans}.` }, { say: `Check: ${ans} × 10${toSup(m[2].replace('-', '−'))} = ${m[1]}. So the answer is ${ans}.` }];
      }
      m = /^([\d.]+) = ([\d.]+) × 10\^\?$/.exec(t);
      const big = parseFloat(m[1]) >= 1;
      return [
        { say: `Count how many places the decimal point moves from ${m[2]} to ${m[1]}: ${Math.abs(a.value)} places to the ${big ? 'right' : 'left'}.` },
        { say: `${big ? 'A big number: the exponent is positive.' : 'A number less than 1: the exponent is negative.'} So the exponent is ${ans}.` },
      ];
    }
    case 'exp.scinot.standard': {
      m = /^([\d.]+) × 10\^(-?\d+)$/.exec(t);
      const e = +m[2];
      return [
        { say: `× 10${toSup(m[2].replace('-', '−'))} moves the decimal point ${Math.abs(e)} ${Math.abs(e) === 1 ? 'place' : 'places'} to the ${e > 0 ? 'right (bigger)' : 'left (smaller)'}. Fill in zeros as needed.` },
        { say: `${m[1]} becomes ${ans}. So the answer is ${ans}.` },
      ];
    }
    case 'exp.scinot.operate': {
      m = /^\((\d+) × 10\^(-?\d+)\) ([·÷]) \((\d+) × 10\^(-?\d+)\) = (\d+) × 10\^\?$/.exec(t);
      const mult = m[3] === '·';
      return [
        { say: `${mult ? 'Multiply' : 'Divide'} the numbers in front: ${m[1]} ${mult ? '×' : '÷'} ${m[4]} = ${m[6]}.` },
        { say: `${mult ? 'Multiply' : 'Divide'} the powers of 10: ${mult ? 'add' : 'subtract'} the exponents. ${n(+m[2])} ${mult ? '+' : '−'} ${pn(+m[5])} = ${ans}. So the exponent is ${ans}.` },
      ];
    }
    default: throw new Error(`No worked solution for "${kind}"`);
  }
}

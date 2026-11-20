// Worked solutions for ratios, rates and percents, built from the numbers in the
// problem as shown. A solution is a list of steps: { say, show? }.

import { fraction, mul, div, sub, add, reduce } from '../math/fraction.js';
import { decimalText, parseDecimal } from '../math/decimal.js';
import { toText } from '../problem/text.js';

const F = (n, d = 1) => fraction(n, d);
const t = (f) => decimalText(f);
const nums = (s) => (s.match(/\d+(?:\.\d+)?/g) || []).map(parseDecimal);
const gcd = (a, b) => (b ? gcd(b, a % b) : a);

export function solveRatio(problem) {
  const kind = problem.part || problem.generator;
  const text = toText(problem.expression);
  const n = nums(text);
  const a = problem.answer;
  const shown = a.type === 'choice' ? a.options[a.correct] : `${a.prefix || ''}${a.value}${a.suffix || ''}`;
  switch (kind) {
    case 'rat.ratios.equivalent': {
      const [x, y, z] = n;
      const k = div(z, x);
      if (k.d !== 1) {
        // Not a whole-number jump: go through the simplest ratio (6 : 10 = 3 : 5, and 9 is 3 × 3).
        const g = gcd(x.n, y.n);
        const [p, q] = [x.n / g, y.n / g];
        const m = z.n / p;
        return [
          { say: `Simplify the ratio first: divide both numbers by ${g}. ${x.n} : ${y.n} = ${p} : ${q}.` },
          { say: `${z.n} is ${p} × ${m}, so multiply ${q} by ${m} too: ${q} × ${m} = ${q * m}. Ratios grow by multiplying, not by adding.` },
          { say: `So the missing number is ${shown}.` },
        ];
      }
      return [
        { say: `How did ${t(x)} become ${t(z)}? It was multiplied by ${t(k)} (${t(z)} ÷ ${t(x)} = ${t(k)}).` },
        { say: `Multiply the other number by the same: ${t(y)} × ${t(k)} = ${t(mul(y, k))}. Ratios grow by multiplying, not by adding.` },
        { say: `So the missing number is ${shown}.` },
      ];
    }
    case 'rat.ratios.unit-rate': {
      if (a.type === 'choice') {
        const [n1, t1, n2, t2] = n;
        return [
          { say: `Find the price for one in each pack. Pack A: $${t(t1)} ÷ ${t(n1)} = $${t(div(t1, n1))}. Pack B: $${t(t2)} ÷ ${t(n2)} = $${t(div(t2, n2))}.` },
          { say: `The lower price for one is the better buy, even if the pack costs more in total. ${shown} is the better buy.` },
        ];
      }
      const [total, count] = /cost \$/.test(text) ? [n[1], n[0]] : [n[0], n[1]];
      return [
        { say: `"Per one" means divide the total by how many: ${t(total)} ÷ ${t(count)} = ${t(div(total, count))}.` },
        { say: `Check: ${t(div(total, count))} × ${t(count)} = ${t(total)}. So the answer is ${shown}.` },
      ];
    }
    case 'rat.ratios.proportion': {
      const [b, c, d] = text.startsWith('x/') ? [n[0], n[1], n[2]] : [n[2], n[0], n[1]];
      const k = div(b, d);
      const g = gcd(c.n, d.n);
      return [
        { say: `Line up the matching parts: ${t(c)} goes with ${t(d)}, and the answer goes with ${t(b)}.` },
        k.d === 1
          ? { say: `${t(d)} × ${t(k)} = ${t(b)}, so multiply ${t(c)} by the same: ${t(c)} × ${t(k)} = ${t(mul(c, k))}.` }
          : { say: `Simplify ${t(c)}/${t(d)} first: ${c.n / g}/${d.n / g}. ${t(b)} is ${d.n / g} × ${b.n / (d.n / g)}, so the answer is ${c.n / g} × ${b.n / (d.n / g)} = ${(c.n / g) * (b.n / (d.n / g))}.` },
        { say: `(Or cross-multiply: ${t(c)} × ${t(b)} ÷ ${t(d)} = ${t(div(mul(c, b), d))}.) So the answer is ${shown}.` },
      ];
    }
    case 'rat.percent.convert': {
      if (problem.instruction === 'Write as a decimal.') {
        return [
          { say: `Percent means "out of 100", so ${text} = ${t(n[0])}/100.` },
          { say: `Dividing by 100 moves the point 2 places left: ${shown}.` },
        ];
      }
      if (text.includes('/')) {
        const [x, y] = n;
        return [
          { say: `Percent means out of 100. Make the bottom 100 (or divide): ${t(x)}/${t(y)} = ${t(div(x, y))}.` },
          { say: `Multiply by 100 to get the percent (move the point 2 places right): ${shown}.` },
        ];
      }
      return [{ say: `Multiply by 100: move the point 2 places right. ${text} = ${shown}.` }];
    }
    case 'rat.percent.of': {
      const [p, whole] = n;
      return [
        { say: `${t(p)}% means ${t(p)} out of 100, which is ${t(div(p, F(100)))}.` },
        { say: `"Of" means multiply: ${t(div(p, F(100)))} × ${t(whole)} = ${t(mul(div(p, F(100)), whole))}.` },
        ...(gcd(Number(t(p).split('.')[0]), 100) >= 10 && !t(p).includes('.') ? [{ say: `A quicker way: ${t(p)}% = ${reduce(F(Number(t(p)), 100)).n}/${reduce(F(Number(t(p)), 100)).d}, so take ${reduce(F(Number(t(p)), 100)).n}/${reduce(F(Number(t(p)), 100)).d} of ${t(whole)}.` }] : []),
        { say: `So the answer is ${shown}.` },
      ];
    }
    case 'rat.percent.what-percent': {
      const [part, whole] = n;
      return [
        { say: `Write it as a fraction: part over whole, ${t(part)}/${t(whole)}.` },
        { say: `As a decimal: ${t(part)} ÷ ${t(whole)} = ${t(div(part, whole))}. As a percent, times 100: ${shown}.` },
      ];
    }
    case 'rat.percent-change.apply': {
      const [old, p] = n;
      const change = div(mul(old, p), F(100));
      const off = / off\./.test(text);
      return [
        { say: `Find the change: ${t(p)}% of $${t(old)} = ${t(div(p, F(100)))} × ${t(old)} = $${t(change)}.` },
        { say: `${off ? 'A discount comes off' : 'An increase, tax or tip is added'}: $${t(old)} ${off ? '−' : '+'} $${t(change)} = $${t(off ? sub(old, change) : add(old, change))}.` },
        { say: `So the answer is ${shown}.` },
      ];
    }
    case 'rat.percent-change.find': {
      const [old, now] = n;
      const change = /decrease/.test(text) ? sub(old, now) : sub(now, old);
      return [
        { say: `Find the change: ${t(old)} to ${t(now)} is a change of ${t(change)}.` },
        { say: `Compare it with the ORIGINAL amount: ${t(change)} ÷ ${t(old)} = ${t(div(change, old))}.` },
        { say: `As a percent, times 100: ${shown}.` },
      ];
    }
    default: throw new Error(`No worked solution for "${kind}"`);
  }
}

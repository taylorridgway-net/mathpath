// Small helpers shared by the whole-number generators.

export const int = (value) => ({ type: 'int', value });
export const op = (sym, left, right) => ({ type: 'op', op: sym, left, right });
export const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

// Digits of n, ones first: 503 -> [3, 0, 5].
export const digits = (n) => String(n).split('').reverse().map(Number);
export const fromDigits = (ds) => Number([...ds].reverse().join('')) || 0;

// Pick from rng until `ok` holds. Deterministic for a given seed; throws
// rather than looping forever if the conditions can't be met (a bug).
export function pickUntil(rng, make, ok, tries = 1000) {
  for (let i = 0; i < tries; i++) {
    const x = make();
    if (ok(x)) return x;
  }
  throw new Error('pickUntil: no value found (generator bug)');
}

// Wrong answers that point to misconceptions: drop any that would be right,
// aren't valid, or repeat an earlier one.
export function misconceptionList(correct, candidates, same = (a, b) => a === b) {
  const out = [];
  for (const c of candidates) {
    if (c.value === null || c.value === undefined || (typeof c.value === 'number' && c.value < 0)) continue;
    if (same(c.value, correct)) continue;
    if (out.some((o) => same(o.value, c.value))) continue;
    out.push(c);
  }
  return out;
}

export const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
export const lcm = (a, b) => (a / gcd(a, b)) * b;

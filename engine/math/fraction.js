// Exact fraction arithmetic.
//
// A fraction is a plain object { n, d }: numerator and denominator, both whole
// numbers. The sign always lives on the numerator and the denominator is always
// positive. Fractions are NOT reduced automatically, because we need to know
// when a student's answer is unsimplified. Call reduce() when you want that.
//
// Never use decimals (0.333...) for fraction math: they're inexact.

export function gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

export function lcm(a, b) {
  if (a === 0 || b === 0) return 0;
  return Math.abs((a / gcd(a, b)) * b);
}

export function fraction(n, d = 1) {
  if (!Number.isSafeInteger(n) || !Number.isSafeInteger(d)) {
    throw new Error(`fraction: numerator and denominator must be whole numbers (got ${n}/${d})`);
  }
  if (d === 0) throw new Error('fraction: denominator cannot be 0');
  if (d < 0) {
    n = -n;
    d = -d;
  }
  if (n === 0) n = 0; // turn -0 into 0
  return Object.freeze({ n, d });
}

export function reduce(f) {
  const g = gcd(f.n, f.d) || 1;
  return fraction(f.n / g, f.d / g);
}

export function isSimplest(f) {
  return gcd(f.n, f.d) === 1;
}

export function add(a, b) {
  return reduce(fraction(a.n * b.d + b.n * a.d, a.d * b.d));
}

export function sub(a, b) {
  return reduce(fraction(a.n * b.d - b.n * a.d, a.d * b.d));
}

export function mul(a, b) {
  return reduce(fraction(a.n * b.n, a.d * b.d));
}

export function div(a, b) {
  if (b.n === 0) throw new Error('div: cannot divide by zero');
  return reduce(fraction(a.n * b.d, a.d * b.n));
}

// Same value? (2/4 equals 1/2.)
export function equals(a, b) {
  return a.n * b.d === b.n * a.d;
}

// -1 if a < b, 0 if equal, 1 if a > b.
export function compare(a, b) {
  return Math.sign(a.n * b.d - b.n * a.d);
}

// Split into mixed-number parts. 7/4 -> { negative: false, whole: 1, n: 3, d: 4 }.
// Does not reduce; reduce first if you want simplest form.
export function toMixed(f) {
  const negative = f.n < 0;
  const size = Math.abs(f.n);
  return { negative, whole: Math.floor(size / f.d), n: size % f.d, d: f.d };
}

// Build a fraction from mixed-number parts. (2, 1, 4) -> 9/4.
export function fromMixed(whole, n, d, negative = false) {
  const size = whole * d + n;
  return fraction(negative ? -size : size, d);
}

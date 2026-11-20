// Exact decimals. A decimal is kept as TEXT ("3.25", "-0.4") for showing, and
// turned into an exact fraction (325/100) for any math. Never JavaScript
// floating point: 0.1 + 0.2 isn't 0.3 there.

import { fraction, reduce } from './fraction.js';

const DECIMAL = /^(-)?(\d*)(?:\.(\d*))?$/;

// "3.25" -> 325/100 (not reduced). ".5" and "5." are fine. Null if not a decimal.
export function parseDecimal(text) {
  const m = DECIMAL.exec(String(text ?? '').trim());
  if (!m) return null;
  const [, minus, whole = '', part = ''] = m;
  if (!whole && !part) return null;
  const digits = `${whole}${part}`.replace(/^0+(?=\d)/, '') || '0';
  const n = Number(digits);
  if (!Number.isSafeInteger(n)) return null;
  return fraction(minus ? -n : n, 10 ** part.length);
}

// How many decimal places the text has as written ("2.50" -> 2).
export function placesOf(text) {
  const i = String(text).indexOf('.');
  return i < 0 ? 0 : String(text).length - i - 1;
}

// Does this fraction end (only 2s and 5s in its reduced denominator)?
export function terminates(f) {
  let d = reduce(f).d;
  for (const p of [2, 5]) while (d % p === 0) d /= p;
  return d === 1;
}

// An exact fraction as decimal text, without trailing zeros ("3.25", "-0.4", "7").
// Throws for a fraction that doesn't end (1/3).
export function decimalText(f) {
  const r = reduce(f);
  if (!terminates(r)) throw new Error(`decimalText: ${r.n}/${r.d} doesn't end`);
  let places = 0;
  while ((10 ** places) % r.d !== 0) places++;
  const scaled = Math.abs(r.n) * (10 ** places / r.d);
  return fromScaled(r.n < 0 ? -scaled : scaled, places);
}

// An integer count of 10^-places, as text: (325, 2) -> "3.25"; (5, 2) -> "0.05".
// Trailing zeros are dropped unless keepZeros.
export function fromScaled(scaled, places, { keepZeros = false } = {}) {
  const neg = scaled < 0;
  let s = String(Math.abs(scaled)).padStart(places + 1, '0');
  let out = places ? `${s.slice(0, -places)}.${s.slice(-places)}` : s;
  if (!keepZeros && places) out = out.replace(/0+$/, '').replace(/\.$/, '');
  return (neg && out !== '0' ? '-' : '') + out;
}

// A decimal's value as an integer number of 10^-places (for column math): ("3.5", 2) -> 350.
export function toScaled(text, places) {
  const f = parseDecimal(text);
  return (f.n * 10 ** places) / f.d;
}

// The decimal for a fraction n / 10^places, as a fraction value (exact).
export const decimal = (text) => {
  const f = parseDecimal(text);
  if (!f) throw new Error(`decimal: not a decimal "${text}"`);
  return f;
};

// Same value?
export const sameDecimal = (a, b) => {
  const x = parseDecimal(a);
  const y = parseDecimal(b);
  return Boolean(x && y) && x.n * y.d === y.n * x.d;
};

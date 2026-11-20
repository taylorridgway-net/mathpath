// Generators for "Add and subtract whole numbers" (whole.add-sub):
// 2- and 3-digit numbers with regrouping (owner decision: no larger numbers).
// See engine/generators/frac/add-sub.js for what a generator returns.

import { int, op, digits, fromDigits, pickUntil, misconceptionList } from './common.js';

const answer = (value) => ({ type: 'integer', value });

// ---------- add with carrying ----------
//   1: 2-digit + 2-digit, carry from the ones, sum under 100      (47 + 38)
//   2: 3-digit + 2- or 3-digit, exactly one carry                (365 + 218)
//   3: 3-digit + 3-digit, carries from the ones AND the tens      (478 + 356)

const carries = (a, b) => {
  const da = digits(a);
  const db = digits(b);
  const out = [];
  let carry = 0;
  for (let i = 0; i < Math.max(da.length, db.length); i++) {
    const sum = (da[i] || 0) + (db[i] || 0) + carry;
    carry = sum >= 10 ? 1 : 0;
    out.push(carry);
  }
  return out; // out[i] = 1 if column i carries into column i + 1
};

// What a student who never carries writes: each column's ones digit (47 + 38 -> 75).
export const addNoCarry = (a, b) => {
  const da = digits(a);
  const db = digits(b);
  return fromDigits(Array.from({ length: Math.max(da.length, db.length) }, (_, i) => ((da[i] || 0) + (db[i] || 0)) % 10));
};
// What a student who writes each column's whole sum writes (47 + 38 -> 715).
export const addColumnSums = (a, b) => {
  const da = digits(a);
  const db = digits(b);
  const cols = Array.from({ length: Math.max(da.length, db.length) }, (_, i) => (da[i] || 0) + (db[i] || 0));
  return Number(cols.reverse().join(''));
};

const addRegroup = {
  version: 1,
  generate(rng, difficulty) {
    const [a, b] = pickUntil(rng, () => {
      if (difficulty === 1) return [rng.int(11, 89), rng.int(11, 89)];
      if (difficulty === 2) return [rng.int(101, 899), rng.chance(0.5) ? rng.int(11, 99) : rng.int(101, 899)];
      return [rng.int(101, 899), rng.int(101, 899)];
    }, ([x, y]) => {
      const c = carries(x, y);
      if (difficulty === 1) return c[0] === 1 && x + y < 100;
      if (difficulty === 2) return c.filter(Boolean).length === 1 && x + y < 1000;
      return c[0] === 1 && c[1] === 1;
    });
    const sum = a + b;
    return {
      instruction: 'Add.',
      expression: op('+', int(a), int(b)),
      answer: answer(sum),
      misconceptions: misconceptionList(sum, [
        { id: 'whole.no-carry', value: addNoCarry(a, b) },
        { id: 'whole.column-sums', value: addColumnSums(a, b) },
      ]),
    };
  },
};

// ---------- subtract with borrowing ----------
//   1: 2-digit - 2-digit, borrow from the tens                   (52 - 27)
//   2: 3-digit - 2- or 3-digit, borrowing, no zero to borrow across (642 - 278)
//   3: borrow across a zero                                       (503 - 278, 400 - 163)

// What a student who subtracts the smaller digit from the larger in each column writes (52 - 27 -> 35).
export const subSmallerFromLarger = (a, b) => {
  const da = digits(a);
  const db = digits(b);
  return fromDigits(da.map((d, i) => Math.abs(d - (db[i] || 0))));
};
// What a student who borrows but never takes 1 away from the next column writes (503 - 278 -> 335).
export const subBorrowNoDecrease = (a, b) => {
  const da = digits(a);
  const db = digits(b);
  return fromDigits(da.map((d, i) => (d >= (db[i] || 0) ? d - (db[i] || 0) : d + 10 - (db[i] || 0))));
};
const needsBorrow = (a, b) => digits(a).some((d, i) => d < (digits(b)[i] || 0));

const subRegroup = {
  version: 1,
  generate(rng, difficulty) {
    const [a, b] = pickUntil(rng, () => {
      if (difficulty === 1) return [rng.int(30, 99), rng.int(11, 89)];
      if (difficulty === 2) return [rng.int(200, 999), rng.chance(0.5) ? rng.int(11, 99) : rng.int(101, 899)];
      // A zero in the tens (503) or both lower places (400).
      const hundreds = rng.int(2, 9);
      const top = rng.chance(0.6) ? hundreds * 100 + rng.int(1, 8) : hundreds * 100;
      return [top, rng.int(101, top - 1)];
    }, ([x, y]) => {
      if (x <= y || !needsBorrow(x, y)) return false;
      const dx = digits(x);
      const dy = digits(y);
      if (difficulty === 1) return dx[0] < dy[0];
      if (difficulty === 2) return !dx.slice(0, -1).includes(0) && x - y >= 10;
      return dx[1] === 0 && dx[0] < (dy[0] || 0) && x - y >= 10; // must borrow across the zero
    });
    const diff = a - b;
    return {
      instruction: 'Subtract.',
      expression: op('-', int(a), int(b)),
      answer: answer(diff),
      misconceptions: misconceptionList(diff, [
        { id: 'whole.smaller-from-larger', value: subSmallerFromLarger(a, b) },
        { id: 'whole.borrow-no-decrease', value: subBorrowNoDecrease(a, b) },
      ]),
    };
  },
};

// ---------- the whole skill: a mix (Putting it together, diagnostic screener) ----------

const mixed = {
  version: 1,
  mixed: true, // a mix of its parts, not one whole problem (the diagnostic asks the parts instead)
  covers: ['whole.add-sub.add-regroup', 'whole.add-sub.sub-regroup'],
  generate(rng, difficulty) {
    const part = rng.chance(0.5) ? 'whole.add-sub.add-regroup' : 'whole.add-sub.sub-regroup';
    const gen = part.endsWith('add-regroup') ? addRegroup : subRegroup;
    return { ...gen.generate(rng, difficulty), part };
  },
};

export const wholeAddSubGenerators = {
  'whole.add-sub': mixed,
  'whole.add-sub.add-regroup': addRegroup,
  'whole.add-sub.sub-regroup': subRegroup,
};

// Step-by-step worked solutions for whole-number problems, built from the
// problem as displayed (like engine/solutions/frac-add-sub.js). Used for the
// worked example in a lesson, and after a student misses twice.
//
// A solution is a list of steps: { say, show? }.

const int = (value) => ({ type: 'int', value });
const op = (sym, left, right) => ({ type: 'op', op: sym, left, right });
const eq = (left, right) => ({ type: 'eq', left, right });
const PLACES = ['ones', 'tens', 'hundreds', 'thousands'];
const digits = (n) => String(n).split('').reverse().map(Number);
const factorsOf = (n) => Array.from({ length: n }, (_, i) => i + 1).filter((d) => n % d === 0);
const gcd = (a, b) => (b ? gcd(b, a % b) : a);

export function solveWhole(problem) {
  const kind = problem.part || problem.generator;
  const e = problem.expression;
  const nums = () => (e.items ? e.items.map((i) => i.value) : [e.left.value, e.right.value]);
  const the = (text) => Number(text.match(/\d+/)[0]);
  switch (kind) {
    case 'whole.add-sub.add-regroup': return addSteps(...nums());
    case 'whole.add-sub.sub-regroup': return subSteps(...nums());
    case 'whole.mult-div.mult-facts': return multSteps(...nums());
    case 'whole.mult-div.div-facts': return divSteps(...nums());
    case 'whole.mult-div.remainders': return remainderSteps(...nums());
    case 'whole.factors-multiples.factors': return factorSteps(the(problem.instruction));
    case 'whole.factors-multiples.primes': return primeSteps(the(problem.instruction));
    case 'whole.factors-multiples.gcf': return gcfSteps(...nums());
    case 'whole.factors-multiples.lcm': return lcmSteps(...nums());
    default: throw new Error(`No worked solution for "${kind}"`);
  }
}

function addSteps(a, b) {
  const da = digits(a);
  const db = digits(b);
  const steps = [{ say: `Line up the places and add one column at a time, starting with the ones.` }];
  let carry = 0;
  const out = [];
  for (let i = 0; i < Math.max(da.length, db.length); i++) {
    const parts = [da[i] || 0, db[i] || 0, ...(carry ? [carry] : [])];
    const sum = parts.reduce((s, x) => s + x, 0);
    const carried = carry ? ` (with the 1 carried)` : '';
    if (sum >= 10) {
      steps.push({ say: `${cap(PLACES[i])}: ${parts.join(' + ')} = ${sum}${carried}. Write ${sum % 10} and carry 1 to the ${PLACES[i + 1]}.` });
    } else {
      steps.push({ say: `${cap(PLACES[i])}: ${parts.join(' + ')} = ${sum}${carried}. Write ${sum}.` });
    }
    out.push(sum % 10);
    carry = sum >= 10 ? 1 : 0;
  }
  if (carry) steps.push({ say: `Write the carried 1 in the ${PLACES[out.length]}.` });
  steps.push({ say: `So ${a} + ${b} = ${a + b}.`, show: eq(op('+', int(a), int(b)), int(a + b)) });
  return steps;
}

function subSteps(a, b) {
  const top = digits(a);
  const db = digits(b);
  const steps = [{ say: `Line up the places and subtract one column at a time, starting with the ones.` }];
  for (let i = 0; i < top.length; i++) {
    const bottom = db[i] || 0;
    if (i >= db.length && top.slice(i).every((d) => d === 0)) break;
    if (top[i] < bottom) {
      // Borrow from the nearest place to the left that isn't 0.
      let j = i + 1;
      while (top[j] === 0) j++;
      const passes = j - i - 1;
      let say = `${cap(PLACES[i])}: ${top[i]} is less than ${bottom}, so borrow. `;
      if (passes === 0) {
        say += `Take 1 from the ${PLACES[j]} (${top[j]} becomes ${top[j] - 1}), so the ${PLACES[i]} become ${top[i] + 10}.`;
      } else {
        say += `The ${PLACES[i + 1]} digit is 0, so borrow from the ${PLACES[j]} first: ${top[j]} becomes ${top[j] - 1} and the ${PLACES[j - 1]} become 10. Then take 1 of those: the ${PLACES[i + 1]} become 9 and the ${PLACES[i]} become ${top[i] + 10}.`;
      }
      top[j] -= 1;
      for (let k = j - 1; k > i; k--) top[k] = 9;
      top[i] += 10;
      steps.push({ say });
    }
    steps.push({ say: `${cap(PLACES[i])}: ${top[i]} − ${bottom} = ${top[i] - bottom}.` });
  }
  steps.push({ say: `So ${a} − ${b} = ${a - b}.`, show: eq(op('-', int(a), int(b)), int(a - b)) });
  return steps;
}

function multSteps(a, b) {
  const product = a * b;
  const [small, big] = a <= b ? [a, b] : [b, a];
  const steps = [];
  if ([2, 5, 10].includes(small)) {
    const counts = Array.from({ length: big }, (_, i) => (i + 1) * small);
    steps.push({ say: `Count by ${small}s, ${big} times: ${counts.join(', ')}.` });
  } else if (big > 5) {
    // Split the bigger factor: 7 × 8 = 7 × 5 + 7 × 3 (or 10 + 2 for 12).
    const first = big === 12 || big === 11 ? 10 : 5;
    const rest = big - first;
    steps.push({ say: `Split ${big} into ${first} + ${rest}: ${small} × ${first} = ${small * first} and ${small} × ${rest} = ${small * rest}.` });
    steps.push({ say: `Add them: ${small * first} + ${small * rest} = ${product}.` });
  } else {
    const counts = Array.from({ length: small }, (_, i) => (i + 1) * big);
    steps.push({ say: `Count by ${big}s, ${small} times: ${counts.join(', ')}.` });
  }
  steps.push({ say: `So ${a} × ${b} = ${product}.`, show: eq(op('×', int(a), int(b)), int(product)) });
  return steps;
}

function divSteps(n, d) {
  const q = n / d;
  return [
    { say: `Think: what times ${d} makes ${n}?` },
    { say: `${d} × ${q} = ${n}, so ${n} ÷ ${d} = ${q}.`, show: eq(op('÷', int(n), int(d)), int(q)) },
  ];
}

function remainderSteps(n, d) {
  const q = Math.floor(n / d);
  const r = n % d;
  return [
    { say: `Find the biggest multiple of ${d} that fits in ${n}: ${d} × ${q} = ${q * d} (and ${d} × ${q + 1} = ${(q + 1) * d} is too big).` },
    { say: `What's left over: ${n} − ${q * d} = ${r}.` },
    { say: `So ${n} ÷ ${d} = ${q} R ${r}. Check: the remainder ${r} is less than ${d}, as it must be.` },
  ];
}

function factorSteps(n) {
  const pairs = [];
  for (let d = 1; d * d <= n; d++) if (n % d === 0) pairs.push([d, n / d]);
  const all = factorsOf(n);
  return [
    { say: `Try 1, 2, 3, ... and write each factor with its partner. Stop when the numbers meet.` },
    { say: `${pairs.map(([x, y]) => `${x} × ${y}`).join(', ')}.` },
    { say: `So the factors of ${n} are ${all.join(', ')}.` },
  ];
}

function primeSteps(n) {
  const steps = [{ say: `Split ${n} into two factors, and keep splitting until every number is prime.` }];
  const primes = [];
  let m = n;
  for (let p = 2; m > 1; p++) {
    while (m % p === 0) {
      if (m !== p) steps.push({ say: `${m} = ${p} × ${m / p}. ${p} is prime.` });
      primes.push(p);
      m /= p;
    }
  }
  steps.push({ say: `So ${n} = ${primes.join(' × ')}.` });
  return steps;
}

function gcfSteps(a, b) {
  const fa = factorsOf(a);
  const fb = factorsOf(b);
  const common = fa.filter((x) => fb.includes(x));
  return [
    { say: `Factors of ${a}: ${fa.join(', ')}.` },
    { say: `Factors of ${b}: ${fb.join(', ')}.` },
    { say: `In both lists: ${common.join(', ')}. The greatest is ${gcd(a, b)}.`, show: int(gcd(a, b)) },
  ];
}

function lcmSteps(a, b) {
  const [small, big] = a <= b ? [a, b] : [b, a];
  const least = (a * b) / gcd(a, b);
  const counts = [];
  for (let m = big; m <= least; m += big) counts.push(m);
  return [
    { say: `Count by the bigger number, ${big}: ${counts.join(', ')}.` },
    { say: `Stop at the first one ${small} also divides into: ${least} (${small} × ${least / small}).`, show: int(least) },
  ];
}

const cap = (s) => s[0].toUpperCase() + s.slice(1);

// Statistics and probability: every answer worked out here from the shown data alone (exact
// fractions), every wrong-answer pattern wrong, recognised and in the catalog.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateProblem, generators, DIFFICULTIES } from '../../../engine/generators/index.js';
import { checkAnswer } from '../../../engine/grading/check-answer.js';
import { toText } from '../../../engine/problem/text.js';
import { fraction, equals, reduce } from '../../../engine/math/fraction.js';
import { parseDecimal } from '../../../engine/math/decimal.js';

const SEEDS = Array.from({ length: 250 }, (_, i) => `st-${i}`);
const catalog = new Map(JSON.parse(readFileSync(new URL('../../../curriculum/misconceptions/stat.json', import.meta.url), 'utf8')).misconceptions.map((m) => [m.id, m.pointsTo]));
const PARTS = Object.keys(generators).filter((id) => id.startsWith('stat.') && id.split('.').length === 3);
const F = (n, d = 1) => fraction(n, d);
const nums = (t) => (t.match(/-?\d+/g) || []).map(Number);
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); const n = s.length; return n % 2 ? F(s[(n - 1) / 2]) : F(s[n / 2 - 1] + s[n / 2], 2); };

function expected(id, p) {
  const t = toText(p.expression);
  const ins = p.instruction;
  let m;
  if (t.startsWith('[a dot plot')) {
    const values = [...t.matchAll(/(\d+) at (\d+)/g)].flatMap((x) => Array(+x[1]).fill(+x[2]));
    if (/How many/.test(ins)) return F(values.length);
    if (/mode/.test(ins)) { const c = {}; for (const v of values) c[v] = (c[v] || 0) + 1; const top = Math.max(...Object.values(c)); return F(Number(Object.keys(c).find((k) => c[k] === top))); }
    return median(values);
  }
  if (t.startsWith('[a bar graph')) {
    const bars = Object.fromEntries([...t.matchAll(/(\w+) (\d+)/g)].map((x) => [x[1], +x[2]]));
    if ((m = /chose (\w+)\?/.exec(ins))) return F(bars[m[1]]);
    if ((m = /chose (\w+) than (\w+)/.exec(ins))) return F(bars[m[1]] - bars[m[2]]);
    return F(Object.values(bars).reduce((a, b) => a + b, 0));
  }
  if (t.startsWith('[a box plot')) {
    const [min, q1, med, q3, max] = [...t.matchAll(/(?:min|Q1|median|Q3|max) (\d+)/g)].map((x) => +x[1]);
    return /median/.test(ins) ? F(med) : /interquartile/.test(ins) ? F(q3 - q1) : F(max - min);
  }
  if ((m = /mean of (\d+) numbers is (\d+)\. \d+ of them are ([\d, ]+)\./.exec(t))) return F(m[1] * m[2] - nums(m[3]).reduce((a, b) => a + b, 0));
  if (/^(Data|Morning temperatures)/.test(t)) {
    const xs = nums(t.split(': ')[1]);
    if (/mean/.test(ins)) return F(xs.reduce((a, b) => a + b, 0), xs.length);
    if (/median/.test(ins)) return median(xs);
    if (/mode/.test(ins)) { const c = {}; for (const v of xs) c[v] = (c[v] || 0) + 1; const top = Math.max(...Object.values(c)); return F(Number(Object.keys(c).find((k) => c[k] === top))); }
    return F(Math.max(...xs) - Math.min(...xs));
  }
  if ((m = /bag has (\d+) red, (\d+) blue and (\d+) green/.exec(t))) {
    const [r, b, g] = [+m[1], +m[2], +m[3]];
    const total = r + b + g;
    return /NOT blue/.test(t) ? F(r + g, total) : /red or blue/.test(t) ? F(r + b, total) : F(r, total);
  }
  if (/number cube \(1 to 6\)/.test(t)) {
    const tests = { 'an even number': (v) => v % 2 === 0, 'a number greater than 4': (v) => v > 4, 'a 6': (v) => v === 6, 'a number less than 3': (v) => v < 3, 'a multiple of 3': (v) => v % 3 === 0 };
    const what = /rolling (.+)\?/.exec(t)[1];
    return F([1, 2, 3, 4, 5, 6].filter(tests[what]).length, 6);
  }
  // Probabilities of single events, from the words.
  const prob = (w) => {
    if (/heads|tails/.test(w)) return F(1, 2);
    if (/even number|odd number/.test(w)) return F(1, 2);
    const sp = /spinner with (\d+) equal parts \(1 (?:of them )?\w+\)/.exec(w);
    if (sp) return F(1, +sp[1]);
    if (/less than 3 on a number cube/.test(w)) return F(1, 3);
    if (/a (\d) (?:on a )?number cube|a \d$/.test(w) || /^a \d/.test(w)) return F(1, 6);
    throw new Error(`no probability for "${w}"`);
  };
  if ((m = /getting (.+) and (.+)\?$/.exec(t))) { const [w1, w2] = [m[1], m[2]]; const [a, b] = [prob(w1), prob(w2)]; return reduce(F(a.n * b.n, a.d * b.d)); }
  if ((m = /You (.+) (\d+) times\. About how many times would you expect (.+)\?/.exec(t))) {
    const p = /coin/.test(m[1]) ? F(1, 2) : /spinner with (\d+)/.test(m[1]) ? F(1, Number(/spinner with (\d+)/.exec(m[1])[1])) : /even/.test(m[3]) ? F(1, 2) : F(1, 6);
    return F(+m[2] * p.n, p.d);
  }
  throw new Error(`can't read: ${t}`);
}

for (const id of PARTS) {
  test(`${id}: answers worked out from the shown data; mistakes wrong and recognised`, () => {
    for (const d of DIFFICULTIES) for (const seed of SEEDS) {
      const p = generateProblem(id, seed, d);
      const t = toText(p.expression);
      const want = expected(id, p);
      const a = p.answer;
      const got = a.type === 'decimal' ? parseDecimal(a.value) : a.value;
      assert.ok(equals(got, want), `${p.instruction} ${t}: got ${got.n}/${got.d}, want ${want.n}/${want.d}`);
      const raw = (v) => (a.type === 'decimal' ? { decimal: v } : { num: v.n, den: v.d });
      assert.equal(checkAnswer(p, a.type === 'decimal' ? { decimal: a.value } : (a.value.d === 1 ? { whole: a.value.n } : { num: a.value.n, den: a.value.d })).status, 'correct', t);
      for (const m of p.misconceptions) {
        assert.ok(catalog.get(m.id), m.id);
        const r = checkAnswer(p, raw(m.value));
        assert.notEqual(r.status, 'correct', `${t}: ${m.id}`);
        if (r.status === 'wrong') assert.equal(r.misconception, m.id, t);
      }
    }
  });
}

test('statistics: every catalog mistake is generated', () => {
  const seen = new Set();
  for (const id of PARTS) for (const d of DIFFICULTIES) for (const s of SEEDS) for (const m of generateProblem(id, s, d).misconceptions) seen.add(m.id);
  assert.deepEqual([...seen].sort(), [...catalog.keys()].sort());
});

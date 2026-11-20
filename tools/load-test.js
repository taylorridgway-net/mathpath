// Load test: can the Google Sheet keep up with a full class load?
// Run with: npm run load-test          (or: node tools/load-test.js --save-ms 1200)
//
// PART 1 (measured, real code): a pretend class of 6 periods x 45 students goes
// through the real server code and the real Sheets store (on a fake spreadsheet):
// every diagnostic and section is saved, 1 in 10 saves is sent twice (like a retry
// after a dropped connection), and we count what each save costs.
//
// PART 2 (modelled): Google's actual speed can't be measured from here, so this
// part SIMULATES the busiest moments (a whole period saving at the bell) using an
// assumed time per save. Replace the assumption with the real number from
// speedCheck() in the Apps Script editor (docs/SETUP-GOOGLE.md), with --save-ms.
//
// Pretend students only. Nothing here touches a real spreadsheet.

import { readFileSync } from 'node:fs';
import { buildGraphIndex } from '../engine/graph/graph-index.js';
import { generators } from '../engine/generators/index.js';
import { startDiagnostic } from '../engine/diagnostic/diagnostic.js';
import { startPractice } from '../engine/practice/practice.js';
import { buildPath } from '../engine/lessons/path.js';
import { seedFor } from '../engine/seeds.js';
import { practicePlan } from '../engine/lessons/plan.js';
import { createRng } from '../engine/random.js';
import { reduce } from '../engine/math/fraction.js';
import { createServer } from '../server/core/server.js';
import { createSheetsStore, ensureTabs } from '../server/apps-script/store-sheets.js';
import { simulatedStudent } from './simulated-student.js';
import { fakeSpreadsheet, fakeLockService } from '../tests/helpers/fake-sheets.js';

const read = (p) => JSON.parse(readFileSync(new URL(`../curriculum/${p}`, import.meta.url), 'utf8'));
const domains = read('graph/domains.json');
const files = {};
for (const d of domains.domains) files[d.file] = read(`graph/${d.file}`);
const setup = {
  graph: buildGraphIndex(domains, files),
  generators,
  misconceptions: [...read('misconceptions/frac.json').misconceptions, ...read('misconceptions/whole.json').misconceptions, ...read('misconceptions/int.json').misconceptions, ...read('misconceptions/alg.json').misconceptions],
  diagnosticConfig: read('diagnostic/frac.json'),
  lessons: ['whole.add-sub', 'whole.mult-div', 'whole.factors-multiples', 'frac.meaning', 'frac.equivalent', 'frac.compare', 'frac.add-sub', 'frac.multiply', 'frac.divide', 'int.add-sub', 'int.mult-div', 'frac.signed', 'alg.order-ops', 'alg.exponents', 'alg.equations', 'alg.expressions'].map((s) => read(`lessons/${s}.json`)),
  rules: read('mastery.json').default,
};

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? Number(args[i + 1]) : fallback;
};
const PERIODS = arg('periods', 6);
const PER_PERIOD = arg('students', 45);
const SAVE_MS = arg('save-ms', 1500); // ASSUMED time one save takes on Google (see PART 2)
const LOCK_WAIT_MS = 25000; // server/apps-script/store-sheets.js
const MAX_RUNNING = 30; // Google's limit on one script's calls running at once
const RETRY_SECONDS = [15, 30, 60, 120]; // web/student/main.js

// ======================= PART 1: the real code at full size =======================

const rng = createRng('load-test');
const spreadsheet = fakeSpreadsheet();
ensureTabs(spreadsheet);
const locks = fakeLockService();
const TEACHER = 'teacher@school.org';
createSheetsStore({ spreadsheet, lockService: locks }).addTeacher(TEACHER);
// A new store per request, as on Google.
const server = () => createServer({ store: createSheetsStore({ spreadsheet, lockService: locks }), setup, random: rng.next });

const t0 = Date.now();
const kids = [];
for (let p = 1; p <= PERIODS; p++) {
  const cls = server().teacher.addClass(TEACHER, `Period ${p}`).class;
  const names = Array.from({ length: PER_PERIOD }, (_, i) => `Pretend ${p}-${i + 1}`);
  kids.push(...server().teacher.addStudents(TEACHER, cls.id, names).students);
}

const PROFILES = [{}, { lacks: ['frac.add-sub.combine'], misconceptions: ['frac.add-across'] }, { lacks: ['frac.equivalent.simplify'] },
  { lacks: ['frac.add-sub.common-denom'] }, { failsWhole: ['frac.add-sub'] }];
const right = (problem) => {
  const a = problem.answer;
  if (a.type === 'quotient-remainder') return { whole: a.quotient, rem: a.remainder };
  if (a.type === 'set' || a.type === 'multiset') return { list: [...a.values] };
  if (a.form === 'exact') return { num: a.n, den: a.d };
  if (a.type === 'choice') return { choice: a.correct };
  if (a.type === 'integer') return { whole: Math.abs(a.value), ...(a.value < 0 ? { negative: true } : {}) };
  if (a.type === 'linear') return { coef: a.coef, constant: a.constant };
  if (a.type === 'common-multiple') return { whole: a.least };
  const v = reduce(a.value);
  return { ...(v.d === 1 ? { whole: Math.abs(v.n) } : { num: Math.abs(v.n), den: v.d }), ...(v.n < 0 ? { negative: true } : {}) };
};

const costs = []; // per save: { reads, writes, ms, chars }
const sheetsOps = () => {
  let reads = 0;
  let writes = 0;
  for (const s of spreadsheet.sheets.values()) {
    reads += s.reads;
    writes += s.writes;
  }
  return { reads, writes };
};
let duplicatesSent = 0;
let refused = 0;

function save(code, record) {
  const before = sheetsOps();
  const start = performance.now();
  const res = server().student.saveRecord(code, record);
  const after = sheetsOps();
  costs.push({ reads: after.reads - before.reads, writes: after.writes - before.writes, ms: performance.now() - start, chars: JSON.stringify(record).length });
  if (!res.ok) refused++;
  if (rng.chance(0.1)) { // the same save again, as after a dropped connection
    duplicatesSent++;
    server().student.saveRecord(code, record);
  }
  return res;
}

for (const [i, kid] of kids.entries()) {
  const traits = PROFILES[i % PROFILES.length];
  const pretend = simulatedStudent({ graph: setup.graph, generators, ...traits });
  const seed = seedFor(kid.id, 'diagnostic', 1);
  const d = startDiagnostic({ graph: setup.graph, generators, misconceptions: setup.misconceptions, config: setup.diagnosticConfig, seed });
  const answers = [];
  for (let q = d.nextQuestion(); q; q = d.nextQuestion()) { answers.push(pretend.answer(q.problem)); d.submit(answers.at(-1)); }
  save(kid.code, { type: 'diagnostic', saveId: `${seed}|d`, attemptNo: 1, seed, answers, times: answers.map(() => 20000) });

  // Practice: every section on the path (ignoring teacher checks, to make more saves), 1-3 tries each.
  const path = buildPath({ result: d.result(), lessons: setup.lessons, graph: setup.graph }).filter((x) => x.kind === 'section');
  for (const item of path) {
    const sec = setup.lessons.flatMap((l) => l.sections).find((s) => s.id === item.section);
    for (let attemptNo = 1; attemptNo <= 3; attemptNo++) {
      const sseed = seedFor(kid.id, sec.id, attemptNo);
      const p = startPractice({ generators, rules: setup.rules, seed: sseed, plan: practicePlan(sec) });
      const skill = 0.5 + 0.2 * attemptNo;
      const sa = [];
      for (let c = p.currentProblem(); c; c = p.currentProblem()) { sa.push(rng.chance(skill) ? right(c.problem) : {}); p.submit(sa.at(-1)); }
      const res = save(kid.code, { type: 'lesson-section', saveId: `${sseed}|s`, section: sec.id, attemptNo, seed: sseed, answers: sa, times: sa.map(() => 40000) });
      if (res.result?.passed) break;
    }
  }
}
const part1Seconds = (Date.now() - t0) / 1000;

const sections = spreadsheet.getSheetByName('Sections');
const rowsOf = (name) => spreadsheet.getSheetByName(name).rows.length - 1;
const maxCell = Math.max(...[...spreadsheet.sheets.values()].flatMap((s) => s.rows.flat().map((v) => String(v).length)));
const dataStart = performance.now();
const dash = server().teacher.teacherData(TEACHER);
const dashMs = performance.now() - dataStart;
const dashChars = JSON.stringify(dash).length;
const detailChars = Math.max(...kids.slice(0, 20).map((k) => JSON.stringify(server().teacher.studentDetail(TEACHER, k.id)).length));
const sectionsCells = sections.rows.reduce((n, r) => n + r.length, 0);
const avgSectionChars = sections.rows.slice(1).reduce((n, r) => n + r.map(String).join('').length, 0) / Math.max(1, rowsOf('Sections'));
const sorted = (xs) => [...xs].sort((a, b) => a - b);
const pct = (xs, q) => sorted(xs)[Math.min(xs.length - 1, Math.floor(q * xs.length))];

// ======================= PART 2: timing model for Google =======================

// Saves arrive at given times (ms); each holds the lock SAVE_MS. A save that
// can't get the lock within LOCK_WAIT_MS, or arrives while MAX_RUNNING calls are
// already running, fails as "busy" and the browser retries on its schedule.
function simulate(arrivals) {
  let queue = arrivals.map((at, id) => ({ id, at, tries: 0 })).sort((a, b) => a.at - b.at);
  let lockFreeAt = 0;
  const running = []; // end times of calls currently running (waiting or saving)
  let busy = 0;
  let maxWait = 0;
  let lastDone = 0;
  while (queue.length) {
    const req = queue.shift();
    for (let i = running.length - 1; i >= 0; i--) if (running[i] <= req.at) running.splice(i, 1);
    const start = Math.max(req.at, lockFreeAt);
    const wait = start - req.at;
    if (running.length >= MAX_RUNNING || wait > LOCK_WAIT_MS) {
      busy++;
      running.push(req.at + Math.min(wait, LOCK_WAIT_MS));
      const retryAt = req.at + Math.min(wait, LOCK_WAIT_MS) + RETRY_SECONDS[Math.min(req.tries, RETRY_SECONDS.length - 1)] * 1000;
      queue.push({ ...req, at: retryAt, tries: req.tries + 1 });
      queue.sort((a, b) => a.at - b.at);
      continue;
    }
    lockFreeAt = start + SAVE_MS;
    running.push(lockFreeAt);
    maxWait = Math.max(maxWait, wait);
    lastDone = Math.max(lastDone, lockFreeAt);
  }
  return { busy, maxWaitS: maxWait / 1000, allSavedAfterS: lastDone / 1000 };
}

const timing = new Map();
const spread = (n, withinMs) => Array.from({ length: n }, () => rng.next() * withinMs);
timing.set(`One period of ${PER_PERIOD}, saves spread over a 50-minute class (3 each)`, simulate(spread(PER_PERIOD * 3, 50 * 60000)));
timing.set(`One period of ${PER_PERIOD}, everyone saves within 10 seconds (the bell)`, simulate(spread(PER_PERIOD, 10000)));
timing.set(`Stress: all ${PERIODS * PER_PERIOD} students save within 1 minute`, simulate(spread(PERIODS * PER_PERIOD, 60000)));

// ======================= report =======================

const reads = costs.map((c) => c.reads);
const writes = costs.map((c) => c.writes);
const out = [];
out.push(`MathPath load test: ${PERIODS} periods x ${PER_PERIOD} students = ${kids.length} pretend students`);
out.push('');
out.push('PART 1, measured with the real server code (fake spreadsheet):');
out.push(`  saves: ${costs.length} (+${duplicatesSent} sent twice on purpose; ${refused} refused)`);
out.push(`  rows stored: Diagnostics ${rowsOf('Diagnostics')}, Sections ${rowsOf('Sections')} (one per finished section; duplicates stored: ${rowsOf('Diagnostics') + rowsOf('Sections') - costs.length + refused})`);
out.push(`  spreadsheet calls per save: reads ${pct(reads, 0.5)} typical / ${Math.max(...reads)} max, writes ${pct(writes, 0.5)} typical / ${Math.max(...writes)} max`);
out.push(`  server time per save here (Node): ${pct(costs.map((c) => c.ms), 0.5).toFixed(1)} ms typical, ${Math.max(...costs.map((c) => c.ms)).toFixed(1)} ms max`);
out.push(`  largest cell: ${maxCell.toLocaleString()} characters (Google's limit: 50,000)`);
out.push(`  average Sections row: ${Math.round(avgSectionChars).toLocaleString()} characters; Sections tab: ${sectionsCells.toLocaleString()} cells (Google's limit: 10,000,000 per spreadsheet)`);
out.push(`  dashboard data for all ${kids.length} students: ${(dashChars / 1024).toFixed(0)} KB (built in ${dashMs.toFixed(0)} ms here); one student's full details: ${(detailChars / 1024).toFixed(0)} KB max`);
out.push(`  part 1 took ${part1Seconds.toFixed(1)} s`);
out.push('');
out.push(`PART 2, MODELLED (assumes each save takes ${SAVE_MS} ms on Google; measure the real number with speedCheck()):`);
for (const [name, r] of timing) {
  out.push(`  ${name}:`);
  out.push(`    longest wait ${r.maxWaitS.toFixed(1)} s; "busy" replies ${r.busy} (each retried automatically); everything saved after ${r.allSavedAfterS.toFixed(0)} s`);
}
console.log(out.join('\n'));

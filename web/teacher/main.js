// The teacher dashboard (preview version, with a pretend class).
//
// PREVIEW ONLY: there is no server yet. The class is made up (tools/synthetic-class.js:
// pretend students run through the real diagnostic and practice engine), and the
// teacher's own changes (paper-test scores, checks, code resets) are kept in this
// browser. In the real app all of this comes from and goes to the server, and a
// teacher sees only their own classes.
//
// All the thinking is in engine/teacher/ (tested); this file draws.

import domainsIndex from '../../curriculum/graph/domains.json';
import wholeGraph from '../../curriculum/graph/whole.json';
import intGraph from '../../curriculum/graph/int.json';
import fracGraph from '../../curriculum/graph/frac.json';
import fracMisconceptions from '../../curriculum/misconceptions/frac.json';
import fracDiagnostic from '../../curriculum/diagnostic/frac.json';
import addSubLesson from '../../curriculum/lessons/frac.add-sub.json';
import addSubPaper from '../../curriculum/paper/frac.add-sub.json';
import masteryRules from '../../curriculum/mastery.json';
import { buildGraphIndex } from '../../engine/graph/graph-index.js';
import { generators, generateProblem } from '../../engine/generators/index.js';
import { replayDiagnostic } from '../../engine/diagnostic/diagnostic.js';
import { toText } from '../../engine/problem/text.js';
import { createRng } from '../../engine/random.js';
import { studentStatus, countStatuses } from '../../engine/teacher/student-status.js';
import { teachTogether } from '../../engine/teacher/groups.js';
import { participation } from '../../engine/teacher/participation.js';
import { scorePaperTest, verificationRecord } from '../../engine/teacher/verification.js';
import { syntheticClass } from '../../tools/synthetic-class.js';
import { diagnosticReport } from '../components/diagnostic-report.js';
import { renderLessonText } from '../components/lesson-text.js';
import { rawToText } from '../components/answer-editor.js';
import { loadLocal, saveLocal } from '../storage/local.js';
import { h, btn, pill, list, swap } from '../components/dom.js';

// ---------- curriculum and engine ----------

const graph = buildGraphIndex(domainsIndex, { 'whole.json': wholeGraph, 'int.json': intGraph, 'frac.json': fracGraph });
const misconceptions = fracMisconceptions.misconceptions;
const lessons = [addSubLesson];
const papers = { [addSubPaper.skill]: addSubPaper };
const rules = masteryRules.default;
const setup = { graph, generators, misconceptions, diagnosticConfig: fracDiagnostic, lessons, rules };
const sectionTitle = new Map(lessons.flatMap((l) => l.sections.map((s) => [s.id, s.title])));
const misconceptionInfo = new Map(misconceptions.map((m) => [m.id, m]));
const FRACTION_SKILLS = fracGraph.skills.map((s) => s.id);
const ME = 'you (preview)';

// ---------- the teacher's saved changes (preview: this browser only) ----------

const STORE_KEY = 'mathpath.teacher-preview.v1';
const store = Object.assign(
  { periods: 3, classSeed: 'sample-1', expected: 3, verifications: [], clearances: [], log: [], codeChanges: {} },
  loadLocal(STORE_KEY) || {},
);
const persist = () => saveLocal(STORE_KEY, store);
function logChange(code, what, before, after) {
  store.log.push({ at: new Date().toISOString(), by: ME, code, what, before, after });
}

// ---------- build the class ----------

let data;
let students; // [{ code, shownCode, nickname, classId, name, diagnostic, result, sections, status, part }]
const now = new Date().toISOString();

function periodSizes(count, seed) {
  const rng = createRng(`sizes|${seed}`);
  return Array.from({ length: count }, () => ({ size: rng.int(20, 45) }));
}

function buildClass() {
  data = syntheticClass({ periods: periodSizes(store.periods, store.classSeed), seed: store.classSeed, now, setup });
  const nameOf = new Map(data.roster.map((r) => [r.code, r.realName]));
  students = data.students.map((s) => {
    const diagnostic = data.diagnostics.find((d) => d.code === s.code) || null;
    // Re-created from the saved seed and answers, the way the server will check it.
    const result = diagnostic
      ? replayDiagnostic({ graph, generators, misconceptions, config: fracDiagnostic, seed: diagnostic.seed }, diagnostic.answers).result()
      : null;
    return {
      ...s,
      name: nameOf.get(s.code),
      diagnostic: diagnostic && { ...diagnostic, result },
      result,
      sections: data.sections.filter((r) => r.code === s.code),
    };
  });
  refresh();
  render();
}

// Re-work-out every student's status after the teacher changes something.
function refresh() {
  for (const s of students) {
    s.shownCode = store.codeChanges[s.code] || s.code;
    s.verifications = [...data.verifications, ...store.verifications].filter((v) => v.code === s.code);
    s.cleared = [...data.clearances, ...store.clearances].filter((c) => c.code === s.code).map((c) => c.gap);
    s.status = studentStatus({ diagnosticResult: s.result, sections: s.sections, verifications: s.verifications, cleared: s.cleared, graph, lessons });
    const hasWork = Boolean(s.status.next) && !s.status.waiting;
    s.part = participation({ diagnostic: s.diagnostic, sections: s.sections, hasWork }, { now, expectedSections: store.expected });
  }
}

// ---------- page frame: header, class picker, tabs ----------

const app = document.getElementById('app');
let tab = 'overview';
let classFilter = 'all';
let expandedSkill = null;
let sortBy = 'name';
let onlyWaiting = false;

const TABS = [
  ['overview', 'Class overview'],
  ['groups', 'Teach together'],
  ['participation', 'Participation'],
  ['paper', 'Paper tests'],
  ['roster', 'Roster'],
];

const shown = () => students.filter((s) => classFilter === 'all' || s.classId === classFilter);

function frame(title, { tabs = true } = {}) {
  const screen = h('section', 'screen t-screen');
  const top = h('div', 't-top');
  const brand = h('div', 't-brand');
  brand.append(h('span', 't-logo', 'MathPath'), h('span', 't-role', 'Teacher'));
  const picker = h('label', 't-picker');
  picker.append(h('span', 'visually-hidden', 'Class'));
  const select = h('select', 't-select');
  select.append(new Option(`All periods (${students.length})`, 'all'));
  for (const c of data.classes) select.append(new Option(`${c.name} (${students.filter((s) => s.classId === c.id).length})`, c.id));
  select.value = classFilter;
  select.addEventListener('change', () => {
    classFilter = select.value;
    render();
  });
  picker.append(select);
  top.append(brand, picker);
  screen.append(top);
  if (tabs) {
    const nav = h('nav', 't-tabs');
    nav.setAttribute('aria-label', 'Dashboard sections');
    for (const [id, label] of TABS) {
      const b = btn(`t-tab${tab === id ? ' is-on' : ''}`, label, () => {
        tab = id;
        render();
      });
      if (tab === id) b.setAttribute('aria-current', 'page');
      nav.append(b);
    }
    screen.append(nav);
  }
  if (title) screen.append(h('h1', 'title t-title', title));
  return screen;
}

function render() {
  ({ overview, groups, participation: participationTab, paper, roster })[tab]();
}

// ---------- status cells ----------

const STATUS_LOOK = {
  verified: ['Verified', 'Teacher verified on paper'],
  platform: ['Platform', 'Platform mastery (provisional, not yet verified on paper)'],
  practised: ['Practised', 'Section check passed'],
  working: ['Working', 'On their path, started'],
  gap: ['Gap', 'Diagnostic: missed twice'],
  shaky: ['Shaky', 'Diagnostic: one miss, then right'],
  known: ['Showed', 'Diagnostic: answered right'],
  credited: ['Credited', 'Diagnostic: credited because something harder was right'],
  partly: ['Partly', 'Diagnostic: some parts right, others not asked'],
  blocked: ['Blocked', 'Diagnostic: couldn’t check, needs another gap first'],
  unchecked: ['Can’t check', 'Possible cause; the app has no questions for it yet'],
  'not-tested': ['—', 'Not tested yet'],
};

function cell(status) {
  const [label, title] = STATUS_LOOK[status];
  const c = h('span', `t-cell st-${status}`, label);
  c.title = title;
  return c;
}

function legend() {
  const box = h('div', 't-legend');
  for (const s of ['verified', 'platform', 'practised', 'working', 'gap', 'shaky', 'known', 'credited', 'unchecked', 'not-tested']) {
    const item = h('span', 't-legend-item');
    item.append(cell(s), h('span', '', STATUS_LOOK[s][1].split(' (')[0]));
    box.append(item);
  }
  return box;
}

const shortName = (id) => ({
  'frac.meaning': 'Understand fractions',
  'frac.equivalent': 'Equivalent & simplest form',
  'frac.compare': 'Compare & order',
  'frac.mixed': 'Mixed numbers',
  'frac.add-sub': 'Add & subtract',
  'frac.multiply': 'Multiply',
  'frac.divide': 'Divide',
  'frac.signed': 'Negative fractions',
}[id] || graph.get(id).name);

// ---------- Class overview ----------

function overview() {
  const screen = frame('Class overview');
  const list_ = shown();
  const waitingCount = list_.filter((s) => s.status.waiting).length;
  const toVerify = list_.filter((s) => FRACTION_SKILLS.some((k) => s.status.skills[k] === 'platform')).length;

  // Quick numbers a teacher acts on.
  const stats = h('div', 't-stats');
  stats.append(
    stat(String(list_.length), 'students'),
    stat(String(waitingCount), 'waiting for you to check a foundation', waitingCount ? () => { tab = 'groups'; render(); } : null),
    stat(String(toVerify), 'have platform mastery to verify on paper', toVerify ? () => { tab = 'paper'; render(); } : null),
    stat(String(list_.filter((s) => s.part.inactive).length), 'not active in the last 7 days'),
  );
  screen.append(stats);

  // Per-skill bars.
  const bars = h('div', 't-bars');
  bars.append(h('h2', 't-h2', 'Fraction skills across the class'));
  const BAR_KEY = [['verified', 'Verified'], ['platform', 'Platform'], ['working', 'Working on it'], ['gap', 'Gap'], ['shaky', 'Shaky'], ['known', 'Showed or credited in the diagnostic'], ['not-tested', 'Not tested']];
  const key = h('div', 't-legend');
  for (const [st, label] of BAR_KEY) {
    const item = h('span', 't-legend-item');
    item.append(h('span', `t-swatch st-${st}`), h('span', '', label));
    key.append(item);
  }
  bars.append(key);
  const untested = [];
  for (const skillId of FRACTION_SKILLS) {
    const counts = countStatuses(list_.map((s) => s.status.skills[skillId]));
    if (counts['not-tested'] === list_.length) {
      untested.push(shortName(skillId));
      continue;
    }
    const row = h('div', 't-bar-row');
    row.append(h('span', 't-bar-name', shortName(skillId)));
    const bar = h('span', 't-bar');
    const groups = [
      ['verified', counts.verified], ['platform', counts.platform], ['working', counts.working + counts.practised],
      ['gap', counts.gap], ['shaky', counts.shaky], ['known', counts.known + counts.credited + counts.partly],
      ['not-tested', counts['not-tested'] + counts.unchecked + counts.blocked],
    ];
    for (const [st, n] of groups) {
      if (!n) continue;
      const seg = h('span', `t-seg st-${st}`);
      seg.style.flexGrow = String(n);
      seg.title = `${STATUS_LOOK[st][0]}: ${n}`;
      bar.append(seg);
    }
    const parts = [
      [counts.verified, 'verified'], [counts.platform, 'platform'], [counts.working + counts.practised, 'working on it'],
      [counts.gap, 'gap'], [counts.shaky, 'shaky'], [counts.known + counts.credited + counts.partly, 'showed or credited'],
    ].filter(([n]) => n).map(([n, l]) => `${n} ${l}`);
    row.append(bar, h('span', 't-bar-note', parts.join(' · ')));
    bars.append(row);
  }
  if (untested.length) bars.append(h('p', 't-hint', `No diagnostic questions yet for: ${untested.join(', ')}.`));
  screen.append(bars);

  // Heatmap.
  const heat = h('div', 't-heat-wrap');
  const controls = h('div', 't-controls');
  controls.append(h('h2', 't-h2', 'Every student'));
  const sort = h('select', 't-select');
  for (const [v, l] of [['name', 'Sort: name'], ['help', 'Sort: needs most help'], ['active', 'Sort: least active']]) sort.append(new Option(l, v));
  sort.value = sortBy;
  sort.addEventListener('change', () => { sortBy = sort.value; render(); });
  const wait = h('label', 't-check');
  const box = h('input');
  box.type = 'checkbox';
  box.checked = onlyWaiting;
  box.addEventListener('change', () => { onlyWaiting = box.checked; render(); });
  wait.append(box, ' Only students waiting for me');
  controls.append(sort, wait);
  heat.append(controls, legend());
  heat.append(h('p', 't-hint', expandedSkill
    ? `Showing the parts of “${shortName(expandedSkill)}”. Click its heading again to close.`
    : 'Click a skill’s heading to see its parts. Click a student for their profile.'));

  let rows = onlyWaiting ? list_.filter((s) => s.status.waiting) : [...list_];
  const helpScore = (s) => Object.values(s.status.skills).filter((x) => x === 'gap' || x === 'working').length * 10
    + Object.values(s.status.subskills).filter((x) => x === 'gap').length;
  rows.sort((a, b) => (sortBy === 'help' ? helpScore(b) - helpScore(a)
    : sortBy === 'active' ? (a.part.lastActive || '').localeCompare(b.part.lastActive || '')
      : a.name.localeCompare(b.name, undefined, { numeric: true })));

  const columns = FRACTION_SKILLS.flatMap((id) => (id === expandedSkill
    ? [{ id, skill: true }, ...graph.subskillsOf(id).map((sub) => ({ id: sub, sub: true }))]
    : [{ id, skill: true }]));
  const scroller = h('div', 't-scroll');
  const table = h('table', 't-heat');
  const thead = h('thead');
  const hr = h('tr');
  hr.append(h('th', 't-sticky', 'Student'));
  for (const col of columns) {
    const th = h('th', col.sub ? 't-subhead' : '');
    if (col.skill) {
      const b = btn('t-colbtn', shortName(col.id), () => { expandedSkill = expandedSkill === col.id ? null : col.id; render(); });
      b.setAttribute('aria-expanded', String(expandedSkill === col.id));
      th.append(b);
    } else {
      th.textContent = graph.get(col.id).name;
    }
    hr.append(th);
  }
  thead.append(hr);
  const tbody = h('tbody');
  for (const s of rows) {
    const tr = h('tr');
    const th = h('th', 't-sticky');
    th.scope = 'row';
    const who = btn('t-who', '', () => showStudent(s.code));
    who.append(h('span', 't-who-name', s.name), h('span', 't-who-code', s.shownCode));
    if (s.status.waiting) who.append(h('span', 't-who-flag', 'Waiting for you'));
    th.append(who);
    tr.append(th);
    for (const col of columns) {
      const td = h('td', col.sub ? 't-subcell' : '');
      td.append(cell(col.skill ? s.status.skills[col.id] : s.status.subskills[col.id]));
      tr.append(td);
    }
    tbody.append(tr);
  }
  if (!rows.length) {
    const tr = h('tr');
    const td = h('td', 't-empty', 'Nobody here.');
    td.colSpan = columns.length + 1;
    tr.append(td);
    tbody.append(tr);
  }
  table.append(thead, tbody);
  scroller.append(table);
  heat.append(scroller);
  screen.append(heat);
  swap(app, screen);
}

function stat(number, label, onClick) {
  const box = onClick ? btn('t-stat is-link', '', onClick) : h('div', 't-stat');
  box.append(h('span', 't-stat-n', number), h('span', 't-stat-label', label));
  return box;
}

// ---------- Teach together ----------

function groups() {
  const screen = frame('Teach together');
  screen.append(h('p', 'lede', 'Students who need the same thing right now, so you can pull a small group. Groups of 2 or more.'));
  const g = teachTogether(shown(), { misconceptions, now });
  const cols = h('div', 't-two');

  const nextCol = h('div', 't-col');
  nextCol.append(h('h2', 't-h2', 'Same next step'));
  if (!g.next.length) nextCol.append(h('p', 'empty', 'No groups right now.'));
  for (const group of g.next) {
    const card = h('div', 't-card');
    card.append(h('h3', 't-card-title', group.title), h('p', 't-card-sub', `${group.students.length} students`));
    if (group.foundation) {
      card.append(h('p', 't-card-note', 'The app can’t check this yet. Their lessons wait until you mark it checked.'));
    }
    card.append(chips(group.students));
    if (group.foundation) {
      card.append(btn('button', `I’ve checked this for all ${group.students.length}`, () => {
        for (const code of group.students) clearFoundation(code, group.target);
        persist();
        refresh();
        render();
      }));
    }
    nextCol.append(card);
  }

  const mistakeCol = h('div', 't-col');
  mistakeCol.append(h('h2', 't-h2', 'Same mistake (last 2 weeks)'));
  if (!g.misconceptions.length) mistakeCol.append(h('p', 'empty', 'No shared patterns right now.'));
  for (const group of g.misconceptions) {
    const info = misconceptionInfo.get(group.target);
    const card = h('div', 't-card');
    card.append(h('h3', 't-card-title', info.description), h('p', 't-card-sub', `${group.students.length} students · points to “${graph.get(info.pointsTo).name}”`));
    const msg = addSubLesson.misconceptionMessages[group.target];
    if (msg) {
      const said = renderLessonText(`What the app tells them: “${msg}”`, { className: 't-card-note' });
      card.append(said);
    }
    card.append(chips(group.students));
    mistakeCol.append(card);
  }
  cols.append(nextCol, mistakeCol);
  screen.append(cols);
  swap(app, screen);
}

function chips(codes) {
  const wrap = h('div', 't-chips');
  for (const code of codes) {
    const s = students.find((x) => x.code === code);
    wrap.append(btn('t-chip', s.name, () => showStudent(code)));
  }
  return wrap;
}

function clearFoundation(code, gap) {
  if (store.clearances.some((c) => c.code === code && c.gap === gap)) return;
  store.clearances.push({ code, gap, by: ME, at: new Date().toISOString() });
  logChange(code, `Marked “${graph.get(gap).name}” as checked`, 'waiting', 'checked');
}

// ---------- Participation ----------

function participationTab() {
  const screen = frame('Participation');
  screen.append(h('p', 'lede', 'Effort, not scores: days active, sections finished and time in the last 7 days. Never ranked or shown to other students.'));
  const setting = h('label', 't-setting');
  const input = h('input', 't-number');
  input.type = 'number';
  input.min = '1';
  input.max = '10';
  input.value = String(store.expected);
  input.addEventListener('change', () => {
    store.expected = Math.max(1, Math.min(10, Number(input.value) || 3));
    persist();
    refresh();
    render();
  });
  setting.append('Expect at least ', input, ' finished sections a week');
  screen.append(setting);

  const scroller = h('div', 't-scroll');
  const table = h('table', 't-table');
  const head = h('tr');
  for (const t of ['Student', 'Last active', 'Days active', 'Sections', 'Minutes', '']) head.append(h('th', '', t));
  const thead = h('thead');
  thead.append(head);
  const tbody = h('tbody');
  const rows = [...shown()].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  for (const s of rows) {
    const p = s.part;
    const tr = h('tr');
    const who = h('td');
    who.append(btn('t-who', s.name, () => showStudent(s.code)));
    let flag;
    if (s.status.waiting) flag = pill('Waiting for you', 'warn');
    else if (!s.status.next) flag = pill('Path done', 'good');
    else if (p.inactive) flag = pill('Inactive 7+ days', 'bad');
    else if (p.belowExpectation) flag = pill('Below expectation', 'warn');
    else flag = pill('On track', 'good');
    const flagCell = h('td');
    flagCell.append(flag);
    tr.append(
      who,
      h('td', 'num', p.daysSinceActive === null ? 'never' : p.daysSinceActive === 0 ? 'today' : `${p.daysSinceActive} days ago`),
      h('td', 'num', String(p.daysActive)),
      h('td', 'num', String(p.sectionsFinished)),
      h('td', 'num', String(p.minutes)),
      flagCell,
    );
    tbody.append(tr);
  }
  table.append(thead, tbody);
  scroller.append(table);
  screen.append(scroller);
  swap(app, screen);
}

// ---------- Paper tests ----------

let paperVersion = 'A';
let paperWho = 'ready';
const marksDraft = {}; // code -> [1|0|null, ...]

function paper() {
  const skillId = 'frac.add-sub';
  const test = papers[skillId];
  const version = test.versions.find((v) => v.id === paperVersion);
  const screen = frame('Paper tests');
  screen.append(h('p', 'lede', `Verified mastery comes only from these paper tests, written separately from the practice problems. ${rules.verification.minScore} of ${rules.verification.outOf} suggests “verified”; you make the final call.`));

  const top = h('div', 't-two');
  // Left: the test itself.
  const left = h('div', 't-col');
  const pick = h('div', 't-controls');
  pick.append(h('h2', 't-h2', `${test.title}`));
  for (const v of test.versions) {
    pick.append(btn(`t-tab${v.id === paperVersion ? ' is-on' : ''}`, `Version ${v.id}`, () => { paperVersion = v.id; render(); }));
  }
  left.append(pick);
  const sheet = h('ol', 't-paper-preview');
  for (const item of version.items) {
    const li = h('li', 't-paper-item');
    li.append(renderLessonText(item.prompt, { className: 't-paper-q' }));
    li.append(h('p', 't-paper-a', `Answer: ${item.answer}${item.kind === 'word' ? ' · word problem' : ''}`));
    sheet.append(li);
  }
  left.append(sheet);
  const actions = h('div', 'actions');
  actions.append(
    btn('button button-primary', `Print version ${paperVersion}`, () => printPaper(test, version, false)),
    btn('button', 'Print answer key', () => printPaper(test, version, true)),
  );
  left.append(actions);
  left.append(h('p', 't-hint', `Draft items written by Claude for your review (curriculum/paper/${skillId}.json).`));

  // Right: score entry.
  const right = h('div', 't-col');
  right.append(h('h2', 't-h2', 'Enter scores'));
  const who = h('select', 't-select');
  for (const [v, l] of [['ready', 'Ready to verify (platform mastery)'], ['all', 'Everyone']]) who.append(new Option(l, v));
  who.value = paperWho;
  who.addEventListener('change', () => { paperWho = who.value; render(); });
  right.append(who);
  const pool = shown()
    .filter((s) => paperWho === 'all' || s.status.skills[skillId] === 'platform')
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  if (!pool.length) right.append(h('p', 'empty', 'Nobody is waiting for a paper test.'));
  for (const s of pool) right.append(scoreCard(s, skillId, version));
  top.append(left, right);
  screen.append(top);
  swap(app, screen);
}

function scoreCard(s, skillId, version) {
  const card = h('div', 't-card');
  const head = h('div', 't-card-head');
  head.append(btn('t-who', s.name, () => showStudent(s.code)), cell(s.status.skills[skillId]));
  card.append(head);
  const past = s.verifications.filter((v) => v.skillId === skillId);
  if (past.length) {
    card.append(h('p', 't-card-sub', past.map((v) => `Attempt ${v.attempt}: ${v.score}/${v.outOf} (version ${v.version}), ${v.decision === 'verified' ? 'verified' : 'not yet'}`).join(' · ')));
  }
  const marks = (marksDraft[s.code] ||= version.items.map(() => null));
  const row = h('div', 't-marks');
  version.items.forEach((item, i) => {
    const b = btn(`t-mark${marks[i] === 1 ? ' is-right' : marks[i] === 0 ? ' is-wrong' : ''}`, `${i + 1}${marks[i] === 1 ? ' ✓' : marks[i] === 0 ? ' ✗' : ''}`, () => {
      marks[i] = marks[i] === 1 ? 0 : marks[i] === 0 ? null : 1;
      render();
    });
    b.title = `Item ${item.id}: tap for right, again for wrong, again to clear`;
    b.setAttribute('aria-label', `Item ${i + 1}: ${marks[i] === 1 ? 'right' : marks[i] === 0 ? 'wrong' : 'not marked'}`);
    row.append(b);
  });
  card.append(row);
  const complete = marks.every((m) => m !== null);
  if (complete) {
    const { score, outOf, suggested } = scorePaperTest(marks, rules.verification);
    card.append(h('p', 't-card-sub', `${score} of ${outOf}. Suggested: ${suggested === 'verified' ? 'verified' : 'not yet'}.`));
    const actions = h('div', 'actions');
    const save = (decision) => () => {
      const rec = verificationRecord({
        code: s.code, skillId, assessmentId: skillId, version: version.id, marks, rule: rules.verification,
        decision, by: ME, at: new Date().toISOString(), previous: s.verifications,
      });
      store.verifications.push(rec);
      logChange(s.code, `Paper test ${skillId} (version ${version.id}): ${rec.score}/${rec.outOf}`, STATUS_LOOK[s.status.skills[skillId]][0], decision === 'verified' ? 'Verified' : 'Not yet');
      delete marksDraft[s.code];
      persist();
      refresh();
      render();
    };
    actions.append(
      btn(suggested === 'verified' ? 'button button-primary' : 'button', 'Verified', save('verified')),
      btn(suggested === 'not-yet' ? 'button button-primary' : 'button', 'Not yet', save('not-yet')),
    );
    card.append(actions);
  } else {
    card.append(h('p', 't-hint', 'Tap each item: once for right, twice for wrong.'));
  }
  return card;
}

// Printing: the test (or key) goes in a print-only area; the browser prints just that.
function printPaper(test, version, key) {
  const root = document.getElementById('print-root');
  root.replaceChildren();
  const page = h('div', 'p-page');
  const head = h('div', 'p-head');
  head.append(h('span', '', 'Name ______________________'), h('span', '', 'Period ____'), h('span', '', 'Date __________'));
  page.append(head);
  page.append(h('h1', 'p-title', `${test.title}${key ? ' — Answer key' : ''}`), h('p', 'p-version', `Version ${version.id}`));
  if (!key) page.append(h('p', 'p-directions', test.directions));
  const ol = h('ol', 'p-items');
  for (const item of version.items) {
    const li = h('li', key ? 'p-item p-item-key' : 'p-item');
    li.append(renderLessonText(item.prompt, { className: 'p-q' }));
    if (key) li.append(h('p', 'p-a', item.answer));
    ol.append(li);
  }
  page.append(ol);
  if (key) page.append(h('p', 'p-directions', `${rules.verification.minScore} of ${rules.verification.outOf} right suggests verified mastery. Simplest form expected; mixed numbers and improper fractions both count.`));
  root.append(page);

  // Also show it on screen: in the claude.ai preview the browser's print
  // dialog is blocked, and on screen it's a handy check before printing.
  const screen = frame(null, { tabs: false });
  screen.append(btn('back-link', '← Back to paper tests', render));
  screen.append(h('p', 't-hint', 'This is what prints. In the real app the print dialog opens too; this preview can’t open it.'));
  const sheet = page.cloneNode(true);
  sheet.classList.add('p-onscreen');
  screen.append(sheet);
  swap(app, screen);
  try {
    window.print();
  } catch {
    // printing blocked: the on-screen view is enough
  }
}

// ---------- Roster ----------

function roster() {
  const screen = frame('Roster');
  screen.append(h('p', 'lede', 'Real names live only here, in your private roster. Students sign in with their code and may pick a nickname; the app stores no names, emails or birthdates.'));

  const settings = h('div', 't-card t-pretend');
  settings.append(h('h2', 't-h2', 'Pretend class (preview only)'));
  settings.append(h('p', 't-card-sub', 'Everyone here is made up and was run through the real diagnostic and practice code. Change the number of periods to see a bigger or smaller class (20–45 students each).'));
  const row = h('div', 't-controls');
  const periods = h('select', 't-select');
  for (let n = 1; n <= 6; n++) periods.append(new Option(`${n} period${n > 1 ? 's' : ''}`, String(n)));
  periods.value = String(store.periods);
  row.append(periods, btn('button', 'Make a new pretend class', () => {
    store.periods = Number(periods.value);
    store.classSeed = `sample-${Date.now().toString(36)}`;
    Object.assign(store, { verifications: [], clearances: [], log: [], codeChanges: {} });
    classFilter = 'all';
    persist();
    buildClass();
  }));
  settings.append(row);
  screen.append(settings);

  const scroller = h('div', 't-scroll');
  const table = h('table', 't-table');
  const thead = h('thead');
  const head = h('tr');
  for (const t of ['Period', 'Name (private)', 'Code', 'Nickname', '']) head.append(h('th', '', t));
  thead.append(head);
  const tbody = h('tbody');
  const className = new Map(data.classes.map((c) => [c.id, c.name]));
  for (const s of [...shown()].sort((a, b) => a.classId.localeCompare(b.classId) || a.name.localeCompare(b.name, undefined, { numeric: true }))) {
    const tr = h('tr');
    const nameCell = h('td');
    nameCell.append(btn('t-who', s.name, () => showStudent(s.code)));
    const actions = h('td');
    // Two taps instead of a pop-up (pop-ups are blocked in the preview viewer).
    const reset = btn('t-link', 'Reset code', () => {
      if (reset.dataset.armed !== 'yes') {
        reset.dataset.armed = 'yes';
        reset.textContent = `Tap again: ${s.shownCode} stops working`;
        return;
      }
      const fresh = newCode(s.code);
      logChange(s.code, 'Code reset', s.shownCode, fresh);
      store.codeChanges[s.code] = fresh;
      persist();
      refresh();
      render();
    });
    actions.append(reset);
    tr.append(h('td', '', className.get(s.classId)), nameCell, h('td', 't-code', s.shownCode), h('td', '', s.nickname || '—'), actions);
    tbody.append(tr);
  }
  table.append(thead, tbody);
  scroller.append(table);
  screen.append(scroller);
  swap(app, screen);
}

function newCode(code) {
  const rng = createRng(`reset|${code}|${Date.now()}`);
  const a = ['acorn', 'delta', 'orbit', 'prism', 'quartz', 'tundra', 'zephyr', 'lagoon'];
  const b = ['owl', 'yak', 'newt', 'crane', 'mole', 'seal', 'wren', 'hare'];
  return `${rng.pick(a)}-${rng.pick(b)}-${rng.int(10, 99)}`;
}

// ---------- Student profile ----------

function showStudent(code) {
  const s = students.find((x) => x.code === code);
  const screen = frame(null, { tabs: false });
  screen.append(btn('back-link', '← Back', render));
  const head = h('div', 't-profile-head');
  const cls = data.classes.find((c) => c.id === s.classId);
  head.append(
    h('h1', 'title t-title', s.name),
    h('p', 't-card-sub', `${cls.name} · code ${s.shownCode}${s.nickname ? ` · nickname “${s.nickname}”` : ''}`),
  );
  screen.append(head);

  const grid = h('div', 't-two');
  const left = h('div', 't-col');
  const right = h('div', 't-col');

  // Mastery: platform and verified side by side, never merged.
  const mastery = h('div', 't-card');
  mastery.append(h('h2', 't-h2', 'Mastery'));
  const mt = h('table', 't-table t-mini');
  const mh = h('tr');
  for (const t of ['Skill', 'Platform (provisional)', 'Verified on paper']) mh.append(h('th', '', t));
  mt.append(mh);
  for (const lesson of lessons) {
    const tr = h('tr');
    const v = s.status.verification[lesson.skill];
    const p = s.status.platformAt[lesson.skill];
    tr.append(
      h('td', '', shortName(lesson.skill)),
      h('td', '', p ? `Yes, ${day(p)}` : '—'),
      h('td', '', v ? `${v.decision === 'verified' ? 'Yes' : 'Not yet'}: ${v.score}/${v.outOf}, ${day(v.at)}` : '—'),
    );
    mt.append(tr);
  }
  mastery.append(mt);
  left.append(mastery);

  // Path.
  const pathCard = h('div', 't-card');
  pathCard.append(h('h2', 't-h2', 'Path'));
  if (!s.status.path.length) pathCard.append(h('p', 'empty', s.diagnosed ? 'Nothing on their path right now.' : 'Hasn’t taken the diagnostic yet.'));
  const ol = h('ol', 't-path');
  for (const item of s.status.path) {
    const li = h('li', 't-path-item');
    if (item.kind === 'section') {
      li.append(h('span', '', item.title));
      const look = { done: ['Done', 'good'], tried: ['Started', 'warn'], 'not-started': [item.waiting ? 'Waiting' : 'Not started', 'muted'] }[item.progress];
      li.append(pill(...look));
    } else {
      li.append(h('span', '', `${item.kind === 'unchecked' ? 'Check first' : 'Gap, no lesson yet'}: ${item.name}`));
      if (item.cleared) li.append(pill('Checked', 'good'));
      else {
        li.append(btn('t-link', 'Mark checked', () => {
          clearFoundation(s.code, item.gap);
          persist();
          refresh();
          showStudent(code);
        }));
      }
    }
    ol.append(li);
  }
  pathCard.append(ol);
  left.append(pathCard);

  // Participation.
  const p = s.part;
  const partCard = h('div', 't-card');
  partCard.append(h('h2', 't-h2', 'Last 7 days'));
  partCard.append(h('p', '', `${p.daysActive} days active · ${p.sectionsFinished} sections finished · ${p.minutes} minutes · last active ${p.lastActive ? day(p.lastActive) : 'never'}`));
  left.append(partCard);

  // Change log.
  const mine = store.log.filter((l) => l.code === s.code);
  const logCard = h('div', 't-card');
  logCard.append(h('h2', 't-h2', 'Changes'));
  logCard.append(list(mine.map((l) => `${day(l.at)}: ${l.what} (${l.before} → ${l.after}), by ${l.by}`), 'No changes yet.'));
  left.append(logCard);

  // Practice history, newest first; every problem re-created from its seed.
  const hist = h('div', 't-card');
  hist.append(h('h2', 't-h2', 'Practice'));
  const records = [...s.sections].sort((a, b) => b.finishedAt.localeCompare(a.finishedAt));
  if (!records.length) hist.append(h('p', 'empty', 'No practice yet.'));
  for (const r of records) hist.append(sectionHistory(r));
  right.append(hist);

  // Diagnostic.
  const diag = h('div', 't-card');
  diag.append(h('h2', 't-h2', `Diagnostic${s.diagnostic ? `, ${day(s.diagnostic.finishedAt)}` : ''}`));
  if (s.result) diag.append(diagnosticReport(s.result, { graph, misconceptions, times: s.diagnostic.times }));
  else diag.append(h('p', 'empty', 'Not taken yet.'));
  right.append(diag);

  grid.append(left, right);
  screen.append(grid);
  swap(app, screen);
}

const ENDED = { passed: 'Passed the check', mastered: 'Platform mastery', limit: 'Stopped (too many problems)' };
const OUTCOME = { 'right-first': 'Right', 'right-second': 'Right on 2nd try', missed: 'Missed' };

function sectionHistory(r) {
  const d = h('details', 't-history');
  const firstTry = r.problems.filter((p) => p.outcome === 'right-first').length;
  const mins = Math.round(r.times.reduce((n, x) => n + x, 0) / 60000);
  const sum = h('summary', 't-history-sum');
  sum.append(
    h('span', 't-history-title', `${sectionTitle.get(r.section)}${r.attemptNo > 1 ? ` (try ${r.attemptNo})` : ''}`),
    h('span', 't-card-sub', `${day(r.finishedAt)} · ${ENDED[r.endedBy] || r.endedBy} · ${firstTry}/${r.problems.length} right first try · ${mins} min`),
  );
  d.append(sum);
  const log = h('div', 'log');
  const head = h('div', 'log-row log-head');
  ['#', 'Problem', 'Answers', 'Result', 'Level'].forEach((t) => head.append(h('span', '', t)));
  log.append(head);
  r.problems.forEach((p, i) => {
    const problem = toText(generateProblem(p.generator, p.seed, p.difficulty).expression);
    const row = h('div', 'log-row');
    const mis = p.attempts.map((a) => a.misconception).filter(Boolean).map((m) => m.replace('frac.', ''));
    row.append(
      h('span', 'num', String(i + 1)),
      h('span', 'log-problem', problem),
      h('span', 'num', p.attempts.map((a) => rawToText(a.answer)).join(', ')),
      h('span', '', `${OUTCOME[p.outcome] || '—'}${mis.length ? ` (${mis.join(', ')})` : ''}`),
      h('span', 'num', String(p.difficulty)),
    );
    log.append(row);
  });
  const scroller = h('div', 'log-scroll');
  scroller.append(log);
  d.append(scroller);
  return d;
}

function day(iso) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

buildClass();

// The teacher dashboard.
//
// On Google Apps Script ("live"): the teacher's own classes come from the server
// (which checks their Google account), and every change (paper-test scores,
// checks, code resets, new students) is sent to the server and logged there.
//
// In the claude.ai preview: a pretend class (tools/synthetic-class.js: made-up
// students run through the real diagnostic and practice engine), and the
// teacher's changes are kept in this browser.
//
// All the thinking is in engine/teacher/ (tested); this file draws.

import { domainsIndex, graphFiles, misconceptionList, lessons as allLessons, diagnosticConfig as fracDiagnostic, masteryRules } from '../../curriculum/all.js';
import { paperList } from '../../curriculum/papers.js';
import { buildGraphIndex } from '../../engine/graph/graph-index.js';
import { generators, generateProblem } from '../../engine/generators/index.js';
import { replayDiagnostic, resultFromVerdicts } from '../../engine/diagnostic/diagnostic.js';
import { replayPractice } from '../../engine/practice/practice.js';
import { practicePlan } from '../../engine/lessons/plan.js';
import { toText } from '../../engine/problem/text.js';
import { createRng } from '../../engine/random.js';
import { studentStatus, countStatuses } from '../../engine/teacher/student-status.js';
import { LOG_STATES } from '../../engine/teacher/assignments.js';
import { teachTogether } from '../../engine/teacher/groups.js';
import { participation } from '../../engine/teacher/participation.js';
import { scorePaperTest, verificationRecord } from '../../engine/teacher/verification.js';
import { syntheticClass } from '../../tools/synthetic-class.js';
import { diagnosticReport } from '../components/diagnostic-report.js';
import { renderLessonText } from '../components/lesson-text.js';
import { drawShape } from '../components/shapes.js';
import { rawToText } from '../components/answer-editor.js';
import { loadLocal, saveLocal } from '../storage/local.js';
import { createApi } from '../api/client.js';
import { h, btn, pill, list, swap } from '../components/dom.js';
import { openSection } from '../student/lesson.js';

// ---------- curriculum and engine ----------

const graph = buildGraphIndex(domainsIndex, graphFiles);
const misconceptions = misconceptionList;
const lessons = allLessons;
const papers = Object.fromEntries(paperList.map((p) => [p.skill, p]));
const rules = masteryRules.default;
const setup = { graph, generators, misconceptions, diagnosticConfig: fracDiagnostic, lessons, rules };
const wholeSectionIds = new Set(lessons.flatMap((l) => l.sections.filter((x) => x.mode === 'skill').map((x) => x.id)));
const sectionTitle = new Map(lessons.flatMap((l) => l.sections.map((s) => [s.id, s.title])));
const misconceptionInfo = new Map(misconceptions.map((m) => [m.id, m]));
// Heatmap columns: whole-number skills first (they come first on paths), then fractions.
// Skills by area, in the order of curriculum/graph/domains.json.
const AREAS = domainsIndex.domains.map((d) => ({ id: d.id, name: d.name, skills: graphFiles[d.file].skills.map((sk) => sk.id) }));
const ALL_SKILLS = AREAS.flatMap((a) => a.skills);
const ME = 'you (preview)';
const api = createApi({ setup });
const live = !api.preview;
let serverData = null; // live: what the server sent
if (live) document.querySelector('.preview-banner')?.remove();

// ---------- the teacher's saved changes (preview: this browser only) ----------

// Preview: apply this device's removals and shares to the pretend class, the way the server would.
function withPreviewChanges(d) {
  const gone = new Set(store.removedStudents);
  const goneClasses = new Set(store.removedClasses);
  const classes = d.classes.map((c) => ({ ...c, teacherEmail: c.teacherEmail || ME, coTeachers: store.shares[c.id] || [] }));
  const nameOf = new Map(d.roster.map((r) => [r.code, r.realName]));
  return {
    ...d,
    classes: classes.filter((c) => !goneClasses.has(c.id)),
    students: d.students.filter((st) => !gone.has(st.code) && !goneClasses.has(st.classId)),
    removed: {
      classes: classes.filter((c) => goneClasses.has(c.id)).map(({ id, name }) => ({ id, name })),
      students: d.students.filter((st) => gone.has(st.code) && !goneClasses.has(st.classId))
        .map((st) => ({ id: st.code, code: st.code, classId: st.classId, realName: nameOf.get(st.code) || '' })),
    },
  };
}

// Remove / bring back / share: on the server when live, on this device in the preview.
function classAction(call, ...args) {
  if (live) {
    api.teacher(call, ...args).then((res) => (res.error ? problem(res) : reload(() => { tab = 'roster'; render(); })));
    return;
  }
  const [id, other] = args;
  const without = (list, x) => list.filter((y) => y !== x);
  if (call === 'removeStudent') { store.removedStudents = [...without(store.removedStudents, id), id]; logChange(id, 'Removed from the class (code stops working; work kept)', 'active', 'removed'); }
  if (call === 'restoreStudent') { store.removedStudents = without(store.removedStudents, id); logChange(id, 'Brought back to the class', 'removed', 'active'); }
  if (call === 'removeClass') store.removedClasses = [...without(store.removedClasses, id), id];
  if (call === 'restoreClass') store.removedClasses = without(store.removedClasses, id);
  if (call === 'shareClass') store.shares[id] = [...without(store.shares[id] || [], other), other];
  if (call === 'unshareClass') store.shares[id] = without(store.shares[id] || [], other);
  persist();
  buildClass(() => { tab = 'roster'; render(); });
}

// A button that needs a second tap to confirm (pop-ups are blocked in the preview viewer).
function confirmBtn(className, label, armedLabel, onConfirm) {
  const b = btn(className, label, () => {
    if (b.dataset.armed !== 'yes') {
      b.dataset.armed = 'yes';
      b.textContent = armedLabel;
      return;
    }
    onConfirm();
  });
  return b;
}

const STORE_KEY = 'mathpath.teacher-preview.v1';
const store = Object.assign(
  {
    periods: 3, classSeed: 'sample-1', expected: 3, verifications: [], clearances: [], resets: [], log: [], codeChanges: {},
    removedStudents: [], removedClasses: [], shares: {}, // preview: removing and sharing, on this device only
    assignments: [], // preview: assigning and skipping lessons, on this device only
  },
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

function buildClass(then = render) {
  data = live ? serverData : withPreviewChanges(syntheticClass({ periods: periodSizes(store.periods, store.classSeed), seed: store.classSeed, now, setup }));
  const nameOf = new Map(data.roster.map((r) => [r.code, r.realName]));
  students = data.students.map((s) => {
    const diagnostic = data.diagnostics.find((d) => d.code === s.code) || null;
    // The result as the server saved it (older saves: rebuilt from their verdicts). Never
    // re-run from the answers: a newer diagnostic could ask different questions.
    const result = !diagnostic ? null
      : diagnostic.result || (diagnostic.verdicts ? resultFromVerdicts(diagnostic)
        : replayDiagnostic({ graph, generators, misconceptions, config: fracDiagnostic, seed: diagnostic.seed }, diagnostic.answers, diagnostic.times || []).result());
    return {
      ...s,
      id: s.id || s.code,
      name: nameOf.get(s.code) || s.nickname || s.code,
      diagnostic: diagnostic && { ...diagnostic, result },
      result,
      sections: data.sections.filter((r) => r.code === s.code),
      practice: (data.practice || []).filter((r) => r.code === s.code),
      memory: (data.memory || []).filter((r) => r.code === s.code),
    };
  });
  refresh();
  then();
}

// Re-work-out every student's status after the teacher changes something.
function refresh() {
  for (const s of students) {
    s.shownCode = live ? s.code : store.codeChanges[s.code] || s.code;
    s.verifications = [...data.verifications, ...(live ? [] : store.verifications)].filter((v) => v.code === s.code);
    s.cleared = [...data.clearances, ...(live ? [] : store.clearances)].filter((c) => c.code === s.code).map((c) => c.gap);
    s.resets = [...(data.resets || []), ...(live ? [] : store.resets || [])].filter((r) => r.code === s.code);
    s.assignments = [...(data.assignments || []), ...(live ? [] : store.assignments || [])].filter((r) => r.code === s.code);
    s.status = studentStatus({
      diagnosticResult: s.result, sections: s.sections, verifications: s.verifications, cleared: s.cleared, resets: s.resets,
      memory: s.memory, retention: rules.retention, now, assignments: s.assignments, graph, lessons, waitForTeacher: rules.paths?.waitForTeacherChecks,
    });
    const hasWork = Boolean(s.status.next) && !s.status.waiting;
    s.part = participation({ diagnostic: s.diagnostic, sections: s.sections, practice: s.practice, memory: s.memory, hasWork }, { now, expectedSections: store.expected });
  }
}

// ---------- page frame: header, class picker, tabs ----------

const app = document.getElementById('app');
let tab = 'overview';
let classFilter = 'all';
let expandedSkill = null;
let heatArea = 'frac'; // the every-student table opens on fractions (owner decision); other areas are a tap away
let sortBy = 'name';

const TABS = [
  ['overview', 'Class overview'],
  ['groups', 'Teach together'],
  ['participation', 'Participation'],
  ['paper', 'Paper tests'],
  ['lessons', 'Lessons'],
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
  ({ overview, groups, participation: participationTab, paper, lessons: lessonsTab, roster })[tab]();
}

// ---------- status cells ----------

const STATUS_LOOK = {
  verified: ['Verified', 'Teacher verified on paper'],
  platform: ['Platform', 'Platform mastery (provisional, not yet verified on paper)'],
  slipping: ['Slipping', 'Platform mastery, then missed a memory check (a refresher is on their path)'],
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
  for (const s of ['verified', 'platform', 'slipping', 'practised', 'working', 'gap', 'shaky', 'known', 'credited', 'unchecked', 'not-tested']) {
    const item = h('span', 't-legend-item');
    item.append(cell(s), h('span', '', STATUS_LOOK[s][1].split(' (')[0]));
    box.append(item);
  }
  return box;
}

const shortName = (id) => ({
  'whole.add-sub': 'Add & subtract',
  'whole.mult-div': 'Facts & remainders',
  'whole.factors-multiples': 'Factors & multiples',
  'int.add-sub': 'Integers: add & subtract',
  'int.mult-div': 'Integers: multiply & divide',
  'frac.meaning': 'Understand fractions',
  'frac.equivalent': 'Equivalent & simplest form',
  'frac.compare': 'Compare & order',
  'frac.add-sub': 'Fractions: add & subtract',
  'alg.order-ops': 'Order of operations',
  'alg.exponents': 'Exponents',
  'alg.equations': 'Equations',
  'alg.expressions': 'Simplify expressions',
  'alg.evaluate': 'Evaluate expressions',
  'alg.multi-step': 'Multi-step equations',
  'alg.inequalities': 'Inequalities',
  'alg.inequality-graphs': 'Graph inequalities',
  'alg.translate': 'Words to equations',
  'frac.multiply': 'Multiply',
  'frac.divide': 'Divide',
  'frac.signed': 'Negative fractions',
  'dec.place-value': 'Understand decimals',
  'dec.convert': 'Fractions ↔ decimals',
  'dec.add-sub': 'Decimals: add & subtract',
  'dec.multiply': 'Decimals: multiply',
  'dec.divide': 'Decimals: divide',
  'dec.signed': 'Negative decimals',
  'rat.ratios': 'Ratios & rates',
  'rat.percent': 'Percents',
  'rat.percent-change': 'Percent change',
  'lin.functions': 'Functions & tables',
  'lin.slope': 'Slope',
  'lin.slope-intercept': 'y = mx + b',
  'lin.forms': 'Point-slope & standard',
  'lin.parallel': 'Parallel & perpendicular',
  'lin.graphing': 'Graph points & lines',
  'geo.units': 'Convert units',
  'geo.area': 'Area & perimeter',
  'geo.circles': 'Circles',
  'geo.volume': 'Volume',
  'geo.angles': 'Angles',
  'geo.pythag': 'Pythagorean theorem',
  'stat.center': 'Mean, median, mode',
  'whole.place-value': 'Place value, rounding',
  'int.compare': 'Compare, absolute value',
  'stat.displays': 'Data displays',
  'stat.prob': 'Probability',
  'exp.rules': 'Exponent rules',
  'exp.roots': 'Roots',
  'exp.scinot': 'Scientific notation',
  'poly.multiply': 'Multiply binomials',
  'poly.factor': 'Factoring',
}[id] || graph.get(id).name);

// ---------- Class overview ----------

function overview() {
  const screen = frame('Class overview');
  const list_ = shown();
  const toVerify = list_.filter((s) => ALL_SKILLS.some((k) => s.status.skills[k] === 'platform')).length;

  // Quick numbers a teacher acts on.
  const stats = h('div', 't-stats');
  stats.append(
    stat(String(list_.length), 'students'),
    stat(String(toVerify), 'have platform mastery to verify on paper', toVerify ? () => { tab = 'paper'; render(); } : null),
    stat(String(list_.filter((s) => s.part.inactive).length), 'not active in the last 7 days'),
  );
  screen.append(stats);
  const memory = memoryOverview(list_);
  if (memory) screen.append(memory);

  // Per-skill bars.
  const bars = h('div', 't-bars');
  bars.append(h('h2', 't-h2', 'Skills across the class'));
  const BAR_KEY = [['verified', 'Verified'], ['platform', 'Platform'], ['slipping', 'Slipping (memory check)'], ['working', 'Working on it'], ['gap', 'Gap'], ['shaky', 'Shaky'], ['known', 'Showed or credited in the diagnostic'], ['not-tested', 'Not tested']];
  const key = h('div', 't-legend');
  for (const [st, label] of BAR_KEY) {
    const item = h('span', 't-legend-item');
    item.append(h('span', `t-swatch st-${st}`), h('span', '', label));
    key.append(item);
  }
  bars.append(key);
  const untested = [];
  for (const area of AREAS) {
  const tested = area.skills.filter((skillId) => countStatuses(list_.map((s) => s.status.skills[skillId]))['not-tested'] !== list_.length);
  if (tested.length) bars.append(h('h3', 't-area-head', area.name));
  for (const skillId of area.skills) {
    const counts = countStatuses(list_.map((s) => s.status.skills[skillId]));
    if (counts['not-tested'] === list_.length) {
      untested.push(shortName(skillId));
      continue;
    }
    const row = h('div', 't-bar-row');
    row.append(h('span', 't-bar-name', shortName(skillId)));
    const bar = h('span', 't-bar');
    const groups = [
      ['verified', counts.verified], ['platform', counts.platform], ['slipping', counts.slipping], ['working', counts.working + counts.practised],
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
      [counts.verified, 'verified'], [counts.platform, 'platform'], [counts.slipping, 'slipping'], [counts.working + counts.practised, 'working on it'],
      [counts.gap, 'gap'], [counts.shaky, 'shaky'], [counts.known + counts.credited + counts.partly, 'showed or credited'],
    ].filter(([n]) => n).map(([n, l]) => `${n} ${l}`);
    row.append(bar, h('span', 't-bar-note', parts.join(' · ')));
    bars.append(row);
  }
  }
  if (untested.length) bars.append(h('p', 't-hint', `Nobody here has been checked on these yet: ${untested.join(', ')}.`));
  screen.append(bars);

  // Heatmap.
  const heat = h('div', 't-heat-wrap');
  const controls = h('div', 't-controls');
  controls.append(h('h2', 't-h2', 'Every student'));
  const sort = h('select', 't-select');
  for (const [v, l] of [['name', 'Sort: name'], ['help', 'Sort: needs most help'], ['active', 'Sort: least active']]) sort.append(new Option(l, v));
  sort.value = sortBy;
  sort.addEventListener('change', () => { sortBy = sort.value; render(); });
  controls.append(sort);
  // Which area's skills the table shows.
  const areaPick = h('div', 't-controls t-area-pick');
  areaPick.setAttribute('role', 'group');
  areaPick.setAttribute('aria-label', 'Area');
  for (const area of [...AREAS, { id: 'all', name: 'All areas' }]) {
    const b = btn(`t-tab${heatArea === area.id ? ' is-on' : ''}`, area.name, () => { heatArea = area.id; expandedSkill = null; render(); });
    b.setAttribute('aria-pressed', String(heatArea === area.id));
    areaPick.append(b);
  }
  heat.append(controls, areaPick, legend());
  heat.append(h('p', 't-hint', expandedSkill
    ? `Showing the parts of “${shortName(expandedSkill)}”. Click its heading again to close.`
    : 'Click a skill’s heading to see its parts. Click a student for their profile.'));

  let rows = [...list_];
  const helpScore = (s) => Object.values(s.status.skills).filter((x) => x === 'gap' || x === 'working').length * 10
    + Object.values(s.status.subskills).filter((x) => x === 'gap').length;
  rows.sort((a, b) => (sortBy === 'help' ? helpScore(b) - helpScore(a)
    : sortBy === 'active' ? (a.part.lastActive || '').localeCompare(b.part.lastActive || '')
      : a.name.localeCompare(b.name, undefined, { numeric: true })));

  const areaSkills = heatArea === 'all' ? ALL_SKILLS : AREAS.find((a) => a.id === heatArea).skills;
  const columns = areaSkills.flatMap((id) => (id === expandedSkill
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
    if (s.status.openChecks.length) who.append(h('span', 't-who-flag', 'Check for you'));
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

// Memory checks: which mastered skills slipped (refresher on the student's path),
// and how the checks are going. Verified skills that slipped are listed too: the
// app never takes verified mastery away; the teacher decides.
function memoryOverview(list_) {
  const slipped = [];
  let due = 0;
  for (const s of list_) {
    for (const [skill, m] of Object.entries(s.status.memory || {})) {
      if (m.status === 'slipping') slipped.push({ s, skill, at: m.lastAt });
      if (m.status === 'due') due++;
    }
  }
  const taken = list_.flatMap((s) => s.memory || []);
  if (!slipped.length && !due && !taken.length) return null;
  const card = h('div', 't-card t-memory');
  card.append(h('h2', 't-h2', 'Memory checks'));
  const held = taken.filter((r) => r.held).length;
  const [first, second] = rules.retention.afterDays;
  card.append(h('p', 't-hint', `${first / 7} and ${(first + second) / 7} weeks after platform mastery, students get ${rules.retention.difficulties.length} problems on the skill, one try each. `
    + `So far: ${held} held up, ${taken.length - held} slipped${due ? ` · ${due} due now` : ''}.`));
  if (slipped.length) {
    card.append(h('h3', 't-area-head', 'Slipping: a refresher is on their path'));
    const ul = h('ul', 't-queue');
    slipped.sort((a, b) => String(a.at).localeCompare(String(b.at)));
    for (const { s, skill, at } of slipped) {
      const li = h('li', 't-queue-row');
      li.append(btn('t-chip', s.name, () => showStudent(s.code)));
      const verified = s.status.skills[skill] === 'verified';
      li.append(h('span', 't-card-sub', `${shortName(skill)} · missed ${day(at)}${verified ? ' · verified on paper earlier (your call)' : ''}`));
      ul.append(li);
    }
    card.append(ul);
  }
  return card;
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
      card.append(h('p', 't-card-note', 'The app can’t check this yet. Students keep going in the meantime; mark it checked once you have.'));
    }
    card.append(chips(group.students));
    if (group.foundation) {
      card.append(btn('button', `I’ve checked this for all ${group.students.length}`, () => clearFoundations(group.students, group.target, render)));
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
    const msg = lessons.map((l) => l.misconceptionMessages[group.target]).find(Boolean);
    if (msg) {
      const said = renderLessonText(`What the app tells them: “${msg}”`, { className: 't-card-note' });
      card.append(said);
    }
    card.append(chips(group.students));
    // The step that teaches it: one tap puts it at the top of all their paths.
    const lesson = lessons.find((l) => l.sections.some((x) => x.forGap === info.pointsTo));
    const step = lesson?.sections.find((x) => x.forGap === info.pointsTo);
    if (step) {
      const already = group.students.every((c) => students.find((x) => x.code === c).status.assigned.some((a) => a.lesson === lesson.skill && (!a.section || a.section === step.id)));
      card.append(already
        ? h('p', 't-card-note', `“${step.title}” is on all their paths (from you).`)
        : btn('button', `Put “${step.title}” at the top of their paths`, () => changePath(group.students, 'assign', lesson.skill, step.id, render)));
    }
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

// The teacher checked a foundation for these students; their lessons open.
async function clearFoundations(codes, gap, then) {
  if (live) {
    for (const code of codes) {
      const res = await api.teacher('clearFoundation', idOf(code), gap);
      if (res.error) return problem(res);
    }
    return reload(then);
  }
  for (const code of codes) {
    if (store.clearances.some((c) => c.code === code && c.gap === gap)) continue;
    store.clearances.push({ code, gap, by: ME, at: new Date().toISOString() });
    logChange(code, `Marked “${graph.get(gap).name}” as checked`, 'waiting', 'checked');
  }
  persist();
  refresh();
  then();
}

const idOf = (code) => students.find((s) => s.code === code).id;

// Assign or skip a lesson (or one step) for some students: on the server when live,
// on this device in the preview (engine/teacher/assignments.js).
async function changePath(codes, action, lesson, section, then) {
  if (live) {
    const res = await api.teacher('changePath', { studentIds: codes.map(idOf), action, lesson, section });
    if (res.error) return problem(res);
    return reload(then);
  }
  const l = lessons.find((x) => x.skill === lesson);
  const what = section ? `“${l.sections.find((x) => x.id === section).title}” (${l.title})` : `“${l.title}”`;
  const words = { assign: 'Assigned', unassign: 'Took back the assignment of', skip: 'Took off the path:', unskip: 'Put back on the path:' }[action];
  const at = new Date().toISOString();
  for (const code of codes) {
    store.assignments.push({ code, action, lesson, section: section || '', by: ME, at });
    logChange(code, `${words} ${what}`, ...LOG_STATES[action]);
  }
  persist();
  refresh();
  then();
}

// "Add to their path": any lesson, or one step of it.
function assignPicker(onPick, label = 'Add to their path') {
  const wrap = h('div', 't-assign');
  const select = h('select', 't-select');
  select.append(new Option('Choose a lesson or step…', ''));
  for (const area of AREAS) {
    for (const l of lessons.filter((x) => area.skills.includes(x.skill))) {
      const g = document.createElement('optgroup');
      g.label = `${area.name}: ${l.title}`;
      g.append(new Option(`The whole lesson: ${l.title}`, `${l.skill}|`));
      for (const sec of l.sections) g.append(new Option(sec.mode === 'skill' ? `Putting it together (${l.title})` : sec.title, `${l.skill}|${sec.id}`));
      select.append(g);
    }
  }
  const go = btn('button', label, () => {
    if (!select.value) return;
    const [lesson, section] = select.value.split('|');
    onPick(lesson, section || null);
  });
  wrap.append(select, go);
  return wrap;
}

// Live: ask the server for everything again, then redraw with `then`.
async function reload(then = render) {
  const res = await api.teacher('teacherData');
  if (res.error) return problem(res);
  serverData = res;
  buildClass(then);
}

// Something went wrong on the server: say so plainly, keep the page usable.
function problem(res) {
  const msg = res.error === 'network'
    ? 'Couldn’t reach MathPath. Check the connection and try again. Nothing was changed.'
    : res.message || res.error;
  const bar = h('p', 't-problem', msg);
  bar.setAttribute('role', 'alert');
  app.querySelector('.t-problem')?.remove();
  app.firstElementChild?.prepend(bar);
}

// "Send back to redo": clears platform mastery of the skill; the student does
// "Putting it together" again. Two taps (pop-ups are blocked in the preview).
function sendBackButton(s, skillId, then) {
  const b = btn('t-link', 'Send back to redo', async () => {
    if (b.dataset.armed !== 'yes') {
      b.dataset.armed = 'yes';
      b.textContent = 'Tap again: they redo “Putting it together”';
      return;
    }
    if (live) {
      const res = await api.teacher('resetSkill', s.id, skillId);
      if (res.error) return problem(res);
      return reload(then);
    }
    store.resets.push({ code: s.code, skillId, by: ME, at: new Date().toISOString() });
    logChange(s.code, `Sent back to redo “${lessons.find((l) => l.skill === skillId).title}”`, 'platform mastery', 'redo');
    persist();
    refresh();
    then();
  });
  return b;
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
  for (const t of ['Student', 'Last active', 'Days active', 'Sections', 'Practice sets', 'Memory checks', 'Minutes', '']) head.append(h('th', '', t));
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
    else if (s.status.openChecks.length && !s.status.next) flag = pill('Check for you', 'warn');
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
      h('td', 'num', String(p.practiceSets)),
      h('td', 'num', String(p.memoryChecks)),
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


// ---------- Lessons: see what students see ----------

function lessonsTab() {
  const screen = frame('Lessons');
  screen.append(h('p', 'lede', 'Every lesson a student can get, by area. Open one to see it exactly as a student does: the explanation, the picture, a worked example, and practice with the same hints and feedback. Nothing you do here is saved or counted.'));
  // How many of the shown students have each step on their path, not finished yet.
  const onPath = new Map();
  for (const st of shown()) {
    for (const item of st.status.path) {
      if (item.kind === 'section' && item.progress !== 'done') onPath.set(item.section, (onPath.get(item.section) || 0) + 1);
    }
  }
  for (const d of domainsIndex.domains) {
    const inArea = lessons.filter((l) => l.skill.startsWith(`${d.id}.`));
    if (!inArea.length) continue;
    screen.append(h('h2', 't-h2 t-area', d.name));
    for (const lesson of inArea) {
      const card = h('div', 't-card');
      card.append(h('h3', 't-h3', lesson.title));
      // Give the whole lesson to everyone shown (the class picked at the top), with a second tap to confirm.
      const who = shown();
      if (who.length) {
        const cls = data.classes.find((c) => c.id === classFilter);
        const all = who.every((st) => st.status.assigned.some((a) => a.lesson === lesson.skill && !a.section));
        card.append(all
          ? h('p', 't-hint', `On ${cls ? `everyone in ${cls.name}` : 'all your students'}’s path (from you).`)
          : confirmBtn('t-link', `Put this lesson at the top of ${cls ? `${cls.name}’s` : 'every student’s'} path (${who.length})`, `Tap again to give it to ${who.length} student${who.length > 1 ? 's' : ''}`,
            () => changePath(who.map((st) => st.code), 'assign', lesson.skill, null, render)));
      }
      for (const sec of lesson.sections) {
        const row = h('div', 't-lesson-row');
        const text = h('div', 't-lesson-text');
        text.append(h('strong', '', sec.title), h('span', 't-hint', sec.objective));
        const n = onPath.get(sec.id) || 0;
        const right = h('div', 't-lesson-actions');
        if (n) right.append(pill(`${n} student${n > 1 ? 's' : ''} on it`, 'info'));
        right.append(btn('button', 'Open', () => tryLesson(lesson, sec.id)));
        row.append(text, right);
        card.append(row);
      }
      const practiceRow = h('div', 't-lesson-row');
      const pt = h('div', 't-lesson-text');
      pt.append(h('strong', '', 'Practice for a check'), h('span', 't-hint', '6 problems like the paper test, with hints. Students can do this any time.'));
      const pa = h('div', 't-lesson-actions');
      pa.append(btn('button', 'Open', () => tryLesson(lesson, `practice:${lesson.skill}`)));
      practiceRow.append(pt, pa);
      card.append(practiceRow);
      screen.append(card);
    }
  }
  swap(app, screen);
}

// The student's lesson screens, as a try-out: new problems each time, nothing saved.
function tryLesson(lesson, sectionId) {
  window.scrollTo(0, 0);
  openSection({
    app, lesson, sectionId, rules, curriculumVersion: graph.curriculumVersion, studentId: 'teacher-try', nextAttempt: () => 1,
    onExit: () => { tab = 'lessons'; render(); },
    openFull: () => tryLesson(lesson, sectionId.replace(/^practice:.*/, sectionId)),
    tryOut: true,
    backLabel: 'Lessons',
  });
}

// ---------- Paper tests ----------

let paperVersion = 'A';
let paperSkill = null; // null: open on the skill with the most students waiting
let paperWho = 'ready';
const marksDraft = {}; // code -> [1|0|null, ...]

// Everyone with platform mastery who hasn't been checked on paper yet, by skill.
function waitingForPaper() {
  const bySkill = new Map();
  for (const st of shown()) {
    for (const [skill, v] of Object.entries(st.status.skills)) {
      if (v !== 'platform' || !papers[skill]) continue;
      if (!bySkill.has(skill)) bySkill.set(skill, []);
      bySkill.get(skill).push({ student: st, since: st.status.platformAt?.[skill] || null });
    }
  }
  for (const list of bySkill.values()) list.sort((a, b) => String(a.since).localeCompare(String(b.since)));
  return [...bySkill.entries()].sort((a, b) => b[1].length - a[1].length);
}

function paper() {
  const waiting = waitingForPaper();
  if (!paperSkill) paperSkill = waiting[0]?.[0] || 'frac.add-sub';
  const skillId = paperSkill;
  const test = papers[skillId];
  const version = test.versions.find((v) => v.id === paperVersion);
  const screen = frame('Paper tests');
  screen.append(h('p', 'lede', `Verified mastery comes only from these paper tests, written separately from the practice problems. ${rules.verification.minScore} of ${rules.verification.outOf} suggests “verified”; you make the final call.`));

  // Who's waiting, across every skill, so nobody has to click through skills to find them.
  const queue = h('div', 't-card t-queue');
  const total = waiting.reduce((n, [, list]) => n + list.length, 0);
  queue.append(h('h2', 't-h2', total ? `Waiting for a paper test (${total})` : 'Nobody is waiting for a paper test'));
  if (total) queue.append(h('p', 't-card-sub', 'They showed platform mastery. Tap a name to open that skill’s test and their score card. Longest waiting first.'));
  for (const [skill, list] of waiting) {
    const row = h('div', 't-queue-row');
    row.append(h('strong', 't-queue-skill', `${papers[skill].title} (${list.length})`));
    const names = h('div', 't-queue-names');
    for (const { student: st, since } of list) {
      const b = btn('t-chip', since ? `${st.name} · ${day(since)}` : st.name, () => {
        paperSkill = skill;
        paperWho = 'ready';
        for (const k of Object.keys(marksDraft)) delete marksDraft[k];
        render();
        document.getElementById(`score-${st.code}`)?.scrollIntoView({ block: 'center' });
      });
      names.append(b);
    }
    row.append(names);
    queue.append(row);
  }
  screen.append(queue);

  const top = h('div', 't-two');
  // Left: the test itself.
  const left = h('div', 't-col');
  const pick = h('div', 't-controls');
  const skillPick = h('select', 't-select');
  skillPick.setAttribute('aria-label', 'Which skill');
  for (const p of Object.values(papers)) skillPick.append(new Option(p.title, p.skill));
  skillPick.value = skillId;
  skillPick.addEventListener('change', () => {
    paperSkill = skillPick.value;
    for (const k of Object.keys(marksDraft)) delete marksDraft[k];
    render();
  });
  pick.append(skillPick);
  for (const v of test.versions) {
    pick.append(btn(`t-tab${v.id === paperVersion ? ' is-on' : ''}`, `Version ${v.id}`, () => { paperVersion = v.id; render(); }));
  }
  left.append(pick);
  const sheet = h('ol', 't-paper-preview');
  for (const item of version.items) {
    const li = h('li', 't-paper-item');
    li.append(renderLessonText(item.prompt, { className: 't-paper-q' }));
    if (item.shape && !samePicture(version.items, item)) li.append(paperPicture(item.shape));
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
  card.id = `score-${s.code}`;
  const head = h('div', 't-card-head');
  head.append(btn('t-who', s.name, () => showStudent(s.code)), cell(s.status.skills[skillId]));
  card.append(head);
  const past = s.verifications.filter((v) => v.skillId === skillId);
  if (past.length) {
    card.append(h('p', 't-card-sub', past.map((v) => `Attempt ${v.attempt}: ${v.score}/${v.outOf} (version ${v.version}), ${v.decision === 'verified' ? 'verified' : 'not yet'}`).join(' · ')));
  }
  // "Not yet" on paper: the teacher can send the student back to redo the skill.
  const latest = past.slice().sort((a, b) => String(a.at).localeCompare(String(b.at))).pop();
  if (latest?.decision === 'not-yet' && s.status.skills[skillId] === 'platform') {
    const row = h('div', 't-controls');
    row.append(h('span', 't-hint', 'Not yet on paper.'), sendBackButton(s, skillId, render));
    card.append(row);
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
    const save = (decision) => async () => {
      if (live) {
        const res = await api.teacher('verify', { studentId: s.id, skillId, version: version.id, marks, decision });
        if (res.error) return problem(res);
        delete marksDraft[s.code];
        return reload();
      }
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
// A paper item's picture (a data display, a shape): the same drawing the student app uses.
// "Using the same dot plot…": an item whose picture matches the one before it isn't drawn again.
function samePicture(items, item) {
  const before = items[items.indexOf(item) - 1];
  return Boolean(before?.shape) && JSON.stringify(before.shape) === JSON.stringify(item.shape);
}

function paperPicture(node) {
  const box = h('div', 'p-shape');
  box.append(drawShape(node));
  return box;
}

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
    if (item.shape && !samePicture(version.items, item)) li.append(paperPicture(item.shape));
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

  if (live) {
    screen.append(addStudentsCard());
  } else {
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
    Object.assign(store, { verifications: [], clearances: [], resets: [], log: [], codeChanges: {} });
    classFilter = 'all';
    persist();
    buildClass();
  }));
  settings.append(row);
  screen.append(settings);
  }

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
      if (live) {
        api.teacher('resetCode', s.id).then((res) => (res.error ? problem(res) : reload()));
        return;
      }
      const fresh = newCode(s.code);
      logChange(s.code, 'Code reset', s.shownCode, fresh);
      store.codeChanges[s.code] = fresh;
      persist();
      refresh();
      render();
    });
    actions.append(reset, ' · ', confirmBtn('t-link', 'Remove', `Tap again: remove ${s.name}`, () => classAction('removeStudent', live ? s.id : s.code)));
    tr.append(h('td', '', className.get(s.classId)), nameCell, h('td', 't-code', s.shownCode), h('td', '', s.nickname || '—'), actions);
    tbody.append(tr);
  }
  table.append(thead, tbody);
  scroller.append(table);
  screen.append(classesCard(), scroller);
  if (data.removed && (data.removed.classes.length || data.removed.students.length)) screen.append(removedCard());
  swap(app, screen);
}

// Each class: who teaches it, sharing with a co-teacher, removing it.
function classesCard() {
  const card = h('div', 't-card');
  card.append(h('h2', 't-h2', 'Classes and co-teachers'));
  card.append(h('p', 't-card-sub', 'Share a class with a co-teacher by their school Google email. They open the same dashboard link and see the class, and can do everything you can. Every change is logged with who made it.'));
  for (const c of data.classes) {
    const row = h('div', 't-class-row');
    const who = h('p', 't-class-who');
    who.append(h('strong', '', c.name), ` · ${c.teacherEmail === data.teacher || !live ? 'you' : c.teacherEmail}`);
    for (const co of c.coTeachers || []) {
      who.append(', ', co, ' ');
      who.append(btn('t-link', 'stop sharing', () => classAction('unshareClass', c.id, co)));
    }
    const share = h('form', 't-controls');
    const email = h('input', 't-number t-wide');
    Object.assign(email, { type: 'email', placeholder: 'co-teacher@school.org', autocomplete: 'off' });
    email.setAttribute('aria-label', `Co-teacher's email for ${c.name}`);
    const add = h('button', 'button', 'Share');
    add.type = 'submit';
    share.addEventListener('submit', (e) => {
      e.preventDefault();
      if (email.value.trim()) classAction('shareClass', c.id, email.value.trim().toLowerCase());
    });
    share.append(email, add, confirmBtn('t-link', 'Remove class', `Tap again: remove ${c.name} and its students`, () => classAction('removeClass', c.id)));
    row.append(who, share);
    card.append(row);
  }
  return card;
}

// Removed classes and students, with a way back. Nothing was deleted.
function removedCard() {
  const card = h('div', 't-card');
  card.append(h('h2', 't-h2', 'Removed'));
  card.append(h('p', 't-card-sub', 'Removed students can’t sign in, and don’t show on the dashboard. Their work is kept: bring them back any time.'));
  const className = new Map(data.classes.map((c) => [c.id, c.name]));
  const items = [
    ...data.removed.classes.map((c) => ({ text: `Class: ${c.name}`, back: () => classAction('restoreClass', c.id) })),
    ...data.removed.students.map((st) => ({ text: `${st.realName || st.code} (${className.get(st.classId) || 'class'})`, back: () => classAction('restoreStudent', st.id) })),
  ];
  for (const it of items) {
    const row = h('p', 't-class-who');
    row.append(it.text, ' ', btn('t-link', 'Bring back', it.back));
    card.append(row);
  }
  return card;
}

// Live only: make a class, and add students to it (codes are made by the server).
function addStudentsCard() {
  const card = h('div', 't-card');
  card.append(h('h2', 't-h2', 'Add students'));
  card.append(h('p', 't-card-sub', 'Paste names, one per line. Each student gets a code to sign in with. Names stay in your private roster; students never see them.'));
  const row = h('div', 't-controls');
  const pick = h('select', 't-select');
  pick.id = 'add-class';
  for (const c of data.classes) pick.append(new Option(c.name, c.id));
  pick.append(new Option('+ New class…', 'new'));
  const newName = h('input', 't-number t-wide');
  Object.assign(newName, { id: 'new-class-name', placeholder: 'e.g. Period 3' });
  newName.hidden = data.classes.length > 0;
  if (!data.classes.length) pick.value = 'new';
  pick.addEventListener('change', () => { newName.hidden = pick.value !== 'new'; });
  row.append(pick, newName);
  const names = h('textarea', 't-names');
  Object.assign(names, { id: 'add-names', rows: 6, placeholder: 'One name per line' });
  const go = btn('button button-primary', 'Add students', async () => {
    const wanted = names.value.split('\n').map((n) => n.trim()).filter(Boolean);
    if (!wanted.length) return;
    go.disabled = true;
    let classId = pick.value;
    if (classId === 'new') {
      const made = await api.teacher('addClass', newName.value || 'New class');
      if (made.error) { go.disabled = false; return problem(made); }
      classId = made.class.id;
    }
    const res = await api.teacher('addStudents', classId, wanted);
    go.disabled = false;
    if (res.error) return problem(res);
    reload(() => {
      tab = 'roster';
      roster();
      const done = h('div', 't-card');
      done.append(h('h2', 't-h2', `Added ${res.students.length} students. Their codes:`));
      done.append(list(res.students.map((x) => `${x.realName || '(no name)'}: ${x.code}`)));
      app.querySelector('.t-screen').insertBefore(done, app.querySelector('.t-screen .t-card'));
    });
  });
  card.append(row, names, go);
  return card;
}

function newCode(code) {
  const rng = createRng(`reset|${code}|${Date.now()}`);
  const a = ['acorn', 'delta', 'orbit', 'prism', 'quartz', 'tundra', 'zephyr', 'lagoon'];
  const b = ['owl', 'yak', 'newt', 'crane', 'mole', 'seal', 'wren', 'hare'];
  return `${rng.pick(a)}-${rng.pick(b)}-${rng.int(10, 99)}`;
}

// ---------- Student profile ----------

const detailCache = new Map(); // live: code -> { sections, diagnostic } with every answer
let currentProfile = null;

function showStudent(code) {
  currentProfile = code;
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
  for (const t of ['Skill', 'Platform (provisional)', 'Verified on paper', 'Memory checks', '']) mh.append(h('th', '', t));
  mt.append(mh);
  for (const lesson of lessons) {
    const tr = h('tr');
    const v = s.status.verification[lesson.skill];
    const p = s.status.platformAt[lesson.skill];
    tr.append(
      h('td', '', shortName(lesson.skill)),
      h('td', '', p ? `Yes, ${day(p)}` : '—'),
      h('td', '', v ? `${v.decision === 'verified' ? 'Yes' : 'Not yet'}: ${v.score}/${v.outOf}, ${day(v.at)}` : '—'),
      h('td', '', memoryText(s.status.memory?.[lesson.skill])),
    );
    const action = h('td');
    if (p || v) action.append(sendBackButton(s, lesson.skill, () => showStudent(code)));
    else if (s.status.resetAt[lesson.skill]) action.append(h('span', 't-hint', `Sent back ${day(s.status.resetAt[lesson.skill])}`));
    tr.append(action);
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
      const title = item.title === 'Putting it together' ? `Putting it together (${item.lessonTitle})` : item.title;
      li.append(h('span', '', item.review ? `Quick review: ${title}` : title));
      const look = { done: ['Done', 'good'], tried: ['Started', 'warn'], 'not-started': [item.waiting ? 'Waiting' : 'Not started', 'muted'] }[item.progress];
      li.append(pill(...look));
      if (item.assigned) {
        // Take back the assignment it came from (a whole lesson, or this one step).
        const from = s.status.assigned.find((a) => a.lesson === item.lesson && (a.section === item.section || !a.section));
        li.append(pill('From you', 'info'));
        if (from) li.append(btn('t-link', 'Take back', () => changePath([s.code], 'unassign', from.lesson, from.section, () => showStudent(code))));
      } else if (item.progress !== 'done') {
        li.append(btn('t-link', 'Skip', () => changePath([s.code], 'skip', item.lesson, item.section, () => showStudent(code))));
      }
    } else {
      li.append(h('span', '', `${item.kind === 'unchecked' ? 'Check first' : 'Gap, no lesson yet'}: ${item.name}`));
      if (item.cleared) li.append(pill('Checked', 'good'));
      else {
        li.append(btn('t-link', 'Mark checked', () => clearFoundations([s.code], item.gap, () => showStudent(code))));
      }
    }
    ol.append(li);
  }
  // Memory checks show up on the student's path too ("Keep it fresh").
  for (const [skill, m] of Object.entries(s.status.memory || {})) {
    if (m.status !== 'due' && m.status !== 'slipping') continue;
    const li = h('li', 't-path-item');
    const title = lessons.find((l) => l.skill === skill).title;
    li.append(h('span', '', m.status === 'due' ? `Memory check: ${title}` : `Refresher: Putting it together (${title})`));
    li.append(pill(m.status === 'due' ? 'Due' : 'Slipped', 'warn'));
    ol.append(li);
  }
  pathCard.append(ol);
  if (s.status.skipped.length) {
    pathCard.append(h('h3', 't-area-head', 'Taken off by you'));
    const ul = h('ul', 't-path');
    for (const k of s.status.skipped) {
      const l = lessons.find((x) => x.skill === k.lesson);
      const li = h('li', 't-path-item');
      li.append(h('span', '', k.section ? `${l.sections.find((x) => x.id === k.section).title} (${l.title})` : `${l.title} (whole lesson)`));
      li.append(btn('t-link', 'Put back', () => changePath([s.code], 'unskip', k.lesson, k.section, () => showStudent(code))));
      ul.append(li);
    }
    pathCard.append(ul);
  }
  pathCard.append(h('p', 't-hint', 'Add any lesson (or one step) to the top of their path, even one the check didn’t point to.'));
  pathCard.append(assignPicker((lesson, section) => changePath([s.code], 'assign', lesson, section, () => showStudent(code))));
  left.append(pathCard);

  // Participation.
  const p = s.part;
  const partCard = h('div', 't-card');
  partCard.append(h('h2', 't-h2', 'Last 7 days'));
  partCard.append(h('p', '', `${p.daysActive} days active · ${p.sectionsFinished} sections finished · ${p.minutes} minutes · last active ${p.lastActive ? day(p.lastActive) : 'never'}`));
  left.append(partCard);

  // Practice for a check (the student's own choice; never changes mastery).
  const practiceCard = h('div', 't-card');
  practiceCard.append(h('h2', 't-h2', 'Practice for a check'));
  const sets = [...s.practice].sort((a, b) => b.finishedAt.localeCompare(a.finishedAt));
  const skillTitle = (id) => lessons.find((l) => l.skill === id)?.title || id;
  practiceCard.append(list(sets.map((r) => `${day(r.finishedAt)}: ${skillTitle(r.skillId)}, ${r.firstTry} of ${r.problemCount} right on the first try`), 'No practice sets yet.'));
  left.append(practiceCard);

  // Memory checks (retention), newest first.
  const memCard = h('div', 't-card');
  memCard.append(h('h2', 't-h2', 'Memory checks'));
  const checks = [...(s.memory || [])].sort((a, b) => b.finishedAt.localeCompare(a.finishedAt));
  memCard.append(list(checks.map((r) => `${day(r.finishedAt)}: ${skillTitle(r.skillId)}, ${r.firstTry} of ${r.problemCount} right: ${r.held ? 'held up' : 'slipped (refresher next)'}`), 'No memory checks yet. The first comes two weeks after platform mastery.'));
  left.append(memCard);

  // Change log.
  const mine = (live ? data.log || [] : store.log).filter((l) => l.code === s.code);
  const logCard = h('div', 't-card');
  logCard.append(h('h2', 't-h2', 'Changes'));
  logCard.append(list(mine.map((l) => `${day(l.at)}: ${l.what} (${l.before || "—"} → ${l.after || "—"}), by ${l.by}`), 'No changes yet.'));
  left.append(logCard);

  // Practice history, newest first; every problem re-created from its seed.
  const hist = h('div', 't-card');
  hist.append(h('h2', 't-h2', 'Practice'));
  const records = [...s.sections].sort((a, b) => b.finishedAt.localeCompare(a.finishedAt));
  if (!records.length) hist.append(h('p', 'empty', 'No practice yet.'));
  // Live: the dashboard has summaries; this student's answers are fetched now, once.
  const detail = live ? detailCache.get(s.code) : null;
  if (live && (records.length || s.diagnostic) && !detail) {
    hist.append(h('p', 't-hint', 'Loading every answer…'));
    api.teacher('studentDetail', s.id).then((res) => {
      if (res.error) return problem(res);
      detailCache.set(s.code, { sections: res.sections, diagnostic: res.diagnostic });
      if (app.querySelector('.t-profile-head') && currentProfile === code) showStudent(code);
    });
  }
  const full = new Map((detail?.sections || []).map((r) => [r.saveId, r]));
  for (const r of records) hist.append(sectionHistory(r, full.get(r.saveId)));
  right.append(hist);

  // Diagnostic.
  const diag = h('div', 't-card');
  diag.append(h('h2', 't-h2', `Diagnostic${s.diagnostic ? `, ${day(s.diagnostic.finishedAt)}` : ''}`));
  // Live: the question list and times come with this student's details.
  const fullDiag = live ? detail?.diagnostic : s.diagnostic;
  if (s.result) diag.append(diagnosticReport(fullDiag?.result || s.result, { graph, misconceptions, times: fullDiag?.times || [] }));
  else diag.append(h('p', 'empty', 'Not taken yet.'));
  right.append(diag);

  grid.append(left, right);
  screen.append(grid);
  swap(app, screen);
}

const ENDED = { passed: 'Passed the check', mastered: 'Platform mastery', limit: 'Stopped (too many problems)', 'review-missed': 'Quick review: missed one, full section next' };
const OUTCOME = { 'right-first': 'Right', 'right-second': 'Right on 2nd try', missed: 'Missed' };

// The problems of a finished section: stored (pretend class), or re-created
// from the seed and answers exactly as the server graded them.
function problemsOf(r) {
  if (r.problems) return r.problems;
  if (!r.answers || !r.seed) return null;
  const sec = lessons.flatMap((l) => l.sections).find((x) => x.id === r.section);
  return replayPractice({ generators, rules, seed: r.seed, plan: practicePlan(sec, { review: r.review === true }) }, r.answers).result().problems;
}

function sectionHistory(summary, detail) {
  const r = { ...summary, ...(detail || {}) };
  const problems = problemsOf(r);
  const d = h('details', 't-history');
  const count = r.problemCount ?? problems?.length ?? 0;
  const firstTry = r.firstTry ?? problems.filter((p) => p.outcome === 'right-first').length;
  const mins = Math.round((r.seconds ?? r.times.reduce((n, x) => n + x, 0) / 1000) / 60);
  const sum = h('summary', 't-history-sum');
  sum.append(
    h('span', 't-history-title', `${r.review ? (wholeSectionIds.has(r.section) ? 'Refresher: ' : 'Quick review: ') : ''}${sectionTitle.get(r.section)}${r.attemptNo > 1 ? ` (try ${r.attemptNo})` : ''}`),
    h('span', 't-card-sub', `${day(r.finishedAt)} · ${ENDED[r.endedBy] || r.endedBy} · ${firstTry}/${count} right first try · ${mins} min`),
  );
  d.append(sum);
  if (!problems) {
    d.append(h('p', 't-hint', 'Loading answers…'));
    return d;
  }
  const log = h('div', 'log');
  const head = h('div', 'log-row log-head');
  ['#', 'Problem', 'Answers', 'Result', 'Level'].forEach((t) => head.append(h('span', '', t)));
  log.append(head);
  problems.filter((p) => p.outcome).forEach((p, i) => {
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

function memoryText(m) {
  if (!m) return '—';
  if (m.status === 'waiting') return `Next ${day(m.dueAt)}${m.stage ? ` (${m.stage} held up)` : ''}`;
  if (m.status === 'due') return 'Due now';
  if (m.status === 'slipping') return `Slipped ${day(m.lastAt)}: refresher next`;
  return 'Held up every time';
}

function day(iso) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ---------- start ----------

if (live) {
  const loading = h('section', 'screen t-screen');
  loading.append(h('p', 'lede', 'Loading your classes…'));
  swap(app, loading);
  api.teacher('teacherData').then((res) => {
    if (res.error) {
      const screen = h('section', 'screen t-screen');
      screen.append(h('h1', 'title t-title', 'Can’t open the dashboard'), h('p', 'lede', res.error === 'network'
        ? 'Couldn’t reach MathPath. Check the connection and reload the page.'
        : res.message));
      swap(app, screen);
      return;
    }
    serverData = res;
    if (!res.classes.length) tab = 'roster';
    buildClass();
  });
} else {
  buildClass();
}

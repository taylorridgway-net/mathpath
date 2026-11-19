// The student page (preview version): diagnostic -> path -> lesson sections.
//
// PREVIEW ONLY: there is no server yet, so this page picks a demo seed itself
// and keeps everything in this browser. In the real app the server hands out
// the seed and receives one save at the end. The engine code is identical.

import domainsIndex from '../../curriculum/graph/domains.json';
import wholeGraph from '../../curriculum/graph/whole.json';
import intGraph from '../../curriculum/graph/int.json';
import fracGraph from '../../curriculum/graph/frac.json';
import fracMisconceptions from '../../curriculum/misconceptions/frac.json';
import fracDiagnostic from '../../curriculum/diagnostic/frac.json';
import addSubLesson from '../../curriculum/lessons/frac.add-sub.json';
import masteryRules from '../../curriculum/mastery.json';
import { buildGraphIndex } from '../../engine/graph/graph-index.js';
import { generators, generateProblem } from '../../engine/generators/index.js';
import { replayDiagnostic } from '../../engine/diagnostic/diagnostic.js';
import { toText } from '../../engine/problem/text.js';
import { buildPath } from '../../engine/lessons/path.js';
import { renderMath } from '../components/render-math.js';
import { createKeypad } from '../components/keypad.js';
import { rawToText } from '../components/answer-editor.js';
import { loadLocal, saveLocal, removeLocal } from '../storage/local.js';
import { loadProgress, finishedRecords, clearAllSections, outboxCount } from '../storage/sections.js';
import { openSection } from './lesson.js';
import { h, section, btn, pill, list, swap as swapInto } from './dom.js';

const STORE_KEY = 'mathpath.preview.diagnostic.v1';
const LESSON_SEED_KEY = 'mathpath.preview.lesson-seed.v1';
const lessons = [addSubLesson];
let previewOpen = false; // keep the teacher-preview list open after visiting a section

const graph = buildGraphIndex(domainsIndex, {
  'whole.json': wholeGraph,
  'int.json': intGraph,
  'frac.json': fracGraph,
});
const misconceptions = fracMisconceptions.misconceptions;
const setupFor = (seed) => ({ graph, generators, misconceptions, config: fracDiagnostic, seed });

const app = document.getElementById('app');
let session = null; // { seed, answers, times, startedAt }
let diagnostic = null;
let keypad = null;
let shownAt = 0;

// ---------- screens ----------

function showStart() {
  const saved = loadLocal(STORE_KEY);
  const canResume = saved && Array.isArray(saved.answers) && saved.answers.length > 0 && !saved.finished;

  const screen = section('screen screen-start');
  screen.append(
    h('p', 'eyebrow', 'Fractions check'),
    h('h1', 'title', 'Let’s see what you already know'),
    h('p', 'lede', 'About 5 to 25 short questions. This isn’t graded. It shows your teacher where to start, so you don’t redo things you already know.'),
    h('p', 'lede', 'If you don’t know an answer, tap “I’m not sure”. That helps too.'),
  );
  const actions = h('div', 'actions');
  if (canResume) {
    actions.append(
      btn('button button-primary', `Continue from question ${saved.answers.length + 1}`, () => begin(saved)),
      btn('button', 'Start over', () => begin(null)),
    );
  } else {
    actions.append(btn('button button-primary', 'Start', () => begin(null)));
  }
  screen.append(actions, previewSections());
  swap(screen);
}

function begin(saved) {
  session = saved || { seed: demoSeed(), answers: [], times: [], startedAt: new Date().toISOString() };
  try {
    diagnostic = replayDiagnostic(setupFor(session.seed), session.answers);
  } catch {
    // Saved progress doesn't fit the current questions (e.g. the app was updated). Start fresh.
    session = { seed: demoSeed(), answers: [], times: [], startedAt: new Date().toISOString() };
    diagnostic = replayDiagnostic(setupFor(session.seed), []);
  }
  saveLocal(STORE_KEY, session);
  showQuestion();
}

function showQuestion() {
  const q = diagnostic.nextQuestion();
  if (!q) return showDone();

  const screen = section('screen screen-question');
  const top = h('div', 'question-top');
  top.append(h('span', 'counter', `Question ${q.index + 1}`), h('span', 'counter-note', 'No grades'));

  const card = h('div', 'question-card');
  const instruction = h('p', 'instruction', q.problem.instruction);
  instruction.id = 'instruction';
  const math = h('div', 'question-math');
  math.append(renderMath(q.problem.expression));
  card.append(instruction, math);
  card.setAttribute('aria-labelledby', 'instruction');

  const answerHost = h('div', '');
  screen.append(top, card, answerHost);
  swap(screen);

  keypad = createKeypad({
    host: answerHost,
    allowFractions: q.problem.answer.type === 'fraction',
    onSubmit: (raw) => answer(raw),
    onSkip: () => answer({}),
  });
  shownAt = performance.now();
}

function answer(raw) {
  keypad?.destroy();
  keypad = null;
  diagnostic.submit(raw);
  session.answers.push(raw);
  session.times.push(Math.round(performance.now() - shownAt));
  saveLocal(STORE_KEY, session);
  showQuestion();
}

function showDone() {
  const result = diagnostic.result();
  session.finished = true;
  saveLocal(STORE_KEY, session);

  const name = (id) => graph.get(id).name;
  const shown = Object.keys(result.nodes)
    .filter((id) => result.nodes[id].status === 'known' && graph.get(id).kind === 'subskill');
  const path = buildPath({ result, lessons, graph });

  const screen = section('screen screen-done');
  screen.append(h('p', 'eyebrow', 'Fractions'), h('h1', 'title', 'Your path'));

  const strong = h('div', 'done-block');
  strong.append(h('h2', 'block-title', 'You showed you can'));
  strong.append(list(shown.map(name), 'Nothing yet in this part. That’s fine: this is where we start.'));

  const next = h('div', 'done-block');
  next.append(h('h2', 'block-title', 'What to work on, in order'));
  next.append(pathList(path));
  screen.append(next, strong, teacherView(result), previewSections());

  const actions = h('div', 'actions');
  actions.append(btn('button', 'Start over (new check, clears lesson progress)', () => {
    removeLocal(STORE_KEY);
    removeLocal(LESSON_SEED_KEY);
    clearAllSections();
    showStart();
  }));
  screen.append(actions);
  swap(screen);
}

// ---------- the path: one row per section, with its status ----------

function sectionState(sectionId) {
  const records = finishedRecords(sectionId);
  if (records.some((r) => r.provisionalMastery)) return ['Platform mastery (provisional)', 'good', 'Practice again'];
  if (records.some((r) => r.passed)) return ['Done', 'good', 'Practice again'];
  if (loadProgress(sectionId)) return ['In progress', 'warn', 'Continue'];
  if (records.length) return ['Tried, not finished', 'warn', 'Try again'];
  return ['Not started', 'muted', 'Start'];
}

function pathList(path) {
  if (!path.length) return h('p', 'empty', 'Nothing to work on here right now.');
  const ol = h('ol', 'path');
  let nextMarked = false;
  path.forEach((item) => {
    const li = h('li', 'path-item');
    const text = h('div', 'path-text');
    if (item.kind === 'not-built') {
      text.append(h('span', 'path-title', item.name), h('span', 'path-note', 'Your teacher will help with this one. (No lesson for it yet.)'));
      li.append(text, pill('Not built yet', 'muted'));
    } else {
      const [label, tone, action] = sectionState(item.section);
      text.append(h('span', 'path-title', item.title), pill(label, tone));
      const primary = !nextMarked && tone !== 'good';
      if (primary) nextMarked = true;
      li.append(text, btn(primary ? 'button button-primary' : 'button', action, () => goToSection(item.section)));
    }
    ol.append(li);
  });
  return ol;
}

// PREVIEW ONLY: every section, so the owner can read all the lesson text.
function previewSections() {
  const details = h('details', 'teacher');
  details.append(h('summary', 'teacher-summary', 'Teacher preview: open any lesson section'));
  details.open = previewOpen;
  details.addEventListener('toggle', () => { previewOpen = details.open; });
  const ol = h('ol', 'path');
  for (const lesson of lessons) {
    for (const s of lesson.sections) {
      const li = h('li', 'path-item');
      const text = h('div', 'path-text');
      const [label, tone, action] = sectionState(s.id);
      text.append(h('span', 'path-title', s.title), pill(label, tone));
      li.append(text, btn('button', action, () => goToSection(s.id)));
      ol.append(li);
    }
  }
  details.append(ol);
  const waiting = outboxCount();
  if (waiting) details.append(h('p', 'fine', `${waiting} finished section${waiting === 1 ? '' : 's'} saved on this device, waiting for the server (not built yet).`));
  return details;
}

function goToSection(sectionId) {
  const lesson = lessons.find((l) => l.sections.some((s) => s.id === sectionId));
  openSection({
    app,
    lesson,
    sectionId,
    rules: masteryRules.default,
    curriculumVersion: graph.curriculumVersion,
    baseSeed: lessonSeed(),
    onExit: () => (diagnostic && session?.finished ? showDone() : showStart()),
  });
}

function lessonSeed() {
  let seed = loadLocal(LESSON_SEED_KEY);
  if (!seed) {
    seed = session?.seed || demoSeed();
    saveLocal(LESSON_SEED_KEY, seed);
  }
  return seed;
}

// ---------- the teacher's view of the result (preview: shown under the student's) ----------

const STATUS = {
  known: ['Answered correctly', 'good'],
  'known-inferred': ['Credited, not asked', 'info'],
  shaky: ['Shaky: one miss, then right', 'warn'],
  gap: ['Gap: missed twice', 'bad'],
  unchecked: ['Possible cause, can’t check yet', 'muted'],
  'not-tested': ['Not tested', 'muted'],
};

const RESULT_WORDS = {
  correct: 'Right',
  'not-simplified': 'Right, not simplified',
  'wrong-form': 'Right, wrong form',
  wrong: 'Wrong',
  invalid: 'Skipped',
};

function teacherView(result) {
  const details = h('details', 'teacher');
  details.append(h('summary', 'teacher-summary', 'Teacher view of this result (preview)'));

  const misconceptionText = new Map(misconceptions.map((m) => [m.id, m.description]));

  // Skill by skill, subskills underneath.
  const table = h('div', 'status-table');
  const skillIds = [...new Set(Object.keys(result.nodes).map((id) => graph.get(id).skillId))];
  for (const skillId of skillIds) {
    const group = h('div', 'status-group');
    group.append(h('h3', 'status-skill', graph.get(skillId).name));
    const ids = [skillId, ...graph.subskillsOf(skillId)].filter((id) => result.nodes[id]);
    for (const id of ids) {
      const r = result.nodes[id];
      const row = h('div', 'status-row');
      let [label, tone] = r.blockedBy ? ['Blocked', 'muted'] : STATUS[r.status];
      if (id === skillId && r.status === 'gap') label = 'Gap: each step fine, whole problem missed twice';
      const nameCell = h('span', 'status-name', id === skillId ? '(whole skill)' : graph.get(id).name);
      if (r.blockedBy) {
        const needs = r.blockedBy.map((b) => `“${graph.get(b).name}”`).join(', ');
        nameCell.append(h('span', 'status-why', `Can’t check yet: these problems also need ${needs}`));
      }
      row.append(nameCell, pill(label, tone));
      group.append(row);
    }
    table.append(group);
  }
  details.append(h('h3', 'teacher-heading', 'Skills'), table);

  const seen = Object.entries(result.misconceptions);
  if (seen.length) {
    details.append(h('h3', 'teacher-heading', 'Wrong-answer patterns seen'));
    details.append(list(seen.map(([id, n]) => `${misconceptionText.get(id)} (${n}×)`)));
  }

  details.append(h('h3', 'teacher-heading', 'Every question'));
  const log = h('div', 'log');
  const head = h('div', 'log-row log-head');
  ['#', 'Problem', 'Answer', 'Result', 'Time'].forEach((t) => head.append(h('span', '', t)));
  log.append(head);
  result.questions.forEach((q, i) => {
    // Re-created from the saved seed, the same way the server will check it.
    const problem = toText(generateProblem(q.generator, q.seed, q.difficulty).expression);
    const row = h('div', 'log-row');
    row.append(
      h('span', 'num', String(i + 1)),
      h('span', 'log-problem', problem),
      h('span', 'num', rawToText(q.answer)),
      h('span', '', RESULT_WORDS[q.status] + (q.misconception ? ` (${q.misconception.replace('frac.', '')})` : '')),
      h('span', 'num', `${Math.round((session.times[i] || 0) / 1000)}s`),
    );
    log.append(row);
  });
  const scroller = h('div', 'log-scroll');
  scroller.append(log);
  details.append(scroller);
  details.append(h('p', 'fine', `Seed ${result.seed} · ${result.questionCount} questions · curriculum ${result.curriculumVersion}`));
  return details;
}

// ---------- helpers ----------

function swap(screen) {
  swapInto(app, screen);
}
function demoSeed() {
  const bytes = new Uint32Array(2);
  crypto.getRandomValues(bytes);
  return `demo-${bytes[0].toString(36)}${bytes[1].toString(36)}`;
}

const finishedBefore = loadLocal(STORE_KEY);
let resumed = false;
if (finishedBefore?.finished) {
  try {
    session = finishedBefore;
    diagnostic = replayDiagnostic(setupFor(session.seed), session.answers);
    resumed = true;
  } catch {
    // The saved check doesn't fit the current questions (the app changed). Start fresh.
    session = null;
    diagnostic = null;
  }
}
if (resumed) showDone();
else showStart();

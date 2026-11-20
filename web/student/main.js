// The student page: sign in -> diagnostic -> path -> lesson sections.
//
// The same page runs on Google Apps Script (the real app) and in the claude.ai
// preview (web/api/client.js runs the server code in the browser there).
// Work is saved in this browser first, then uploaded once per finished
// diagnostic or section; anything not uploaded yet is retried on the next load.

import domainsIndex from '../../curriculum/graph/domains.json';
import wholeGraph from '../../curriculum/graph/whole.json';
import intGraph from '../../curriculum/graph/int.json';
import algGraph from '../../curriculum/graph/alg.json';
import fracGraph from '../../curriculum/graph/frac.json';
import fracMisconceptions from '../../curriculum/misconceptions/frac.json';
import wholeMisconceptions from '../../curriculum/misconceptions/whole.json';
import intMisconceptions from '../../curriculum/misconceptions/int.json';
import algMisconceptions from '../../curriculum/misconceptions/alg.json';
import fracDiagnostic from '../../curriculum/diagnostic/frac.json';
import addSubLesson from '../../curriculum/lessons/frac.add-sub.json';
import equivalentLesson from '../../curriculum/lessons/frac.equivalent.json';
import compareLesson from '../../curriculum/lessons/frac.compare.json';
import multiplyLesson from '../../curriculum/lessons/frac.multiply.json';
import divideLesson from '../../curriculum/lessons/frac.divide.json';
import intAddSubLesson from '../../curriculum/lessons/int.add-sub.json';
import intMultDivLesson from '../../curriculum/lessons/int.mult-div.json';
import signedLesson from '../../curriculum/lessons/frac.signed.json';
import orderOpsLesson from '../../curriculum/lessons/alg.order-ops.json';
import exponentsLesson from '../../curriculum/lessons/alg.exponents.json';
import equationsLesson from '../../curriculum/lessons/alg.equations.json';
import expressionsLesson from '../../curriculum/lessons/alg.expressions.json';
import meaningLesson from '../../curriculum/lessons/frac.meaning.json';
import wholeAddSubLesson from '../../curriculum/lessons/whole.add-sub.json';
import wholeMultDivLesson from '../../curriculum/lessons/whole.mult-div.json';
import wholeFactorsLesson from '../../curriculum/lessons/whole.factors-multiples.json';
import masteryRules from '../../curriculum/mastery.json';
import { buildGraphIndex } from '../../engine/graph/graph-index.js';
import { generators } from '../../engine/generators/index.js';
import { replayDiagnostic, compactResult, catchUpTargets, catchUpName, fixedGaps, recheckPlan } from '../../engine/diagnostic/diagnostic.js';
import { buildPath } from '../../engine/lessons/path.js';
import { seedFor } from '../../engine/seeds.js';
import { renderMath } from '../components/render-math.js';
import { createKeypad, keypadOptionsFor } from '../components/keypad.js';
import { loadLocal, saveLocal, removeLocal } from '../storage/local.js';
import {
  setStudent, loadMine, saveMine, loadProgress, finishedRecords, clearAllSections,
  saveFinished, outbox, removeFromOutbox, setAside,
} from '../storage/sections.js';
import { createApi, PREVIEW_CODE } from '../api/client.js';
import { openSection } from './lesson.js';
import { diagnosticReport } from '../components/diagnostic-report.js';
import { h, section, btn, pill, list, split, swap as swapInto } from '../components/dom.js';

const PROFILE_KEY = 'mathpath.profile.v1'; // { code, id, nickname, summary } of the signed-in student
const lessons = [wholeAddSubLesson, wholeMultDivLesson, wholeFactorsLesson, meaningLesson, equivalentLesson, compareLesson, addSubLesson, multiplyLesson, divideLesson, intAddSubLesson, intMultDivLesson, signedLesson, orderOpsLesson, exponentsLesson, equationsLesson, expressionsLesson];

const graph = buildGraphIndex(domainsIndex, { 'whole.json': wholeGraph, 'int.json': intGraph, 'frac.json': fracGraph, 'alg.json': algGraph });
const misconceptions = [...fracMisconceptions.misconceptions, ...wholeMisconceptions.misconceptions, ...intMisconceptions.misconceptions, ...algMisconceptions.misconceptions];
const api = createApi({
  setup: { graph, generators, misconceptions, diagnosticConfig: fracDiagnostic, lessons, rules: masteryRules.default },
});
// A catch-up check starts from the saved result and asks only about skills added since.
const setupFor = (seed, catchUp = null) => ({
  graph, generators, misconceptions, seed,
  config: catchUp ? { ...fracDiagnostic, targets: catchUp.targets || catchUpTargets({ graph, generators, config: fracDiagnostic, prior: catchUp.prior }) } : fracDiagnostic,
  prior: catchUp?.prior || null,
});
// A finished diagnostic as saved: used as it is, never re-run (re-running old answers
// through a newer diagnostic can ask different questions).
const savedDiagnostic = (result) => ({ result: () => result, nextQuestion: () => null, submit() {} });

const app = document.getElementById('app');
let profile = null;
let session = null; // the diagnostic: { attemptNo, seed, saveId, answers, times, startedAt, finished, catchUp?, result? }
let diagnostic = null;
let keypad = null;
let shownAt = 0;
let previewOpen = false;
let uploadState = 'idle'; // idle | uploading | offline

if (!api.preview) document.querySelector('.preview-banner')?.remove();

// ---------- sign in ----------

function showLogin(message) {
  const screen = section('screen screen-start');
  screen.append(h('p', 'eyebrow', 'MathPath'), h('h1', 'title', 'Sign in'));
  screen.append(h('p', 'lede', 'Type the code your teacher gave you. This device will remember it.'));
  const form = h('form', 'login');
  const label = h('label', 'login-label', 'Your code');
  label.htmlFor = 'code';
  const input = h('input', 'login-input');
  Object.assign(input, { id: 'code', name: 'code', autocomplete: 'off', spellcheck: false, placeholder: 'e.g. maple-tiger-42' });
  input.setAttribute('autocapitalize', 'none');
  const submit = h('button', 'button button-primary', 'Sign in');
  submit.type = 'submit';
  const error = h('p', 'login-error', message || '');
  error.setAttribute('role', 'alert');
  form.append(label, input, submit, error);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!input.value.trim()) return;
    submit.disabled = true;
    submit.textContent = 'Signing in…';
    const res = await api.student('login', input.value);
    if (res.error) {
      submit.disabled = false;
      submit.textContent = 'Sign in';
      error.textContent = res.error === 'network'
        ? 'Can’t reach MathPath right now. Check the Wi-Fi and try again.'
        : res.message;
      return;
    }
    signedIn({ code: input.value.trim().toLowerCase(), ...res.student, summary: res.summary });
  });
  screen.append(form);
  if (api.preview) screen.append(h('p', 'fine', `Preview: sign in with the pretend student’s code, ${PREVIEW_CODE}.`));
  swap(screen);
  input.focus();
}

function signedIn(p) {
  profile = p;
  saveLocal(PROFILE_KEY, profile);
  setStudent(profile.id);
  loadDiagnostic();
  route();
  upload();
}

function signOut() {
  // Nothing is deleted: unsent work stays on this device (under this student)
  // and uploads the next time they sign in here.
  removeLocal(PROFILE_KEY);
  profile = null;
  session = null;
  diagnostic = null;
  showLogin();
}

function accountBar() {
  const bar = h('div', 'account');
  const who = profile.nickname ? `Signed in as ${profile.nickname}` : `Signed in with code ${profile.code}`;
  bar.append(h('span', 'account-who', who), btn('account-out', 'Not you? Sign out', signOut));
  bar.append(saveStatus());
  return bar;
}

// "All your work is saved" / "2 finished parts waiting to upload".
function saveStatus() {
  const n = outbox().length;
  const el = h('span', 'save-status');
  el.setAttribute('aria-live', 'polite');
  if (!n) el.textContent = 'All your work is saved.';
  else if (uploadState === 'uploading') el.textContent = 'Saving…';
  else el.textContent = `${n} finished part${n === 1 ? '' : 's'} saved on this device, waiting to upload. It will try again automatically.`;
  el.classList.toggle('is-waiting', n > 0);
  return el;
}

// Send queued records in order. If the server is busy (a whole class saving at
// once) or the connection drops, try again after 15 s, 30 s, 1 min, 2 min, then
// every 2 min while the page is open; and always on the next load.
const RETRY_SECONDS = [15, 30, 60, 120];
let retries = 0;
let retryTimer = null;

async function upload() {
  if (!profile || uploadState === 'uploading') return;
  clearTimeout(retryTimer);
  uploadState = 'uploading';
  for (const record of outbox()) {
    const res = await api.student('saveRecord', profile.code, record);
    if (res.ok) {
      removeFromOutbox(record.saveId);
      profile.summary = res.summary;
      saveLocal(PROFILE_KEY, profile);
    } else if (['network', 'busy', 'server'].includes(res.error)) {
      uploadState = 'offline';
      refreshStatus();
      const wait = RETRY_SECONDS[Math.min(retries, RETRY_SECONDS.length - 1)];
      retries++;
      // A little randomness, so a whole class doesn't retry in the same second.
      retryTimer = setTimeout(upload, (wait + Math.random() * 10) * 1000);
      return;
    } else if (res.error === 'unknown-code') {
      uploadState = 'idle';
      return showLogin('Your code has changed. Ask your teacher for your new one. Your work is still saved on this device.');
    } else {
      setAside(record, res.error);
    }
  }
  uploadState = 'idle';
  retries = 0;
  refreshStatus();
}

function refreshStatus() {
  const old = document.querySelector('.save-status');
  if (old) old.replaceWith(saveStatus());
}

// ---------- the diagnostic ----------

// The diagnostic to show: the one in progress or finished on this device, or the
// one the server has (e.g. on a new Chromebook), whichever is newer.
function loadDiagnostic() {
  session = loadMine('diagnostic');
  const server = profile.summary.diagnostic;
  const serverIsNewer = server && (!session || session.attemptNo < server.attemptNo
    || (session.attemptNo === server.attemptNo && (!session.finished || (server.result && !session.result))));
  if (serverIsNewer) {
    session = { attemptNo: server.attemptNo, seed: server.seed, answers: server.answers, times: server.times || [], finished: true, result: server.result || null };
    saveMine('diagnostic', session);
  }
  diagnostic = null;
  if (session?.finished && session.result) {
    diagnostic = savedDiagnostic(session.result);
  } else if (session) {
    try {
      diagnostic = replayDiagnostic(setupFor(session.seed, session.catchUp), session.answers, session.times);
      if (session.finished) {
        session.result = compactResult(diagnostic.result());
        saveMine('diagnostic', session);
      }
    } catch {
      session = null; // doesn't fit the current questions (the app changed); start again
    }
  }
}

// A quick re-check: questions that couldn't be checked because of a gap the student
// has since fixed. Only offered once everything is uploaded, so the server sees the
// same progress (it re-checks the fixes itself).
function recheck() {
  if (!session?.finished || !diagnostic || outbox().length) return null;
  const prior = diagnostic.result();
  const fixed = fixedGaps({ graph, prior, summary: profile.summary, lessons });
  if (!fixed.length) return null;
  const plan = recheckPlan({ graph, generators, prior, fixed });
  return plan.targets.length ? { ...plan, fixed } : null;
}

// Skills with questions now that this student's diagnostic didn't have yet.
function catchUpSkills() {
  if (!session?.finished || !diagnostic) return [];
  return catchUpTargets({ graph, generators, config: fracDiagnostic, prior: diagnostic.result() });
}

function route() {
  if (session?.finished) showDone();
  else showStart();
}

function showStart() {
  const canResume = session && session.answers.length > 0 && !session.finished;
  const screen = section('screen screen-start');
  screen.append(accountBar());
  if (session?.catchUp?.recheck && !session.finished) {
    screen.append(
      h('p', 'eyebrow', 'Quick check'),
      h('h1', 'title', 'Let’s check what you can do now'),
      h('p', 'lede', 'You’ve fixed something that some questions depended on, so now we can check those. Everything else you showed still counts.'),
      h('p', 'lede', 'If you don’t know an answer, tap “I’m not sure”. That helps too.'),
    );
  } else if (session?.catchUp && !session.finished) {
    const named = catchUpName(fracDiagnostic, catchUpTargets({ graph, generators, config: fracDiagnostic, prior: session.catchUp.prior }));
    screen.append(
      h('p', 'eyebrow', named || 'Catch-up check'),
      h('h1', 'title', named ? 'Let’s see what you already know' : 'A few questions on new topics'),
      h('p', 'lede', named
        ? 'Short questions on new topics. This isn’t graded. Everything you showed in your first check still counts, so nothing is asked twice.'
        : 'MathPath has new topics since your first check. These questions are only about those. Everything you already showed still counts.'),
      h('p', 'lede', 'If you don’t know an answer, tap “I’m not sure”. That helps too.'),
    );
  } else {
    screen.append(
      h('p', 'eyebrow', 'Fractions check'),
      h('h1', 'title', 'Let’s see what you already know'),
      h('p', 'lede', 'About 5 to 25 short questions. This isn’t graded. It shows your teacher where to start, so you don’t redo things you already know.'),
      h('p', 'lede', 'If you don’t know an answer, tap “I’m not sure”. That helps too.'),
    );
  }
  const actions = h('div', 'actions');
  actions.append(btn('button button-primary', canResume ? `Continue from question ${session.answers.length + 1}` : 'Start', begin));
  screen.append(actions);
  if (api.preview) screen.append(previewSections());
  swap(screen);
}

function begin() {
  if (!session || session.finished) {
    const attemptNo = (profile.summary.diagnosticAttempts || 0) + 1;
    const seed = seedFor(profile.id, 'diagnostic', attemptNo);
    session = { attemptNo, seed, saveId: `${seed}|${new Date().toISOString()}`, answers: [], times: [], startedAt: new Date().toISOString(), finished: false };
  }
  diagnostic = replayDiagnostic(setupFor(session.seed, session.catchUp), session.answers, session.times);
  saveMine('diagnostic', session);
  showQuestion();
}

// Start a catch-up check from the finished diagnostic's result (or a quick re-check, from its plan).
function beginCatchUp(plan = null) {
  const prior = plan ? plan.prior : diagnostic.result();
  const attemptNo = Math.max(profile.summary.diagnosticAttempts || 0, session.attemptNo) + 1;
  const seed = seedFor(profile.id, 'diagnostic', attemptNo);
  session = {
    attemptNo, seed, saveId: `${seed}|${new Date().toISOString()}`, answers: [], times: [], startedAt: new Date().toISOString(),
    finished: false, catchUp: plan ? { prior, targets: plan.targets, recheck: true, fixed: plan.fixed } : { prior },
  };
  begin();
}

function showQuestion() {
  const q = diagnostic.nextQuestion();
  if (!q) return finishDiagnostic();

  const screen = section('screen screen-question');
  const top = h('div', 'question-top');
  top.append(h('span', 'counter', `Question ${q.index + 1}`), h('span', 'counter-note', 'No grades'));
  const cols = split();
  const card = h('div', 'question-card');
  const instruction = h('p', 'instruction', q.problem.instruction);
  instruction.id = 'instruction';
  const math = h('div', 'question-math');
  math.append(renderMath(q.problem.expression));
  card.append(instruction, math);
  card.setAttribute('aria-labelledby', 'instruction');
  const answerHost = h('div', '');
  cols.main.append(card);
  cols.side.append(answerHost);
  screen.append(top, cols.el);
  swap(screen);

  keypad = createKeypad({
    host: answerHost,
    ...keypadOptionsFor(q.problem),
    onSubmit: (raw) => answer(raw),
    onSkip: () => answer({}),
  });
  shownAt = performance.now();
}

function answer(raw) {
  keypad?.destroy();
  keypad = null;
  const ms = Math.round(performance.now() - shownAt);
  diagnostic.submit(raw, ms);
  session.answers.push(raw);
  session.times.push(ms);
  saveMine('diagnostic', session);
  showQuestion();
}

function finishDiagnostic() {
  if (!session.finished) {
    session.finished = true;
    session.finishedAt = new Date().toISOString();
    session.result = compactResult(diagnostic.result());
    saveMine('diagnostic', session);
    saveFinished({
      type: 'diagnostic', saveId: session.saveId, studentId: profile.id, attemptNo: session.attemptNo, seed: session.seed,
      answers: session.answers, times: session.times, startedAt: session.startedAt, finishedAt: session.finishedAt,
      curriculumVersion: graph.curriculumVersion, ...(session.catchUp ? { catchUp: true } : {}),
      ...(session.catchUp?.recheck ? { recheck: true, fixed: session.catchUp.fixed } : {}),
    });
    upload();
  }
  showDone();
}

// ---------- the path ----------

function showDone() {
  const result = diagnostic.result();
  const name = (id) => graph.get(id).name;
  const shown = Object.keys(result.nodes)
    .filter((id) => result.nodes[id].status === 'known' && graph.get(id).kind === 'subskill');
  const path = buildPath({ result, lessons, graph, cleared: profile.summary.cleared || [], waitForTeacher: masteryRules.default.paths?.waitForTeacherChecks });

  const screen = section('screen screen-done');
  screen.append(accountBar());
  screen.append(h('p', 'eyebrow', 'Fractions'), h('h1', 'title', profile.nickname ? `${profile.nickname}’s path` : 'Your path'));

  const strong = h('div', 'done-block');
  strong.append(h('h2', 'block-title', 'You showed you can'));
  strong.append(list(shown.map(name), 'Nothing yet in this part. That’s fine: this is where we start.'));
  strong.append(nicknameForm());
  const next = h('div', 'done-block');
  next.append(h('h2', 'block-title', 'What to work on, in order'));
  next.append(pathList(path));
  const grid = h('div', 'path-grid');
  grid.append(next, strong);
  const newSkills = catchUpSkills();
  if (newSkills.length) {
    const named = catchUpName(fracDiagnostic, newSkills);
    const card = h('div', 'done-block catch-up');
    card.append(
      h('h2', 'block-title', named ? `Next: the ${named.toLowerCase()}` : 'New topics to check'),
      h('p', 'lede', named
        ? `A few questions about these topics: ${newSkills.map(name).join('; ')}. Your answers add them to your path.`
        : `MathPath has new topics since your check: ${newSkills.map(name).join(', ')}. Answer a few questions so your path includes them.`),
    );
    const actions = h('div', 'actions');
    actions.append(btn('button button-primary', named ? `Start the ${named.toLowerCase()}` : 'Start the catch-up check', () => beginCatchUp()));
    card.append(actions);
    screen.append(card);
  } else {
    const plan = recheck();
    if (plan) {
      const card = h('div', 'done-block catch-up');
      card.append(
        h('h2', 'block-title', 'Ready for a quick check'),
        h('p', 'lede', `You worked on ${plan.fixed.map(name).join(', ').toLowerCase()}. Now we can check ${plan.targets.map(name).join(', ').toLowerCase()}, which builds on it. A few questions.`),
      );
      const actions = h('div', 'actions');
      actions.append(btn('button button-primary', 'Start the quick check', () => beginCatchUp(plan)));
      card.append(actions);
      screen.append(card);
    }
  }
  screen.append(grid, practiceCard());

  if (api.preview) {
    screen.append(teacherView(result), previewSections());
    const actions = h('div', 'actions');
    actions.append(btn('button', 'Start over (preview: forget everything)', () => {
      api.reset();
      clearAllSections();
      signOut();
    }));
    screen.append(actions);
  }
  swap(screen);
}

function nicknameForm() {
  const form = h('form', 'nickname');
  const label = h('label', 'nickname-label', 'Nickname (optional)');
  label.htmlFor = 'nickname';
  const input = h('input', 'login-input');
  Object.assign(input, { id: 'nickname', maxLength: 20, value: profile.nickname || '', placeholder: 'What should we call you?' });
  const save = h('button', 'button', 'Save');
  save.type = 'submit';
  const note = h('span', 'fine', 'Don’t use your real name. Your teacher already knows it’s you.');
  form.append(label, input, save, note);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const res = await api.student('setNickname', profile.code, input.value);
    if (res.ok) {
      profile.nickname = res.nickname;
      saveLocal(PROFILE_KEY, profile);
      showDone();
    } else {
      note.textContent = res.error === 'network' ? 'Couldn’t save right now. Try again later.' : res.message;
    }
  });
  return form;
}

// A section's state, from this device's records and what the server knows.
function sectionState(sectionId) {
  const sec = lessons.flatMap((l) => l.sections.map((s) => ({ ...s, lesson: l.skill }))).find((s) => s.id === sectionId);
  const s = profile.summary;
  // If the teacher sent the student back to redo this skill, earlier "Putting it together" work doesn't count.
  const resetAt = sec.mode === 'skill' ? s.resets?.[sec.lesson] : null;
  const records = finishedRecords(sectionId).filter((r) => !resetAt || String(r.finishedAt) > resetAt);
  if (sec.mode === 'skill' && (records.some((r) => r.provisionalMastery) || s.mastered?.includes(sec.lesson))) {
    return ['Platform mastery (provisional)', 'good', 'Practice again'];
  }
  if (records.some((r) => r.passed) || s.sectionsPassed?.includes(sectionId)) return ['Done', 'good', 'Practice again'];
  if (loadProgress(sectionId)) return ['In progress', 'warn', 'Continue'];
  if (records.length || (!resetAt && s.sectionAttempts?.[sectionId])) return ['Tried, not finished', 'warn', 'Try again'];
  if (resetAt) return ['Your teacher asked you to redo this', 'warn', 'Start'];
  return ['Not started', 'muted', 'Start'];
}

function pathList(path) {
  if (!path.length) return h('p', 'empty', 'Nothing to work on here right now.');
  const ol = h('ol', 'path');
  let nextMarked = false;

  // Foundations the teacher handles (no lesson yet, or can't be checked yet), as one item.
  const foundations = path.filter((item) => item.kind !== 'section');
  if (foundations.length) {
    const allCleared = foundations.every((f) => f.cleared);
    const li = h('li', 'path-item');
    const text = h('div', 'path-text');
    text.append(
      h('span', 'path-title', 'With your teacher first'),
      h('span', 'path-note', allCleared
        ? 'Your teacher has checked these. You can go on.'
        : 'One of these might be what makes the next steps hard. The app can’t teach or check them yet, so your teacher will check them with you. You can keep going in the meantime.'),
    );
    const ul = h('ul', 'plain-list');
    for (const f of foundations) {
      const row = h('li', f.cleared ? 'is-cleared' : '', f.name);
      if (f.kind === 'not-built') row.append(h('span', 'path-why', ' (missed in the check)'));
      if (f.cleared) row.append(h('span', 'path-why', ' ✓ checked'));
      ul.append(row);
    }
    text.append(ul);
    if (!allCleared && api.preview) {
      // PREVIEW ONLY: in the real app the teacher clears these in the dashboard.
      text.append(btn('button preview-only', 'Teacher (preview only): mark these checked', async () => {
        for (const f of foundations) await api.teacher('clearFoundation', profile.id, f.gap);
        const res = await api.student('login', profile.code);
        if (res.summary) profile.summary = res.summary;
        saveLocal(PROFILE_KEY, profile);
        showDone();
      }));
    } else if (!allCleared) {
      text.append(btn('button', 'Check again', refreshFromServer));
    }
    li.append(text, pill(allCleared ? 'Checked' : 'Teacher', allCleared ? 'good' : 'warn'));
    ol.append(li);
  }

  let lastLesson = null;
  path.filter((item) => item.kind === 'section').forEach((item) => {
    // A heading for each skill, so "Putting it together" is clear about what it puts together.
    if (item.lesson !== lastLesson) {
      ol.append(h('li', 'path-group', item.lessonTitle));
      lastLesson = item.lesson;
    }
    const li = h('li', 'path-item');
    const text = h('div', 'path-text');
    const [label, tone, action] = sectionState(item.section);
    // A "shaky" subskill starts as a quick review, until the student has tried it once.
    const review = item.review && !triedBefore(item.section);
    text.append(h('span', 'path-title', review ? `Quick review: ${item.title}` : item.title));
    if (review && tone === 'muted') text.append(h('span', 'path-note', 'You were close on this in the check. Get 3 right in a row and it’s done.'));
    if (item.waiting) {
      text.append(pill('Waiting for your teacher', 'muted'));
      const b = btn('button', action, () => {});
      b.disabled = true;
      li.append(text, b);
    } else {
      text.append(pill(label, tone));
      const primary = !nextMarked && tone !== 'good';
      if (primary) nextMarked = true;
      li.append(text, btn(primary ? 'button button-primary' : 'button', action, () => goToSection(item.section, { review })));
    }
    ol.append(li);
  });
  return ol;
}

function triedBefore(sectionId) {
  return finishedRecords(sectionId).length > 0 || (profile.summary.sectionAttempts?.[sectionId] || 0) > 0;
}

// Ask the server for the latest (e.g. the teacher just cleared a check).
async function refreshFromServer() {
  const res = await api.student('login', profile.code);
  if (res.error === 'unknown-code') return showLogin('Your code has changed. Ask your teacher for your new one. Your work is still saved on this device.');
  if (res.summary) {
    profile.summary = res.summary;
    profile.nickname = res.student.nickname;
    saveLocal(PROFILE_KEY, profile);
    loadDiagnostic();
  }
  route();
}

// ---------- practice for a check (the student's choice) ----------

// Any skill, any time, to get ready for the teacher's paper test. Skills with
// platform mastery (waiting for the paper check) come first.
function practiceCard() {
  const card = h('div', 'done-block practice-card');
  card.append(h('h2', 'block-title', 'Practice for a check'));
  card.append(h('p', 'path-note', `${masteryRules.default.practice.difficulties.length} problems like your teacher’s paper test, with hints. Practice never changes your progress.`));
  const resetAt = (skill) => profile.summary.resets?.[skill] || '';
  const mastered = (skill) => profile.summary.mastered?.includes(skill)
    || finishedRecords().some((r) => r.lesson === skill && r.provisionalMastery && String(r.finishedAt) > resetAt(skill));
  const ordered = [...lessons].sort((a, b) => Number(mastered(b.skill)) - Number(mastered(a.skill)));
  const ol = h('ol', 'path');
  for (const lesson of ordered) {
    const li = h('li', 'path-item');
    const text = h('div', 'path-text');
    text.append(h('span', 'path-title', lesson.title));
    if (mastered(lesson.skill)) text.append(pill('Ready for your teacher’s check', 'good'));
    const sets = finishedRecords(`practice:${lesson.skill}`).length;
    if (sets) text.append(h('span', 'path-note', `${sets} practice set${sets === 1 ? '' : 's'} done`));
    li.append(text, btn('button', loadProgress(`practice:${lesson.skill}`) ? 'Continue' : 'Practice', () => goToPractice(lesson.skill)));
    ol.append(li);
  }
  card.append(ol);
  return card;
}

function goToPractice(skill) {
  const lesson = lessons.find((l) => l.skill === skill);
  const id = `practice:${skill}`;
  openSection({
    app,
    lesson,
    sectionId: id,
    rules: masteryRules.default,
    curriculumVersion: graph.curriculumVersion,
    studentId: profile.id,
    nextAttempt: () => Math.max(profile.summary.practiceAttempts?.[skill] || 0, finishedRecords(id).length) + 1,
    onFinished: () => upload(),
    onExit: route,
    openFull: () => goToPractice(skill), // "Practice again"
  });
}

function goToSection(sectionId, { review = false } = {}) {
  const lesson = lessons.find((l) => l.sections.some((s) => s.id === sectionId));
  openSection({
    app,
    lesson,
    sectionId,
    rules: masteryRules.default,
    curriculumVersion: graph.curriculumVersion,
    studentId: profile.id,
    // The server counts attempts; this device may have finished some it hasn't uploaded yet.
    nextAttempt: (id) => Math.max(profile.summary.sectionAttempts?.[id] || 0, finishedRecords(id).length) + 1,
    onFinished: () => upload(),
    onExit: route,
    review,
    openFull: () => goToSection(sectionId, { review: false }),
  });
}

// ---------- preview only ----------

function previewSections() {
  const details = h('details', 'teacher');
  details.append(h('summary', 'teacher-summary', 'Teacher preview: open any lesson section'));
  details.open = previewOpen;
  details.addEventListener('toggle', () => { previewOpen = details.open; });
  const ol = h('ol', 'path');
  for (const lesson of lessons) {
    ol.append(h('li', 'path-group', lesson.title));
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
  return details;
}

function teacherView(result) {
  const details = h('details', 'teacher');
  details.append(h('summary', 'teacher-summary', 'Teacher view of this result (preview)'));
  details.append(diagnosticReport(result, { graph, misconceptions, times: session.times }));
  return details;
}

// ---------- helpers ----------

function swap(screen) {
  swapInto(app, screen);
}

// ---------- start ----------

// If anything goes wrong and the page is left empty, show a way out instead of a blank page.
window.addEventListener('error', (e) => crashed(e.error || e.message));
window.addEventListener('unhandledrejection', (e) => crashed(e.reason));

try {
  profile = loadLocal(PROFILE_KEY);
  if (!profile) {
    showLogin();
  } else {
    setStudent(profile.id);
    loadDiagnostic();
    route();
    upload().then(() => (outbox().length ? null : refreshFromServerQuietly()));
  }
} catch (e) {
  crashed(e);
}

function crashed(error) {
  console.error(error);
  if (app.querySelector('.screen')) return; // the student still has a working screen
  const detail = String(error?.stack || error?.message || error || 'unknown').split('\n').slice(0, 3).join(' | ');
  const screen = section('screen screen-start');
  screen.append(h('p', 'eyebrow', 'MathPath'), h('h1', 'title', 'Something went wrong'));
  screen.append(h('p', 'lede', api.preview
    ? 'This page couldn’t open the progress saved on this device. Starting fresh clears the pretend progress and opens the preview again.'
    : 'This page couldn’t open what was saved on this device. Try again first. If it still doesn’t work, start fresh: anything not uploaded yet is kept, and the rest comes back from your teacher’s records.'));
  const actions = h('div', 'actions');
  actions.append(
    btn('button button-primary', 'Try again', () => window.location.reload()),
    btn('button', 'Start fresh on this device', () => { startFresh(); window.location.reload(); }),
  );
  screen.append(actions, h('p', 'fine', `For your teacher: ${detail}`));
  swap(screen);
}

// Clear what this page saved in the browser. The real app keeps work waiting to upload.
function startFresh() {
  try {
    const keys = Object.keys(window.localStorage).filter((k) => k.startsWith('mathpath.'));
    for (const k of keys) if (api.preview || !k.endsWith('.outbox.v1')) window.localStorage.removeItem(k);
  } catch {
    // storage blocked: nothing saved to clear
  }
}

// On load: pick up anything the teacher changed, without moving the student off their screen.
async function refreshFromServerQuietly() {
  const res = await api.student('login', profile.code);
  if (res.error === 'unknown-code') return showLogin('Your code has changed. Ask your teacher for your new one. Your work is still saved on this device.');
  if (!res.summary) return;
  const changed = JSON.stringify(res.summary) !== JSON.stringify(profile.summary) || res.student.nickname !== profile.nickname;
  profile.summary = res.summary;
  profile.nickname = res.student.nickname;
  saveLocal(PROFILE_KEY, profile);
  if (changed && document.querySelector('.screen-done, .screen-start')) {
    loadDiagnostic();
    route();
  }
}

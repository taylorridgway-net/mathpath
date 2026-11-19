// The lesson screens: one lesson section, start to finish.
//
//   learn     the explanation (stacked fractions in the text) and the interactive, if any
//   example   a generated problem, solved one step at a time
//   practice  guided problems (hints available), then the check (or, for
//             "Putting it together", the mastery problems). All grading and
//             feedback rules live in engine/practice/practice.js; this file draws.
//   done      result, saved once for the whole section
//
// In "Putting it together", guided problems get one answer box per step
// (engine/practice/scaffold.js).
//
// PREVIEW: the seed is made in the browser. In the real app the server hands it
// out (student code + attempt number), so students can't reroll for easy problems.

import { generators, generateProblem } from '../../engine/generators/index.js';
import { startPractice } from '../../engine/practice/practice.js';
import { startScaffold, STEP_HINTS } from '../../engine/practice/scaffold.js';
import { solveAddSub } from '../../engine/solutions/frac-add-sub.js';
import { toText } from '../../engine/problem/text.js';
import { renderMath } from '../components/render-math.js';
import { renderLessonText } from '../components/lesson-text.js';
import { createFractionBars } from '../components/fraction-bars.js';
import { createKeypad } from '../components/keypad.js';
import { loadProgress, saveProgress, clearProgress, saveFinished, finishedRecords } from '../storage/sections.js';
import { h, section as screenEl, btn, swap, split } from '../components/dom.js';

const PHASE_NAMES = {
  guided: 'Practice with help',
  check: 'Check',
  mastery: 'Mastery check',
};

export function openSection({ app, lesson, sectionId, rules, curriculumVersion, baseSeed, onExit }) {
  const sec = lesson.sections.find((s) => s.id === sectionId);
  if (!sec) throw new Error(`No section "${sectionId}"`);

  let run = loadProgress(sectionId);
  if (!run) {
    const attemptNo = finishedRecords(sectionId).length + 1;
    run = {
      lesson: lesson.skill,
      section: sectionId,
      seed: `${baseSeed}:${sectionId}:${attemptNo}`,
      attemptNo,
      stage: 'learn',
      answers: [],
      times: [],
      scaffolds: {}, // practice problem index -> step answers
      hintsShown: [], // practice problem indexes where the student opened a hint
      startedAt: new Date().toISOString(),
    };
  }

  const setup = {
    generators,
    rules,
    seed: run.seed,
    plan: { generator: sec.generator, mode: sec.mode },
  };
  let practice;
  try {
    practice = startPractice(setup);
    for (const a of run.answers) practice.submit(a);
  } catch {
    // Saved answers don't fit the current problems (the app changed). Start this section's practice over.
    run.answers = [];
    run.times = [];
    run.scaffolds = {};
    run.hintsShown = [];
    practice = startPractice(setup);
  }

  let keypad = null;
  let shownAt = 0;
  let scaffold = null;
  let scaffoldIndex = -1;
  let scaffoldNote = null; // a one-time message for the next step (e.g. "filled in for you")

  const save = () => saveProgress(sectionId, run);
  save();

  if (run.stage === 'practice') showPractice();
  else if (run.stage === 'example') showExample();
  else showLearn();

  // ---------- shared pieces ----------

  function frame(stepName) {
    destroyKeypad();
    const screen = screenEl('screen screen-lesson');
    const top = h('div', 'lesson-top');
    top.append(btn('back-link', '← Your path', onExit), h('span', 'lesson-stage', stepName));
    screen.append(top);
    return screen;
  }

  function destroyKeypad() {
    keypad?.destroy();
    keypad = null;
  }

  function say(text, className = 'lesson-p') {
    return renderLessonText(text, { className, autoFractions: true });
  }

  function solutionSteps(problem, { stepByStep = false, onDone } = {}) {
    const steps = solveAddSub(problem);
    const listEl = h('ol', 'solution');
    let shown = stepByStep ? 1 : steps.length;
    const more = stepByStep ? btn('button', 'Next step', () => {
      shown++;
      draw();
    }) : null;
    function draw() {
      listEl.replaceChildren();
      steps.slice(0, shown).forEach((s) => {
        const li = h('li', 'solution-step');
        // The list numbers the steps already, so drop a leading "Step 2." from the sentence.
        li.append(say(s.say.replace(/^Step \d+\. /, ''), 'solution-say'));
        if (s.show) {
          const m = h('div', 'solution-math');
          m.append(renderMath(s.show));
          li.append(m);
        }
        listEl.append(li);
      });
      if (more) {
        more.hidden = shown >= steps.length;
        if (shown >= steps.length) onDone?.();
      }
      listEl.lastElementChild?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
    }
    draw();
    const wrap = h('div', 'solution-wrap');
    wrap.append(listEl);
    if (more) wrap.append(more);
    return wrap;
  }

  function problemCard(problem, { instruction = problem.instruction, expression = problem.expression } = {}) {
    const card = h('div', 'question-card');
    const ins = h('p', 'instruction', instruction);
    ins.id = 'instruction';
    const math = h('div', 'question-math');
    math.append(renderMath(expression));
    card.append(ins, math);
    return card;
  }

  // ---------- learn ----------

  function showLearn() {
    run.stage = 'learn';
    save();
    const screen = frame('Learn');
    const cols = split('even');
    const main = sec.visual ? cols.main : screen;
    main.append(h('p', 'eyebrow', sec.mode === 'skill' ? 'All the steps' : 'One step'));
    main.append(h('h1', 'title', sec.title));
    main.append(h('p', 'lede', sec.objective));
    const body = h('div', 'lesson-body');
    for (const p of sec.explain) body.append(say(p));
    main.append(body);

    if (sec.visual?.widget === 'fraction-bars') {
      const box = h('figure', 'visual');
      const cap = renderLessonText(sec.visual.caption, { tag: 'figcaption', className: 'visual-caption', autoFractions: true });
      box.append(cap);
      createFractionBars({ host: box, params: sec.visual.params });
      cols.side.append(box);
      screen.append(cols.el);
    }

    const actions = h('div', 'actions');
    actions.append(btn('button button-primary', 'See an example', showExample));
    main.append(actions);
    swap(app, screen);
  }

  // ---------- worked example ----------

  function showExample() {
    run.stage = 'example';
    save();
    const difficulty = sec.example?.difficulty ?? rules.guided.difficulty;
    const problem = generateProblem(sec.generator, `${run.seed}:example`, difficulty);
    const screen = frame('Example');
    const cols = split('even');
    cols.main.append(h('p', 'eyebrow', sec.title), h('h1', 'title', 'Watch one first'), problemCard(problem));
    const actions = h('div', 'actions');
    const go = btn('button button-primary', 'Try some with help', startPracticeStage);
    go.hidden = true;
    cols.side.append(solutionSteps(problem, { stepByStep: true, onDone: () => { go.hidden = false; } }));
    actions.append(btn('button', 'Back to the explanation', showLearn), go);
    cols.side.append(actions);
    screen.append(cols.el);
    swap(app, screen);
  }

  function startPracticeStage() {
    run.stage = 'practice';
    save();
    showPractice();
  }

  // ---------- practice ----------

  function showPractice() {
    const cur = practice.currentProblem();
    if (!cur) return showDone();

    const scaffolded = sec.mode === 'skill' && cur.phase === 'guided';
    if (scaffolded && scaffoldIndex !== cur.index) {
      scaffold = startScaffold(cur.problem);
      scaffoldIndex = cur.index;
      for (const a of run.scaffolds[cur.index] || []) scaffold.submit(a);
    }
    if (!scaffolded) scaffold = null;

    const screen = frame(PHASE_NAMES[cur.phase]);
    screen.append(progressBar(cur));

    if (scaffold) {
      drawScaffold(screen, cur);
    } else {
      const cols = split();
      cols.main.append(problemCard(cur.problem));
      cols.main.append(feedbackBox(cur.feedback, sec.generator, run.answers.at(-1)));
      if (cur.phase === 'guided') cols.main.append(hintToggle(cur.index, lesson.hints[sec.generator]));
      const answerHost = h('div', '');
      cols.side.append(answerHost);
      screen.append(cols.el);
      swap(app, screen);
      mountKeypad(answerHost, cur.problem.answer.type === 'fraction', (raw) => answerPractice(raw));
    }
  }

  function progressBar(cur) {
    const bar = h('div', 'progress');
    const done = practice.result().problems.filter((p) => p.phase === cur.phase && p.outcome);
    if (cur.phase === 'guided') {
      const right = done.filter((p) => p.outcome !== 'missed').length;
      bar.append(h('span', 'progress-text', `Problem ${done.length + 1} · ${right} of ${rules.guided.rightNeeded} solved`));
    } else if (cur.phase === 'check') {
      let streak = 0;
      for (let i = done.length - 1; i >= 0 && done[i].outcome === 'right-first'; i--) streak++;
      const need = rules.sectionCheck.rightInARow;
      bar.append(h('span', 'progress-text', `${need} right in a row to finish · no hints`));
      bar.append(dots(Array.from({ length: need }, (_, i) => (i < streak ? 'yes' : 'empty'))));
    } else {
      const window = rules.skill.window;
      const recent = done.slice(-window);
      const firstTry = recent.filter((p) => p.outcome === 'right-first');
      const hard = firstTry.filter((p) => p.difficulty >= rules.skill.hardestDifficulty).length;
      bar.append(h('span', 'progress-text',
        `Right on the first try: ${firstTry.length} of the last ${window} (need ${rules.skill.rightOnFirstTry}) · hardest level: ${hard} of ${rules.skill.minAtHardest}`));
      bar.append(dots(recent.map((p) => (p.outcome === 'right-first' ? (p.difficulty >= rules.skill.hardestDifficulty ? 'star' : 'yes') : 'no'))));
    }
    return bar;
  }

  function dots(kinds) {
    const row = h('span', 'dots');
    row.setAttribute('aria-hidden', 'true');
    for (const k of kinds) row.append(h('span', `dot dot-${k}`, k === 'star' ? '★' : ''));
    return row;
  }

  // Feedback from the last try, worded from the lesson file.
  function feedbackBox(feedback, generatorId, lastAnswer) {
    const box = h('div', 'feedback');
    box.setAttribute('aria-live', 'polite');
    if (!feedback) return box;
    let text;
    if (feedback.kind === 'simplify') text = lesson.simplifyHint;
    else if (feedback.kind === 'misconception') text = lesson.misconceptionMessages[feedback.id] || lesson.hints[generatorId];
    else if (feedback.kind === 'hint') text = lesson.hints[feedback.step ? STEP_HINTS[feedback.step] : generatorId];
    else text = feedback.text;
    box.classList.add(feedback.kind === 'simplify' ? 'feedback-near' : feedback.kind === 'info' ? 'feedback-info' : 'feedback-try');
    box.append(h('p', 'feedback-title', feedback.kind === 'simplify' ? 'Almost.' : feedback.kind === 'info' ? '' : 'Not yet. Try once more.'));
    box.append(say(text, 'feedback-text'));
    const shown = feedback.kind !== 'info' && answerExpression(lastAnswer);
    if (shown) {
      const yours = h('p', 'feedback-yours', 'You wrote ');
      yours.append(renderMath(shown, { inline: true }));
      box.append(yours);
    }
    return box;
  }

  function hintToggle(index, text) {
    const wrap = h('div', 'hint');
    const open = run.hintsShown.includes(index);
    const body = say(text, 'hint-text');
    body.hidden = !open;
    const b = btn('hint-button', open ? 'Hint' : 'Show a hint', () => {
      body.hidden = false;
      b.textContent = 'Hint';
      if (!run.hintsShown.includes(index)) {
        run.hintsShown.push(index);
        save();
      }
    });
    wrap.append(b, body);
    return wrap;
  }

  function mountKeypad(host, allowFractions, onSubmit) {
    keypad = createKeypad({ host, allowFractions, onSubmit, onSkip: () => onSubmit({}) });
    shownAt = performance.now();
  }

  // One answer to the practice session (a whole problem, or the final step of a scaffolded one).
  function answerPractice(raw) {
    const cur = practice.currentProblem();
    destroyKeypad();
    const response = practice.submit(raw);
    run.answers.push(raw);
    run.times.push(Math.round(performance.now() - shownAt));
    save();

    if (response.retry) return showPractice();
    if (response.outcome === 'missed') return showSolution(cur.problem);
    showRight(cur, response);
  }

  function showRight(cur, response) {
    const screen = frame(PHASE_NAMES[cur.phase]);
    screen.append(progressBar(cur));
    const cols = split();
    cols.main.append(problemCard(cur.problem));
    screen.append(cols.el);
    const box = h('div', 'feedback feedback-right');
    box.setAttribute('aria-live', 'polite');
    const title = h('p', 'feedback-title instruction', response.outcome === 'right-first' ? 'Right.' : 'Right on the second try.');
    box.append(title);
    cols.side.append(box);
    const actions = h('div', 'actions');
    const next = btn('button button-primary', practice.currentProblem() ? 'Next problem' : 'Finish', () => {
      document.removeEventListener('keydown', onEnter);
      showPractice();
    });
    actions.append(next);
    cols.side.append(actions);
    swap(app, screen, { focus: '.feedback-title' });
    // Enter goes on, as on the keypad. (Waits a moment so the Enter that submitted doesn't also skip this.)
    const onEnter = (e) => {
      if (e.key === 'Enter' && document.activeElement?.tagName !== 'BUTTON') {
        e.preventDefault();
        next.click();
      }
    };
    setTimeout(() => document.addEventListener('keydown', onEnter), 150);
  }

  function showSolution(problem) {
    const screen = frame('Worked solution');
    const cols = split('even');
    cols.main.append(h('p', 'eyebrow', sec.title), h('h1', 'title', 'Worked solution'));
    const more = practice.currentProblem();
    if (more) cols.main.append(say(lesson.similarProblemIntro, 'lede'));
    cols.main.append(problemCard(problem));
    cols.side.append(solutionSteps(problem));
    const actions = h('div', 'actions');
    actions.append(btn('button button-primary', more ? 'Try one like it' : 'Finish', showPractice));
    cols.side.append(actions);
    screen.append(cols.el);
    swap(app, screen);
  }

  // ---------- one box per step ("Putting it together", guided) ----------

  function drawScaffold(outer, cur) {
    const cols = split();
    outer.append(cols.el);
    const screen = cols.main;
    screen.append(problemCard(cur.problem));

    const steps = h('ol', 'steps');
    for (const s of scaffold.completed()) {
      const li = h('li', `step step-done${s.revealed ? ' step-revealed' : ''}`);
      li.append(renderLessonText(s.label, { tag: 'span', className: 'step-label', autoFractions: true }));
      const m = h('span', 'step-answer');
      m.append(renderMath(filledIn(s), { inline: true }));
      li.append(m);
      if (s.revealed) li.append(h('span', 'step-note', 'filled in for you'));
      steps.append(li);
    }
    const step = scaffold.current();
    const now = h('li', 'step step-now');
    now.append(renderLessonText(step.label, { tag: 'span', className: 'step-label', autoFractions: true }));
    steps.append(now);
    screen.append(steps);

    const stepCard = h('div', 'question-card step-card');
    const ins = h('p', 'instruction', step.instruction);
    ins.id = 'instruction';
    const math = h('div', 'question-math');
    math.append(renderMath(step.expression));
    stepCard.append(ins, math);
    screen.append(stepCard);

    if (step.isFinal) {
      screen.append(feedbackBox(cur.feedback, sec.generator, run.answers.at(-1)));
    } else {
      screen.append(feedbackBox(step.feedback || scaffoldNote, sec.generator, (run.scaffolds[cur.index] || []).at(-1)));
    }
    scaffoldNote = null;
    screen.append(hintToggle(cur.index, lesson.hints[STEP_HINTS[step.id]]));

    const answerHost = h('div', '');
    cols.side.append(answerHost);
    swap(app, outer);
    if (step.isFinal) {
      mountKeypad(answerHost, true, (raw) => answerPractice(raw));
    } else {
      mountKeypad(answerHost, false, (raw) => answerStep(raw));
    }
  }

  function answerStep(raw) {
    const cur = practice.currentProblem();
    const step = scaffold.current();
    destroyKeypad();
    const r = scaffold.submit(raw);
    (run.scaffolds[cur.index] ||= []).push(raw);
    save();
    if (r.revealed !== undefined) {
      scaffoldNote = { kind: 'info', text: `Step ${step.index + 1} is filled in for you: ${toText(filledIn({ ...step, value: r.revealed }))}. Keep going.` };
    } else if (r.note === 'not-least') {
      scaffoldNote = { kind: 'info', text: `That works. ${step.answer.least} also works and keeps the numbers smaller.` };
    }
    showPractice();
  }

  // ---------- done ----------

  function showDone() {
    const result = practice.result();
    const record = {
      type: 'lesson-section',
      lesson: lesson.skill,
      section: sectionId,
      gap: sec.forGap,
      generator: sec.generator,
      mode: sec.mode,
      seed: run.seed,
      attemptNo: run.attemptNo,
      curriculumVersion,
      startedAt: run.startedAt,
      finishedAt: new Date().toISOString(),
      answers: run.answers,
      times: run.times,
      scaffolds: run.scaffolds,
      hintsShown: run.hintsShown,
      endedBy: result.endedBy,
      passed: result.passed,
      provisionalMastery: result.provisionalMastery,
      problems: result.problems,
    };
    if (run.stage !== 'done') {
      saveFinished(record);
      clearProgress(sectionId);
      run.stage = 'done';
    }

    const screen = frame('Done');
    const firstTry = result.problems.filter((p) => p.outcome === 'right-first').length;
    if (result.provisionalMastery) {
      screen.append(h('p', 'eyebrow', sec.title), h('h1', 'title', 'You showed you can do the whole thing'));
      screen.append(h('p', 'lede', 'This counts as platform mastery for now. Your teacher will check it with a short problem set on paper.'));
    } else if (result.passed) {
      screen.append(h('p', 'eyebrow', sec.title), h('h1', 'title', 'Section done'));
      screen.append(h('p', 'lede', `${rules.sectionCheck.rightInARow} right in a row. This step is ready to use in whole problems.`));
    } else {
      screen.append(h('p', 'eyebrow', sec.title), h('h1', 'title', 'Let’s stop here for now'));
      screen.append(h('p', 'lede', 'That was a lot of problems. Your teacher will see which ones were tricky. You can come back to this section later.'));
    }
    screen.append(h('p', 'fine', `${result.problemCount} problems · ${firstTry} right on the first try`));
    const actions = h('div', 'actions');
    actions.append(btn('button button-primary', 'Back to your path', onExit));
    screen.append(actions);
    swap(app, screen);
  }
}

// A keypad answer as an expression to draw ("You wrote 6/8"), or null if blank.
function answerExpression(raw) {
  if (!raw || (raw.whole === undefined && raw.num === undefined)) return null;
  if (raw.num === undefined) return { type: 'int', value: raw.whole };
  if (raw.whole === undefined) return { type: 'frac', n: raw.num, d: raw.den };
  return { type: 'mixed', whole: raw.whole, n: raw.num, d: raw.den };
}

// A finished step, drawn with the student's (or revealed) value in the blank.
function filledIn(step) {
  const fill = (node) => {
    if (!node || typeof node !== 'object') return node;
    if (node.type === 'blank') return { type: 'int', value: step.value };
    const out = { ...node };
    for (const k of ['left', 'right', 'n', 'd']) if (out[k] && typeof out[k] === 'object') out[k] = fill(out[k]);
    return out;
  };
  if (step.id === 'common-denom') return { type: 'int', value: step.value };
  return fill(step.expression);
}

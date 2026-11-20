// The teacher's view of one diagnostic result: every skill and subskill with
// its verdict, wrong-answer patterns seen, and every question re-created from
// its seed (the same way the server will check it). Used under the student
// preview and in the dashboard's student profile.

import { generateProblem } from '../../engine/generators/index.js';
import { toText } from '../../engine/problem/text.js';
import { rawToText } from './answer-editor.js';
import { h, pill, list } from './dom.js';

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

export function diagnosticReport(result, { graph, misconceptions, times = [] }) {
  const details = h('div', 'diagnostic-report');

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
      if (r.slow) label = 'Shaky: right, but slow (over 5 s)';
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
      h('span', 'num', `${Math.round((times[i] || 0) / 1000)}s`),
    );
    log.append(row);
  });
  const scroller = h('div', 'log-scroll');
  scroller.append(log);
  details.append(scroller);
  details.append(h('p', 'fine', `Seed ${result.seed} · ${result.questionCount} questions · curriculum ${result.curriculumVersion}`));
  return details;
}


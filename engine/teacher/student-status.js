// What the dashboard knows about one student, worked out from their saved
// records. Pure logic (tested in Node); the dashboard screens only draw it.
//
// Records (what the student app and the teacher save):
//   diagnosticResult  the diagnostic's result (re-created from seed + answers)
//   sections          finished lesson-section records (web/storage/sections.js)
//   verifications     teacher paper-test results: { skillId, decision, at, ... }
//   cleared           foundation ids the teacher has checked off
//
// Mastery is always worked out from records, never typed in:
//   platform (provisional)  a "Putting it together" record with provisionalMastery
//   verified                the latest paper-test verification says "verified"
// The two are kept separate everywhere (CLAUDE.md, "Assessment integrity").

import { buildPath } from '../lessons/path.js';

// Cell statuses, best first. The dashboard colours and labels these.
export const STATUSES = [
  'verified', // teacher verified on paper
  'platform', // provisional platform mastery
  'practised', // (subskill) section check passed
  'working', // on the path, started
  'gap', // diagnostic: missed twice
  'shaky', // diagnostic: one miss, then right
  'known', // diagnostic: answered right
  'credited', // diagnostic: credited because something harder was right
  'partly', // diagnostic: some subskills right, others not asked
  'blocked', // diagnostic: couldn't check because it needs another gap first
  'unchecked', // diagnostic: possible cause, no questions for it yet
  'not-tested',
];

const FROM_DIAGNOSTIC = {
  known: 'known',
  'known-inferred': 'credited',
  gap: 'gap',
  shaky: 'shaky',
  unchecked: 'unchecked',
  'not-tested': 'not-tested',
  'partly-known': 'partly',
};

// resets: [{ skillId, at }] when the teacher sent the student back to redo a skill.
export function studentStatus({ diagnosticResult: result, sections = [], verifications = [], cleared = [], resets = [], graph, lessons, waitForTeacher = false }) {
  const sectionOf = new Map(lessons.flatMap((l) => l.sections.map((s) => [s.id, { ...s, lesson: l.skill }])));
  const byTime = (a, b) => String(a.at ?? a.finishedAt).localeCompare(String(b.at ?? b.finishedAt));
  // After a reset, that skill's "Putting it together" and paper tests from before don't count.
  const resetAt = {};
  for (const r of resets) if (!resetAt[r.skillId] || r.at > resetAt[r.skillId]) resetAt[r.skillId] = r.at;
  const wholeSections = new Set(lessons.flatMap((l) => l.sections.filter((s) => s.mode === 'skill').map((s) => s.id)));
  const stillCounts = (r) => !(wholeSections.has(r.section) && resetAt[r.lesson] && String(r.finishedAt) <= resetAt[r.lesson]);
  const records = [...sections].filter(stillCounts).sort(byTime);

  // ---- mastery per skill ----
  const latestVerification = {};
  for (const v of [...verifications].sort(byTime)) {
    if (!(resetAt[v.skillId] && String(v.at) <= resetAt[v.skillId])) latestVerification[v.skillId] = v;
  }
  const platformAt = {};
  for (const r of records) if (r.provisionalMastery && !platformAt[r.lesson]) platformAt[r.lesson] = r.finishedAt;

  // ---- path with progress ----
  const path = result ? buildPath({ result, lessons, graph, cleared, waitForTeacher }) : [];
  const sectionProgress = (id) => {
    const mine = records.filter((r) => r.section === id);
    if (mine.some((r) => r.passed)) return 'done';
    return mine.length ? 'tried' : 'not-started';
  };
  const pathWithProgress = path.map((item) => (item.kind === 'section'
    ? { ...item, progress: sectionProgress(item.section) }
    : { ...item, progress: item.cleared ? 'done' : 'not-started' }));
  const next = pathWithProgress.find((item) => item.progress !== 'done') || null;

  // ---- skill and subskill cells ----
  const touched = new Set(records.map((r) => r.lesson));
  const skillStatus = (skillId) => {
    if (latestVerification[skillId]?.decision === 'verified') return 'verified';
    if (platformAt[skillId]) return 'platform';
    const diag = result?.skills?.[skillId];
    if (diag === 'gap' && touched.has(skillId)) return 'working';
    return FROM_DIAGNOSTIC[diag] ?? 'not-tested';
  };
  const subskillStatus = (id) => {
    const skillId = graph.get(id).skillId;
    const whole = skillStatus(skillId);
    if (whole === 'verified' || whole === 'platform') return whole;
    const section = [...sectionOf.values()].find((s) => s.forGap === id);
    if (section) {
      const p = sectionProgress(section.id);
      if (p === 'done') return 'practised';
      if (p === 'tried') return 'working';
    }
    const node = result?.nodes?.[id];
    if (node?.blockedBy) return 'blocked';
    return FROM_DIAGNOSTIC[node?.status] ?? 'not-tested';
  };

  const skills = {};
  const subskills = {};
  for (const [id, node] of graph.nodes) {
    if (node.kind === 'skill') skills[id] = skillStatus(id);
    else subskills[id] = subskillStatus(id);
  }

  return {
    diagnosed: Boolean(result),
    skills,
    subskills,
    platformAt,
    resetAt,
    verification: latestVerification,
    path: pathWithProgress,
    next,
    waiting: pathWithProgress.some((i) => i.kind === 'section' && i.waiting && i.progress !== 'done'),
    // Foundations the teacher still needs to check with this student ("with your teacher first").
    openChecks: pathWithProgress.filter((i) => i.kind !== 'section' && !i.cleared).map((i) => i.gap),
  };
}

// Counts per status for one column of the heatmap: { verified: 3, gap: 7, ... }
export function countStatuses(statusList) {
  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  for (const s of statusList) counts[s] = (counts[s] || 0) + 1;
  return counts;
}

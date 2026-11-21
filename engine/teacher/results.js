// Results: is MathPath working? Worked out from the saved records only (pure logic,
// tested in Node; the dashboard's Results tab draws it). Kept apart from participation
// (CLAUDE.md: skill gains, verification and usage are tracked separately).
//
// students: [{ code, result, sections, verifications, memory, status }] as the dashboard
// builds them (status: engine/teacher/student-status.js). lessons: the lesson files.
//
//   gaps          skills the diagnostic found as gaps, and how many are now mastered
//   paper         paper tests after platform mastery: how often platform mastery held up,
//                 and how often the teacher's decision matched the 5-of-6 suggestion
//   overFlagged   gap steps a student then got right on every practice problem, first try
//                 (a sign the check flagged something they could already do)
//   bySkill       per skill: gaps found, platform mastery, verified, and the time to platform
//                 mastery (median days, practice problems and minutes from first starting it)
//   memory        memory checks taken, held up, and skills slipping or kept

const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const DAY = 24 * 60 * 60 * 1000;
const MASTERED = new Set(['platform', 'verified', 'slipping']);

export function classResults(students, { lessons }) {
  const skillOfSection = new Map(lessons.flatMap((l) => l.sections.map((s) => [s.id, { lesson: l.skill, mode: s.mode, forGap: s.forGap }])));
  const bySkill = new Map(lessons.map((l) => [l.skill, { skill: l.skill, gapped: 0, mastered: 0, verified: 0, days: [], problems: [], minutes: [] }]));
  const gaps = { found: 0, mastered: 0, verified: 0, students: 0 };
  const paper = { tests: 0, confirmed: 0, notYet: 0, agreed: 0 };
  const overFlagged = { started: 0, perfect: 0 };
  const memory = { taken: 0, held: 0, slipping: 0, kept: 0 };

  for (const st of students) {
    const skills = st.status?.skills || {};
    // ---- gaps found by the diagnostic, and where they are now ----
    const gapSkills = Object.entries(st.result?.skills || {}).filter(([id, v]) => v === 'gap' && bySkill.has(id)).map(([id]) => id);
    if (gapSkills.length) gaps.students += 1;
    for (const id of gapSkills) {
      gaps.found += 1;
      bySkill.get(id).gapped += 1;
      if (MASTERED.has(skills[id])) gaps.mastered += 1;
      if (skills[id] === 'verified') gaps.verified += 1;
    }
    for (const [id, row] of bySkill) {
      if (MASTERED.has(skills[id])) row.mastered += 1;
      if (skills[id] === 'verified') row.verified += 1;
    }

    // ---- time to platform mastery, per skill ----
    const records = [...(st.sections || [])].sort((a, b) => String(a.finishedAt).localeCompare(String(b.finishedAt)));
    for (const [skill, at] of Object.entries(st.status?.platformAt || {})) {
      const row = bySkill.get(skill);
      if (!row) continue;
      const mine = records.filter((r) => skillOfSection.get(r.section)?.lesson === skill && String(r.finishedAt) <= String(at));
      if (!mine.length) continue;
      const start = Date.parse(mine[0].startedAt || mine[0].finishedAt);
      row.days.push(Math.max(0, (Date.parse(at) - start) / DAY));
      row.problems.push(mine.reduce((n, r) => n + (r.problemCount || 0), 0));
      row.minutes.push(mine.reduce((n, r) => n + (r.seconds || 0), 0) / 60);
    }

    // ---- gap steps aced from the start ----
    const gapSteps = new Set(Object.entries(st.result?.nodes || {}).filter(([, n]) => n.status === 'gap').map(([id]) => id));
    const firstTry = new Map();
    for (const r of records) {
      const sec = skillOfSection.get(r.section);
      if (!sec || sec.mode !== 'section' || r.review || !gapSteps.has(sec.forGap) || firstTry.has(r.section)) continue;
      firstTry.set(r.section, r);
    }
    for (const r of firstTry.values()) {
      overFlagged.started += 1;
      if (r.passed && r.problemCount > 0 && r.firstTry === r.problemCount) overFlagged.perfect += 1;
    }

    // ---- paper tests taken after platform mastery ----
    for (const v of st.verifications || []) {
      const at = st.status?.platformAt?.[v.skillId];
      if (!at || String(v.at) < String(at)) continue;
      paper.tests += 1;
      if (v.decision === 'verified') paper.confirmed += 1;
      else paper.notYet += 1;
      if (v.decision === v.suggested) paper.agreed += 1;
    }

    // ---- memory checks ----
    for (const m of st.memory || []) {
      memory.taken += 1;
      if (m.held) memory.held += 1;
    }
    for (const state of Object.values(st.status?.memory || {})) {
      if (state.status === 'slipping') memory.slipping += 1;
      if (state.status === 'kept') memory.kept += 1;
    }
  }

  const rows = [...bySkill.values()]
    .filter((r) => r.gapped || r.mastered || r.days.length)
    .map(({ days, problems, minutes, ...r }) => ({
      ...r,
      reached: days.length,
      medianDays: median(days),
      medianProblems: median(problems),
      medianMinutes: median(minutes),
    }));
  return { students: students.length, gaps, paper, overFlagged, memory, bySkill: rows };
}

// "18 of 22 (82%)"
export function share(n, of) {
  return of ? `${n} of ${of} (${Math.round((100 * n) / of)}%)` : '—';
}

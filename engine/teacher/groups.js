// "Teach together": students who need the same thing right now, so the
// teacher can pull a small group. Pure logic (tested in Node).
//
// Two kinds of group:
//   next          the same next step on their path (a section, or a foundation
//                 the teacher needs to check, like multiplication facts)
//   misconception the same wrong-answer pattern seen recently (diagnostic or
//                 practice), e.g. "adds across: 1/2 + 1/3 = 2/5". A pattern stops
//                 counting once that skill has platform or verified mastery.
//
// students: [{ code, status (from studentStatus), diagnostic: {finishedAt, result},
//              sections: [records] }]

const DAY = 24 * 60 * 60 * 1000;

export function teachTogether(students, { misconceptions, now, windowDays = 14, minSize = 2 }) {
  const pointsTo = new Map(misconceptions.map((m) => [m.id, m.pointsTo]));
  const since = new Date(now).getTime() - windowDays * DAY;
  const next = new Map();
  const patterns = new Map();
  const add = (map, key, info, code) => {
    if (!map.has(key)) map.set(key, { ...info, students: [] });
    const g = map.get(key);
    if (!g.students.includes(code)) g.students.push(code);
  };

  for (const s of students) {
    // Every uncleared foundation is its own group; otherwise the next section.
    const foundations = s.status.path.filter((i) => i.kind !== 'section' && !i.cleared);
    for (const f of foundations) add(next, `check:${f.gap}`, { kind: 'next', target: f.gap, title: `Check first: ${f.name}`, foundation: true }, s.code);
    if (!foundations.length && s.status.next?.kind === 'section') {
      add(next, `section:${s.status.next.section}`, { kind: 'next', target: s.status.next.section, title: s.status.next.title }, s.code);
    }

    for (const id of recentMisconceptions(s, since)) {
      const skillId = pointsTo.get(id)?.split('.').slice(0, 2).join('.');
      const st = s.status.skills[skillId];
      if (st === 'platform' || st === 'verified') continue;
      add(patterns, id, { kind: 'misconception', target: id }, s.code);
    }
  }

  const bySize = (a, b) => b.students.length - a.students.length;
  return {
    next: [...next.values()].filter((g) => g.students.length >= minSize).sort(bySize),
    misconceptions: [...patterns.values()].filter((g) => g.students.length >= minSize).sort(bySize),
  };
}

// Misconception ids this student showed since `since` (ms).
export function recentMisconceptions(student, since) {
  const seen = new Set();
  const d = student.diagnostic;
  if (d && new Date(d.finishedAt).getTime() >= since) {
    for (const id of Object.keys(d.result?.misconceptions || {})) seen.add(id);
  }
  for (const r of student.sections || []) {
    if (new Date(r.finishedAt).getTime() < since) continue;
    if (r.misconceptions) for (const id of r.misconceptions) seen.add(id);
    else for (const p of r.problems || []) for (const a of p.attempts || []) if (a.misconception) seen.add(a.misconception);
  }
  return [...seen];
}

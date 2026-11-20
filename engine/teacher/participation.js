// Participation, kept separate from proficiency (CLAUDE.md): it rewards
// showing up and working, not being right or fast. No rankings.
// Pure logic (tested in Node).
//
// Counts only what the server receives: the diagnostic and finished sections.
// `hasWork`: false when the student has nothing left to do (path finished, or
// waiting for the teacher); they're never flagged as below expectation then.

const DAY = 24 * 60 * 60 * 1000;

// practice: practice-for-a-check sets (the student's choice). They count as activity
// (days, minutes) and are reported on their own; they don't count toward expectedSections.
export function participation({ diagnostic, sections = [], practice = [], memory = [], hasWork = true }, { now, windowDays = 7, expectedSections = 3 }) {
  const end = new Date(now).getTime();
  const start = end - windowDays * DAY;
  const events = [];
  if (diagnostic) events.push({ at: diagnostic.finishedAt, ms: sum(diagnostic.times), section: false });
  for (const r of sections) events.push({ at: r.finishedAt, ms: r.seconds !== undefined ? r.seconds * 1000 : sum(r.times), section: true });
  for (const r of practice) events.push({ at: r.finishedAt, ms: r.seconds !== undefined ? r.seconds * 1000 : sum(r.times), practice: true });
  // Memory checks count as activity, like everything else (whether they held up or not).
  for (const r of memory) events.push({ at: r.finishedAt, ms: r.seconds !== undefined ? r.seconds * 1000 : sum(r.times), memory: true });

  const inWindow = events.filter((e) => {
    const t = new Date(e.at).getTime();
    return t >= start && t <= end;
  });
  const days = new Set(inWindow.map((e) => String(e.at).slice(0, 10)));
  const sorted = events.map((e) => e.at).sort();
  const last = sorted[sorted.length - 1] || null;
  const sectionsFinished = inWindow.filter((e) => e.section).length;
  return {
    daysActive: days.size,
    sectionsFinished,
    practiceSets: inWindow.filter((e) => e.practice).length,
    memoryChecks: inWindow.filter((e) => e.memory).length,
    minutes: Math.round(inWindow.reduce((n, e) => n + e.ms, 0) / 60000),
    lastActive: last,
    daysSinceActive: last ? Math.floor((end - new Date(last).getTime()) / DAY) : null,
    belowExpectation: hasWork && sectionsFinished < expectedSections,
    inactive: !last || end - new Date(last).getTime() > windowDays * DAY,
  };
}

function sum(list = []) {
  return list.reduce((n, x) => n + (x || 0), 0);
}

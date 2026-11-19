// A student's learning path, from their diagnostic result and the lesson files.
// Pure logic: the browser uses it to show the path, the server can use it to
// check which sections a student was given.
//
// Rules:
//   - Foundations first: root gaps that have no lesson yet (e.g. multiplication
//     facts) come first, flagged "not built yet", so the teacher can step in.
//   - Then, for each lesson, the sections whose subskill the diagnostic marked as
//     a gap, in the lesson's own order (common denominator before rewriting, ...).
//   - "Putting it together" (the whole-skill section) is added whenever any of
//     that lesson's sections is on the path, or the whole skill itself is a gap.
//     It's the one that gives provisional platform mastery.
//   - Only "gap" counts. "Shaky" (one miss, then right) doesn't put a section on
//     the path; the teacher can still assign it.

export function buildPath({ result, lessons, graph }) {
  const status = (id) => result.nodes[id]?.status;
  const items = [];
  const taught = new Set(lessons.flatMap((l) => l.sections.map((s) => s.forGap)));

  // A root gap is "taught" if a lesson section is for it, or (for a skill) for one of its subskills.
  const hasLesson = (id) => taught.has(id) || graph.subskillsOf?.(id)?.some((s) => taught.has(s));
  for (const id of result.rootGaps) {
    if (!hasLesson(id)) items.push({ kind: 'not-built', gap: id, name: graph.get(id).name });
  }

  for (const lesson of lessons) {
    const parts = lesson.sections.filter((s) => s.mode === 'section' && status(s.forGap) === 'gap');
    const whole = lesson.sections.find((s) => s.mode === 'skill');
    const wholeNeeded = parts.length > 0 || status(lesson.skill) === 'gap';
    for (const s of parts) items.push(sectionItem(lesson, s));
    if (whole && wholeNeeded) items.push(sectionItem(lesson, whole));
  }
  return items;
}

function sectionItem(lesson, section) {
  return { kind: 'section', lesson: lesson.skill, section: section.id, gap: section.forGap, title: section.title };
}

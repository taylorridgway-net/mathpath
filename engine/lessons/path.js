// A student's learning path, from their diagnostic result and the lesson files.
// Pure logic: the browser uses it to show the path, the server can use it to
// check which sections a student was given.
//
// Foundations first. The order is:
//   1. Foundations with no lesson yet, flagged for the teacher:
//        "not-built"  a confirmed gap (missed twice) the app can't teach yet
//        "unchecked"  a possible cause the diagnostic followed a gap down to but
//                     has no questions for yet (e.g. multiplication facts under a
//                     common-denominator gap). The teacher should check it first.
//      Deeper foundations come first (multiplication facts before factors).
//   2. Lesson sections for "gap" subskills. Lessons are ordered by the skill
//      graph, so a skill comes after the skills it depends on; inside a lesson,
//      sections keep the lesson's own order.
//   3. Each lesson's "Putting it together" (the whole-skill section), added
//      whenever any of that lesson's sections is on the path, or the whole skill
//      itself is a gap. It's the one that gives provisional platform mastery.
// waitForTeacher (curriculum/mastery.json "paths"): if true, a section is marked
// `waiting` while a foundation it builds on (through its essential prerequisites)
// hasn't been cleared by the teacher. Owner decision 2026-11-20: false. Students
// move on; the foundation stays on the path as a flag for the teacher.
// `cleared` lists the foundation ids the teacher has checked off for this student.
//
// "Gap" puts the full section on the path. "Shaky" (one miss, then right) puts a
// quick review of that section on the path instead (owner decision 2026-11-20):
// straight to the check; a miss there sends the student through the full section.
// Shaky alone doesn't add "Putting it together".
//
// As lessons for foundation skills get built, "not-built" and "unchecked" items
// turn into real sections automatically, in the right order.
//
// The teacher's changes (engine/teacher/assignments.js): `assigned` lessons or steps
// come right after the foundations, marked assigned (the teacher decides the order);
// `skipped` ones are left off.

import { sectionsOf } from '../teacher/assignments.js';

export function buildPath({ result, lessons, graph, cleared = [], waitForTeacher = false, assigned = [], skipped = [] }) {
  const status = (id) => result.nodes[id]?.status;
  const taughtGaps = new Set(lessons.flatMap((l) => l.sections.map((s) => s.forGap)));
  const hasLesson = (id) => taughtGaps.has(id) || graph.subskillsOf(id).some((s) => taughtGaps.has(s));
  const depth = depthFinder(graph);

  const foundations = [
    ...result.rootGaps.filter((id) => !hasLesson(id)).map((id) => ({ kind: 'not-built', gap: id })),
    ...(result.uncheckedCauses || []).filter((id) => !hasLesson(id)).map((id) => ({ kind: 'unchecked', gap: id })),
  ]
    .map((item) => ({ ...item, name: graph.get(item.gap).name, cleared: cleared.includes(item.gap) }))
    .sort((a, b) => depth(a.gap) - depth(b.gap));

  const items = [...foundations];
  for (const lesson of [...lessons].sort((a, b) => depth(a.skill) - depth(b.skill))) {
    const parts = lesson.sections.filter((s) => s.mode === 'section' && ['gap', 'shaky'].includes(status(s.forGap)));
    const whole = lesson.sections.find((s) => s.mode === 'skill');
    const wholeNeeded = parts.some((s) => status(s.forGap) === 'gap') || status(lesson.skill) === 'gap';
    for (const s of parts) items.push({ ...sectionItem(lesson, s), review: status(s.forGap) === 'shaky' });
    if (whole && wholeNeeded) items.push(sectionItem(lesson, whole));
  }
  // The teacher's changes.
  const off = new Set(skipped.flatMap((i) => sectionsOf(i, lessons)));
  const fromTeacher = [];
  for (const a of assigned) {
    const lesson = lessons.find((l) => l.skill === a.lesson);
    for (const id of sectionsOf(a, lessons)) {
      if (fromTeacher.some((x) => x.section === id)) continue;
      fromTeacher.push({ ...sectionItem(lesson, lesson.sections.find((s) => s.id === id)), assigned: true });
    }
  }
  const mine = new Set(fromTeacher.map((x) => x.section));
  const proposed = items.filter((i) => i.kind !== 'section' || (!off.has(i.section) && !mine.has(i.section)));
  const all = [...proposed.filter((i) => i.kind !== 'section'), ...fromTeacher, ...proposed.filter((i) => i.kind === 'section')];

  const builtOn = dependsOn(graph);
  const open = foundations.filter((f) => !f.cleared);
  return all.map((item) => (item.kind === 'section'
    ? { ...item, lessonTitle: lessons.find((l) => l.skill === item.lesson).title, waiting: waitForTeacher && open.some((f) => builtOn(item.gap, f.gap)) }
    : item));
}

// builtOn(a, b): does a need b, directly or further down (essential links only)?
// A skill counts as needed if a needs the skill or any of its subskills.
function dependsOn(graph) {
  const memo = new Map();
  const needs = (id) => {
    if (memo.has(id)) return memo.get(id);
    memo.set(id, new Set()); // guards against loops
    const out = new Set();
    for (const p of graph.essentialPrereqs(id)) {
      out.add(p);
      out.add(graph.get(p).skillId);
      for (const q of needs(p)) out.add(q);
    }
    // A whole skill needs whatever its subskills need.
    if (graph.get(id).kind === 'skill') for (const sub of graph.subskillsOf(id)) for (const q of needs(sub)) out.add(q);
    memo.set(id, out);
    return out;
  };
  return (a, b) => {
    const n = needs(a);
    return n.has(b) || graph.subskillsOf(b).some((sub) => n.has(sub));
  };
}

function sectionItem(lesson, section) {
  return { kind: 'section', lesson: lesson.skill, section: section.id, gap: section.forGap, title: section.title, review: false };
}

// How far down the essential-prerequisite chain a skill or subskill sits:
// 0 = needs nothing; otherwise 1 + the deepest thing it needs. A subskill also
// needs whatever its whole skill needs.
function depthFinder(graph) {
  const memo = new Map();
  return function depth(id) {
    if (memo.has(id)) return memo.get(id);
    memo.set(id, 0); // guards against loops (the graph checker forbids them)
    const node = graph.get(id);
    const needs = [...graph.essentialPrereqs(id), ...(node.kind === 'skill' ? subskillNeeds(graph, id) : [])];
    const d = needs.length ? 1 + Math.max(...needs.map(depth)) : 0;
    memo.set(id, d);
    return d;
  };
}

// A skill also depends on whatever its subskills depend on (outside the skill itself).
function subskillNeeds(graph, skillId) {
  return graph.subskillsOf(skillId)
    .flatMap((s) => graph.essentialPrereqs(s))
    .filter((p) => p !== skillId && graph.get(p).skillId !== skillId);
}

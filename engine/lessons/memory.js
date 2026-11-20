// Memory checks (the brief's "retention check"): does a skill stick after the
// student reaches platform mastery? Pure logic, shared by the student's browser
// (what to offer), the server (is this check really due?) and the dashboard.
//
// Rules (curriculum/mastery.json "retention"; Claude's defaults 2026-11-20, owner may change):
//   - The first memory check is due `afterDays[0]` days after platform mastery;
//     each one after that `afterDays[k]` days after the one before was passed.
//     After the last one the skill counts as "kept".
//   - A check is a few whole problems (`difficulties`), one try each (an
//     unsimplified answer gets the usual "simplify" retry), no hints. It's passed
//     ("held up") at `holdAt` right on the first try.
//   - Missed ("slipping"): the student gets a refresher, "Putting it together"
//     again but straight to the whole problems. Platform mastery from the
//     refresher starts the schedule again. Verified mastery is never taken away
//     automatically: the teacher sees the slip and decides.
//
// events: what happened to this skill since the teacher last reset it, any order:
//   { type: 'mastered', at }            a "Putting it together" with platform mastery
//   { type: 'check', at, held }         a memory check

const DAY = 24 * 60 * 60 * 1000;

// -> { status, stage, dueAt, lastAt }
//   status: 'none' (not mastered) | 'waiting' (next check not due yet) | 'due'
//           | 'slipping' (last check missed; refresher next) | 'kept' (every check passed)
//   stage:  memory checks passed since the latest mastery
export function memoryState(events, rule, now) {
  const sorted = [...events].sort((a, b) => String(a.at).localeCompare(String(b.at)));
  let mastered = false;
  let stage = 0;
  let slipping = false;
  let lastAt = null;
  for (const e of sorted) {
    if (e.type === 'mastered') {
      // The first mastery starts the schedule; later ones only restart it after a slip.
      if (!mastered || slipping) {
        mastered = true;
        slipping = false;
        stage = 0;
        lastAt = e.at;
      }
    } else if (e.type === 'check' && mastered && !slipping) {
      lastAt = e.at;
      if (e.held) stage++;
      else slipping = true;
    }
  }
  if (!mastered) return { status: 'none', stage: 0, dueAt: null, lastAt: null };
  if (slipping) return { status: 'slipping', stage, dueAt: null, lastAt };
  if (stage >= rule.afterDays.length) return { status: 'kept', stage, dueAt: null, lastAt };
  const dueAt = new Date(new Date(lastAt).getTime() + rule.afterDays[stage] * DAY).toISOString();
  return { status: String(now) >= dueAt ? 'due' : 'waiting', stage, dueAt, lastAt };
}

// Did a finished memory check hold up? result: the practice session's result().
export function memoryHeld(result, rule) {
  const right = result.problems.filter((p) => p.outcome === 'right-first').length;
  return right >= rule.holdAt;
}

// The memory events for one skill from saved records (the dashboard and the browser):
//   sections: finished "Putting it together" records { lesson, provisionalMastery, finishedAt }
//   checks:   memory-check records { skillId, held, finishedAt }
//   resetAt:  when the teacher last sent the student back to redo this skill (or null)
export function memoryEvents(skillId, { sections = [], checks = [], resetAt = null }) {
  const after = (r) => !resetAt || String(r.finishedAt) > resetAt;
  return [
    ...sections.filter((r) => r.lesson === skillId && r.provisionalMastery && after(r)).map((r) => ({ type: 'mastered', at: r.finishedAt })),
    ...checks.filter((r) => r.skillId === skillId && after(r)).map((r) => ({ type: 'check', at: r.finishedAt, held: Boolean(r.held) })),
  ];
}

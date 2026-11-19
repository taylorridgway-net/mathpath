// Lesson-section progress, saved in this browser.
//
//   in progress  one entry per section: the seed and answers so far. Because a
//                practice session is fully determined by (seed, answers), this is
//                all that's needed to put the student back where they were.
//   finished     one record per finished attempt: seed, every answer, timing,
//                attempts, curriculum version. This is the "one save per section".
//   outbox       finished records not yet sent to the server. (Preview: there is
//                no server yet, so they wait here. The Apps Script step will send
//                them and retry on the next load if the connection drops.)

import { loadLocal, saveLocal, removeLocal } from './local.js';

const PROGRESS = 'mathpath.preview.section-progress.v1';
const FINISHED = 'mathpath.preview.section-records.v1';
const OUTBOX = 'mathpath.preview.outbox.v1';

export function loadProgress(sectionId) {
  return (loadLocal(PROGRESS) || {})[sectionId] || null;
}

export function saveProgress(sectionId, run) {
  const all = loadLocal(PROGRESS) || {};
  all[sectionId] = run;
  saveLocal(PROGRESS, all);
}

export function clearProgress(sectionId) {
  const all = loadLocal(PROGRESS) || {};
  delete all[sectionId];
  saveLocal(PROGRESS, all);
}

export function finishedRecords(sectionId) {
  const all = loadLocal(FINISHED) || [];
  return sectionId ? all.filter((r) => r.section === sectionId) : all;
}

export function saveFinished(record) {
  saveLocal(FINISHED, [...(loadLocal(FINISHED) || []), record]);
  saveLocal(OUTBOX, [...(loadLocal(OUTBOX) || []), record]);
}

export function outboxCount() {
  return (loadLocal(OUTBOX) || []).length;
}

export function clearAllSections() {
  removeLocal(PROGRESS);
  removeLocal(FINISHED);
  removeLocal(OUTBOX);
}

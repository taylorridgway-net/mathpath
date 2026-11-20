// The ONLY browser code that talks to the server (swappable, like the store).
//
// On Google Apps Script: calls apiStudent / apiTeacher through google.script.run.
// Anywhere else (the claude.ai preview): runs the very same server code
// (server/core/server.js) inside this browser, with its data kept in this
// browser, and a pretend student whose code is maple-tiger-42.
//
// Every call returns a Promise of a plain object; failures are
// { error, message }. A dropped connection is { error: 'network' }.

import { createServer } from '../../server/core/server.js';
import { createMemoryStore } from '../../server/core/store-memory.js';
import { loadLocal, saveLocal, removeLocal } from '../storage/local.js';

export const PREVIEW_CODE = 'maple-tiger-42';
const PREVIEW_TEACHER = 'preview-teacher@example.org';
const PREVIEW_STORE_KEY = 'mathpath.preview.server.v1';
const PREVIEW_DAYS_KEY = 'mathpath.preview.days.v1'; // preview only: pretend this many days have passed

export function createApi({ setup }) {
  const run = typeof google !== 'undefined' && google.script && google.script.run; // eslint-disable-line no-undef
  return run ? googleApi() : previewApi(setup);
}

function googleApi() {
  const call = (fn, name, args) => new Promise((resolve) => {
    google.script.run // eslint-disable-line no-undef
      .withSuccessHandler((r) => resolve(r || { error: 'server', message: 'Empty reply' }))
      .withFailureHandler((e) => resolve({ error: 'network', message: String((e && e.message) || e) }))[fn](name, args);
  });
  return {
    preview: false,
    now: () => new Date().toISOString(),
    student: (name, ...args) => call('apiStudent', name, args),
    teacher: (name, ...args) => call('apiTeacher', name, args),
  };
}

// ---------- preview: the real server code, in this browser ----------

function previewApi(setup) {
  const random = () => {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0] / 2 ** 32;
  };
  let store = createMemoryStore(loadLocal(PREVIEW_STORE_KEY) || seedPreview());
  // So the owner can try memory checks without waiting weeks: the pretend server's clock
  // (and the page's idea of "now") can be moved forward. Work keeps its real times.
  let days = Number(loadLocal(PREVIEW_DAYS_KEY)) || 0;
  const now = () => new Date(Date.now() + days * 24 * 3600 * 1000).toISOString();
  const server = () => createServer({ store, setup, random, now });
  const persist = () => saveLocal(PREVIEW_STORE_KEY, store.data);
  const respond = (fn) => {
    const result = fn();
    persist();
    return Promise.resolve(JSON.parse(JSON.stringify(result)));
  };
  return {
    preview: true,
    now,
    daysSkipped: () => days,
    skipDays(n) {
      days += n;
      saveLocal(PREVIEW_DAYS_KEY, days);
    },
    student: (name, ...args) => respond(() => server().student[name](...args)),
    teacher: (name, ...args) => respond(() => server().teacher[name](PREVIEW_TEACHER, ...args)),
    // Preview only: forget everything the pretend server knows.
    reset() {
      removeLocal(PREVIEW_STORE_KEY);
      removeLocal(PREVIEW_DAYS_KEY);
      days = 0;
      store = createMemoryStore(seedPreview());
      persist();
    },
  };

  function seedPreview() {
    return {
      teachers: [PREVIEW_TEACHER],
      classes: [{ id: 'c-preview', name: 'Period 1', teacherEmail: PREVIEW_TEACHER, createdAt: new Date().toISOString() }],
      students: [{
        id: 's-preview1', code: PREVIEW_CODE, nickname: '', classId: 'c-preview', createdAt: new Date().toISOString(), retired: false,
        summary: { diagnostic: null, diagnosticAttempts: 0, sectionAttempts: {}, sectionsPassed: [], mastered: [], cleared: [], saveIds: [] },
      }],
      roster: [{ studentId: 's-preview1', classId: 'c-preview', realName: 'Preview Student' }],
    };
  }
}

// A tiny stand-in for Google's SpreadsheetApp and LockService, just enough for
// the Sheets store's tests. Like Sheets, it turns ISO date text into Date objects.

export function fakeSpreadsheet() {
  const sheets = new Map();
  const cell = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v) ? new Date(v) : v);
  function makeSheet() {
    const rows = [];
    return {
      rows,
      writes: 0,
      reads: 0,
      getLastRow: () => rows.length,
      getLastColumn: () => Math.max(0, ...rows.map((r) => r.length)),
      insertColumnBefore(col) { for (const r of rows) r.splice(col - 1, 0, ''); },
      setFrozenRows() {},
      appendRow(r) { rows.push(r.map(cell)); this.writes++; },
      getDataRange: () => ({ getValues: () => rows.map((r) => [...r]) }),
      getRange(row, col, nr, nc) {
        const self = this;
        return {
          getValues() {
            self.reads++;
            return rows.slice(row - 1, row - 1 + nr).map((r) => Array.from({ length: nc }, (_, j) => (r[col - 1 + j] ?? '')));
          },
          setValues(vals) {
            for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) {
              rows[row - 1 + i] ||= [];
              rows[row - 1 + i][col - 1 + j] = cell(vals[i][j]);
            }
            self.writes++;
          },
        };
      },
    };
  }
  return {
    sheets,
    getId: () => 'fake-sheet-id',
    getUrl: () => 'https://docs.google.com/spreadsheets/d/fake-sheet-id',
    getSheets: () => [...sheets.values()],
    deleteSheet(sheet) { for (const [k, v] of sheets) if (v === sheet) sheets.delete(k); },
    getSheetByName: (name) => sheets.get(name) || null,
    insertSheet(name) { const s = makeSheet(); sheets.set(name, s); return s; },
  };
}

export function fakeLockService() {
  const lock = { held: false, waitLock() { if (this.held) throw new Error('lock busy'); this.held = true; }, releaseLock() { this.held = false; } };
  return { lock, getScriptLock: () => lock };
}

// Google's CacheService script cache: strings by key (expiry ignored). Counts reads.
export function fakeCache() {
  const items = new Map();
  return {
    items,
    gets: 0,
    get(k) { this.gets++; return items.has(k) ? items.get(k) : null; },
    put(k, v) { items.set(k, String(v)); },
    putAll(obj) { for (const [k, v] of Object.entries(obj)) items.set(k, String(v)); },
    remove(k) { items.delete(k); },
  };
}

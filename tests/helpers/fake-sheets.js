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
      getLastRow: () => rows.length,
      setFrozenRows() {},
      appendRow(r) { rows.push(r.map(cell)); this.writes++; },
      getDataRange: () => ({ getValues: () => rows.map((r) => [...r]) }),
      getRange(row, col, nr, nc) {
        const self = this;
        return {
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

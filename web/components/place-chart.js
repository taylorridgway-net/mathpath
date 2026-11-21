// The place-value chart, used in the decimals lessons: a number's digits in
// labelled columns (hundreds ... thousandths), with the decimal point fixed.
// With buttons, × 10 and ÷ 10 slide every digit one place left or right, so the
// student sees that the digits move (the point doesn't). Exact: engine/math/decimal.js.
// Settings come from the lesson file:
//   "visual": { "widget": "place-chart", "params": { "number": "4.5", "buttons": true } }
// Whole numbers (place value lesson): "whole": true shows hundred thousands ... ones,
// and "highlight": 3 marks the digit in that place (10^3: the thousands).

import { parseDecimal, decimalText } from '../../engine/math/decimal.js';
import { fraction } from '../../engine/math/fraction.js';

const DECIMAL_COLUMNS = [
  { name: 'hundreds', power: 2 }, { name: 'tens', power: 1 }, { name: 'ones', power: 0 },
  { name: 'tenths', power: -1, note: '1/10' }, { name: 'hundred\u00adths', power: -2, note: '1/100' }, { name: 'thousand\u00adths', power: -3, note: '1/1000' },
];

const WHOLE_COLUMNS = [
  { name: 'hundred thousands', power: 5 }, { name: 'ten thousands', power: 4 }, { name: 'thousands', power: 3 },
  { name: 'hundreds', power: 2 }, { name: 'tens', power: 1 }, { name: 'ones', power: 0 },
];

export function createPlaceChart({ host, params }) {
  const start = params.number;
  const COLUMNS = params.whole ? WHOLE_COLUMNS : DECIMAL_COLUMNS;
  let shift = 0; // times 10^shift
  const wrap = el('div', 'area pchart-wrap');
  const table = el('div', params.whole ? 'pchart pchart-whole' : 'pchart');
  table.setAttribute('role', 'img');
  const text = el('p', 'area-sums');
  text.setAttribute('aria-live', 'polite');
  wrap.append(table, text);
  const buttons = el('div', 'stepper');
  if (params.buttons) {
    const times = btn('× 10', () => move(1));
    const divide = btn('÷ 10', () => move(-1));
    const reset = btn('Start over', () => { shift = 0; render(); });
    buttons.append(times, divide, reset);
    wrap.append(buttons);
    buttons.times = times;
    buttons.divide = divide;
  }
  host.append(wrap);
  render();

  function valueText(s) {
    const v = parseDecimal(start);
    return decimalText(s >= 0 ? fraction(v.n * 10 ** s, v.d) : fraction(v.n, v.d * 10 ** -s));
  }
  // The digit in each column, or null where the number has no digit (no leading/trailing zeros).
  function digitsOf(textValue) {
    const [whole, part = ''] = textValue.split('.');
    return COLUMNS.map(({ power }) => {
      if (power >= 0) {
        const i = whole.length - 1 - power;
        return i >= 0 ? whole[i] : null;
      }
      return part[-power - 1] ?? null;
    });
  }
  function fits(textValue) {
    const [whole, part = ''] = textValue.split('.');
    return params.whole ? whole.length <= 6 && !part : whole.length <= 3 && part.length <= 3;
  }
  function move(dir) {
    if (!fits(valueText(shift + dir))) return;
    shift += dir;
    render();
  }

  function render() {
    const now = valueText(shift);
    const digits = digitsOf(now);
    table.replaceChildren();
    table.setAttribute('aria-label', `${now} in a place-value chart`);
    COLUMNS.forEach((c, i) => {
      if (c.power === -1) table.append(el('span', 'pchart-point pchart-head', ''));
      const head = el('span', 'pchart-head', c.name);
      if (c.note) head.append(el('span', 'pchart-note', c.note));
      table.append(head);
    });
    COLUMNS.forEach((c, i) => {
      if (c.power === -1) table.append(el('span', 'pchart-point', '.'));
      table.append(el('span', `pchart-digit${digits[i] === null ? ' is-empty' : ''}${c.power === params.highlight ? ' is-key' : ''}`, digits[i] ?? ''));
    });
    const factor = 10 ** Math.abs(shift);
    const commas = (v) => (params.whole ? v.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : v);
    const key = params.highlight !== undefined && digits[COLUMNS.findIndex((c) => c.power === params.highlight)];
    text.textContent = key && shift === 0
      ? `In ${commas(now)}, the ${key} is in the ${COLUMNS.find((c) => c.power === params.highlight).name} place: it is worth ${commas(String(key * 10 ** params.highlight))}.`
      : shift === 0
      ? (params.buttons ? `${start}. Tap × 10 or ÷ 10 and watch the digits move.` : `${now}: each place is 10 times the place to its right.`)
      : `${start} ${shift > 0 ? '×' : '÷'} ${factor} = ${now}. Every digit moved ${Math.abs(shift)} ${Math.abs(shift) === 1 ? 'place' : 'places'} ${shift > 0 ? 'left' : 'right'}.`;
    if (params.buttons) {
      buttons.times.disabled = !fits(valueText(shift + 1));
      buttons.divide.disabled = !fits(valueText(shift - 1));
    }
  }
}

function el(tag, className, text) {
  const e = document.createElement(tag);
  e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}
function btn(label, onClick) {
  const b = el('button', 'button', label);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

// Walk-slot template per weekday (0 = Monday … 6 = Sunday).
// This is the single source of truth for which slots exist and how many
// dogs fit in each — the frontend no longer hardcodes this, it fetches
// real availability from /api/availability.
// D = dopolední (4 h), O = odpolední (4 h), C = celodenní (8 h).
const D = { start: "08:00", end: "12:00", title: "Dopolední procházka", capacity: 6 };
const O = { start: "14:00", end: "18:00", title: "Odpolední procházka", capacity: 6 };
const C = { start: "09:00", end: "17:00", title: "Celodenní procházka", capacity: 6 };

export const WEEK_TEMPLATE = [
  [C], // pondělí
  [O], // úterý
  [C], // středa
  [D], // čtvrtek
  [], // pátek
  [C], // sobota
  [D], // neděle
];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

export function isValidDateStr(value) {
  return typeof value === "string" && DATE_RE.test(value);
}

export function isValidTimeStr(value) {
  return typeof value === "string" && TIME_RE.test(value);
}

function weekdayIndex(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return (date.getDay() + 6) % 7; // Monday = 0
}

export function templateForDate(dateStr) {
  return WEEK_TEMPLATE[weekdayIndex(dateStr)];
}

export function findSlot(dateStr, start, end) {
  return templateForDate(dateStr).find((s) => s.start === start && s.end === end) || null;
}

export function todayStr() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

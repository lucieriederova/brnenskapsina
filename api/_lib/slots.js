// Walk-slot template per weekday (0 = Monday … 6 = Sunday).
// This is the single source of truth for which slots exist and how many
// dogs fit in each — the frontend no longer hardcodes this, it fetches
// real availability from /api/availability.
export const WEEK_TEMPLATE = [
  [
    { start: "08:00", end: "10:00", title: "Ranní vycházka", capacity: 6 },
    { start: "15:30", end: "17:30", title: "Odpolední vycházka", capacity: 6 },
  ],
  [
    { start: "08:00", end: "10:00", title: "Ranní vycházka", capacity: 6 },
    { start: "10:00", end: "12:00", title: "Dopolední vycházka", capacity: 4 },
  ],
  [
    { start: "15:30", end: "17:30", title: "Odpolední vycházka", capacity: 6 },
  ],
  [
    { start: "08:00", end: "10:00", title: "Ranní vycházka", capacity: 6 },
    { start: "10:00", end: "12:00", title: "Dopolední vycházka", capacity: 4 },
  ],
  [
    { start: "08:00", end: "10:00", title: "Ranní vycházka", capacity: 6 },
    { start: "15:30", end: "17:30", title: "Odpolední vycházka", capacity: 6 },
  ],
  [
    { start: "09:00", end: "12:00", title: "Víkendový výlet", capacity: 8 },
  ],
  [],
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

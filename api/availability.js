import { sql } from "./_lib/db.js";
import { templateForDate, isValidDateStr } from "./_lib/slots.js";

function addDaysStr(dateStr, n) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + n);
  const pad = (x) => String(x).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const { start, end } = req.query;
  if (!isValidDateStr(start) || !isValidDateStr(end) || end < start) {
    res.status(400).json({ error: "invalid_range" });
    return;
  }

  const dates = [];
  let cursor = start;
  while (cursor <= end && dates.length <= 31) {
    dates.push(cursor);
    cursor = addDaysStr(cursor, 1);
  }

  let counts;
  try {
    const rows = await sql`
      SELECT slot_date, slot_start, slot_end, COUNT(*)::int AS booked
      FROM bookings
      WHERE kind = 'slot' AND slot_date BETWEEN ${start} AND ${end}
      GROUP BY slot_date, slot_start, slot_end
    `;
    counts = new Map(rows.map((r) => [`${r.slot_date}-${r.slot_start}-${r.slot_end}`, r.booked]));
  } catch (err) {
    console.error("availability query failed:", err);
    res.status(500).json({ error: "server_error" });
    return;
  }

  const slots = [];
  dates.forEach((dateStr) => {
    templateForDate(dateStr).forEach((slot) => {
      const key = `${dateStr}-${slot.start}-${slot.end}`;
      slots.push({
        date: dateStr,
        start: slot.start,
        end: slot.end,
        title: slot.title,
        capacity: slot.capacity,
        booked: counts.get(key) || 0,
      });
    });
  });

  res.status(200).json({ slots });
}

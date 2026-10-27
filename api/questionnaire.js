import { sql, ensureSchema } from "./_lib/db.js";
import { notifyOwner } from "./_lib/email.js";

// Follow-up questionnaire for a slot booking, reached via the secret link
// from the booking confirmation. GET prefills the form, POST saves it.

const TOKEN_RE = /^[0-9a-f-]{36}$/;

// [body key, label for the owner email, required]
const FIELDS = [
  ["ownerName", "Jméno a příjmení", true],
  ["ownerPhone", "Telefon", true],
  ["ownerEmail", "E-mail", true],
  ["emergencyName", "Nouzový kontakt – jméno", true],
  ["emergencyPhone", "Nouzový kontakt – telefon", true],
  ["dogName", "Jméno psa", true],
  ["breed", "Plemeno", true],
  ["age", "Věk", true],
  ["weight", "Aktuální váha", true],
  ["vetName", "Veterinář", true],
  ["vetAddress", "Adresa veterinární kliniky", true],
  ["vetPhone", "Telefon na veterináře", true],
  ["healthNotes", "Zdraví a strava", false],
  ["behaviorNotes", "Povaha a chování", false],
  ["pickupAddress", "Adresa vyzvednutí / předání", true],
  ["pickupTime", "Preferovaný čas vyzvednutí", true],
];

function clean(value) {
  const s = String(value ?? "").trim().slice(0, 2000);
  return s || null;
}

async function findBooking(token) {
  if (typeof token !== "string" || !TOKEN_RE.test(token)) return null;
  const rows = await sql`
    SELECT b.id, b.slot_date, b.slot_start, b.slot_end, b.slot_title,
           b.dog_name, b.breed, b.name, b.phone, b.email,
           q.id AS questionnaire_id
    FROM bookings b
    LEFT JOIN questionnaires q ON q.booking_id = b.id
    WHERE b.questionnaire_token = ${token}
  `;
  return rows[0] || null;
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  try {
    await ensureSchema();
    const token = req.method === "GET" ? req.query.t : req.body?.token;
    const booking = await findBooking(token);
    if (!booking) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    if (req.method === "GET") {
      res.status(200).json({
        slot: {
          title: booking.slot_title,
          date: booking.slot_date,
          start: booking.slot_start,
          end: booking.slot_end,
        },
        submitted: booking.questionnaire_id != null,
        prefill: {
          ownerName: booking.name,
          ownerPhone: booking.phone,
          ownerEmail: booking.email,
          dogName: booking.dog_name,
          breed: booking.breed,
        },
      });
      return;
    }

    if (booking.questionnaire_id != null) {
      res.status(409).json({ error: "already_submitted" });
      return;
    }

    const body = req.body || {};
    const v = {};
    for (const [key, , required] of FIELDS) {
      v[key] = clean(body[key]);
      if (required && !v[key]) {
        res.status(400).json({ error: "missing_fields", field: key });
        return;
      }
    }

    const rows = await sql`
      INSERT INTO questionnaires (
        booking_id, owner_name, owner_phone, owner_email, emergency_name, emergency_phone,
        dog_name, breed, age, weight, vet_name, vet_address, vet_phone,
        health_notes, behavior_notes, pickup_address, pickup_time
      ) VALUES (
        ${booking.id}, ${v.ownerName}, ${v.ownerPhone}, ${v.ownerEmail}, ${v.emergencyName}, ${v.emergencyPhone},
        ${v.dogName}, ${v.breed}, ${v.age}, ${v.weight}, ${v.vetName}, ${v.vetAddress}, ${v.vetPhone},
        ${v.healthNotes}, ${v.behaviorNotes}, ${v.pickupAddress}, ${v.pickupTime}
      )
      ON CONFLICT (booking_id) DO NOTHING
      RETURNING id
    `;
    if (rows.length === 0) {
      res.status(409).json({ error: "already_submitted" });
      return;
    }

    await notifyOwner(
      `Vyplněný dotazník: ${v.dogName}, ${booking.slot_title} ${booking.slot_date}`,
      [
        `Termín: ${booking.slot_title}, ${booking.slot_date} ${booking.slot_start}–${booking.slot_end}`,
        ...FIELDS.map(([key, label]) => `${label}: ${v[key] || "—"}`),
        `Dotazník je kompletní, můžete poslat QR kód k platbě na ${v.ownerEmail}.`,
      ]
    );

    res.status(201).json({ ok: true });
  } catch (err) {
    console.error("questionnaire failed:", err);
    res.status(500).json({ error: "server_error" });
  }
}

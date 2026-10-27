import { randomUUID } from "node:crypto";
import { sql, ensureSchema } from "./_lib/db.js";
import { findSlot, isValidDateStr, isValidTimeStr, todayStr } from "./_lib/slots.js";
import { notifyOwner, emailCustomer } from "./_lib/email.js";

const SITE_URL = (process.env.SITE_URL || "https://brnenskapsina.cz").replace(/\/$/, "");

function isValidEmail(value) {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function clean(value) {
  const s = String(value ?? "").trim();
  return s || null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const body = req.body || {};
  const kind = body.kind === "inquiry" || body.kind === "slot" ? body.kind : null;
  if (!kind) {
    res.status(400).json({ error: "invalid_kind" });
    return;
  }

  const name = clean(body.name);
  const email = clean(body.email);
  if (!name || !email || !isValidEmail(email)) {
    res.status(400).json({ error: "missing_fields" });
    return;
  }

  const dogName = clean(body.dogName);
  const breed = clean(body.breed);
  const phone = clean(body.phone);
  const note = clean(body.note);

  try {
    if (kind === "slot") {
      const { slotDate, slotStart, slotEnd } = body;
      if (!isValidDateStr(slotDate) || !isValidTimeStr(slotStart) || !isValidTimeStr(slotEnd)) {
        res.status(400).json({ error: "invalid_slot" });
        return;
      }
      if (slotDate < todayStr()) {
        res.status(400).json({ error: "past_date" });
        return;
      }

      // Capacity and title always come from the server-side template, never
      // from the client, so a tampered request can't book a fake/oversized slot.
      const template = findSlot(slotDate, slotStart, slotEnd);
      if (!template) {
        res.status(400).json({ error: "invalid_slot" });
        return;
      }

      await ensureSchema();
      const token = randomUUID();
      const questionnaireUrl = `${SITE_URL}/dotaznik.html?t=${token}`;

      const rows = await sql`
        INSERT INTO bookings (kind, slot_date, slot_start, slot_end, slot_title, dog_name, breed, name, phone, email, note, questionnaire_token)
        SELECT 'slot', ${slotDate}, ${slotStart}, ${slotEnd}, ${template.title}, ${dogName}, ${breed}, ${name}, ${phone}, ${email}, ${note}, ${token}
        WHERE (
          SELECT COUNT(*) FROM bookings
          WHERE kind = 'slot' AND slot_date = ${slotDate} AND slot_start = ${slotStart} AND slot_end = ${slotEnd}
        ) < ${template.capacity}
        RETURNING id
      `;

      if (rows.length === 0) {
        res.status(409).json({ error: "full" });
        return;
      }

      await notifyOwner(
        `Nová rezervace: ${template.title} ${slotDate} ${slotStart}–${slotEnd}`,
        [
          `Termín: ${template.title}, ${slotDate} ${slotStart}–${slotEnd}`,
          `Pes: ${dogName || "—"}${breed ? ` (${breed})` : ""}`,
          `Majitel: ${name}`,
          `Telefon: ${phone || "—"}`,
          `E-mail: ${email}`,
          note ? `Poznámka: ${note}` : null,
          "Dotazník o psovi zatím nevyplnil — přijde další e-mail, až ho vyplní.",
        ].filter(Boolean)
      );

      await emailCustomer(
        email,
        `Rezervace: ${template.title} ${slotDate}`,
        [
          `Dobrý den, ${name},`,
          `děkujeme za rezervaci: ${template.title}, ${slotDate} ${slotStart}–${slotEnd}${dogName ? ` pro ${dogName}` : ""}.`,
          "Než termín potvrdíme, potřebujeme o vašem psovi pár informací (kontakt na veterináře, adresu vyzvednutí, zdraví a povahu). Vyplnění zabere asi 5 minut:",
          { text: "Vyplnit dotazník", href: questionnaireUrl },
          "Jakmile dotazník projdeme, pošleme vám QR kód k platbě.",
          "Brněnská psina",
        ]
      );

      res.status(201).json({ ok: true, questionnaireUrl });
      return;
    }

    // kind === "inquiry" — general poptávka, not tied to a specific slot
    const age = clean(body.age);
    const pkg = clean(body.package);
    const location = clean(body.location);
    const preferredDate = isValidDateStr(body.preferredDate) ? body.preferredDate : null;

    await sql`
      INSERT INTO bookings (kind, dog_name, breed, age, package, location, preferred_date, name, phone, email, note)
      VALUES ('inquiry', ${dogName}, ${breed}, ${age}, ${pkg}, ${location}, ${preferredDate}, ${name}, ${phone}, ${email}, ${note})
    `;

    await notifyOwner(
      `Nová poptávka od ${name}`,
      [
        `Pes: ${dogName || "—"}${breed ? ` (${breed})` : ""}${age ? `, ${age} let` : ""}`,
        `Balíček: ${pkg || "—"}`,
        `Lokalita: ${location || "—"}`,
        `Preferované datum: ${preferredDate || "—"}`,
        `Jméno: ${name}`,
        `Telefon: ${phone || "—"}`,
        `E-mail: ${email}`,
        note ? `Poznámka: ${note}` : null,
      ].filter(Boolean)
    );

    res.status(201).json({ ok: true });
  } catch (err) {
    console.error("booking insert failed:", err);
    res.status(500).json({ error: "server_error" });
  }
}

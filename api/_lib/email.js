import { Resend } from "resend";

const NOTIFY_TO = process.env.BOOKING_NOTIFY_EMAIL || "brnenskapsina@gmail.com";
const FROM = process.env.BOOKING_FROM_EMAIL || "Brněnská psina <onboarding@resend.dev>";

// Built lazily (not at module load) so a malformed RESEND_API_KEY can never
// crash the whole function before a booking has a chance to be saved —
// email notification is a nice-to-have, saving the booking is not.
function getResendClient() {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return null;
  try {
    return new Resend(key);
  } catch (err) {
    console.error("Failed to construct Resend client (check RESEND_API_KEY for stray characters):", err);
    return null;
  }
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

// A line is either plain text or { text, href } for a link.
function renderLine(line) {
  if (typeof line === "string") return escapeHtml(line);
  return `<a href="${escapeHtml(line.href)}">${escapeHtml(line.text)}</a>`;
}

// Best-effort sending — a failed email must never block a booking that
// already made it into the database, so a failure is only logged.
async function sendEmail(to, subject, lines, label) {
  const resend = getResendClient();
  if (!resend) {
    console.warn(`Resend not configured — skipping ${label} email`);
    return;
  }
  const html = `<p>${lines.map(renderLine).join("</p><p>")}</p>`;
  try {
    // The Resend SDK resolves with { data, error } instead of throwing for
    // API-level failures (e.g. sandbox recipient restrictions), so both
    // paths must be checked to avoid silently swallowing a real failure.
    const { error } = await resend.emails.send({ from: FROM, to, subject, html });
    if (error) {
      console.error(`Resend rejected the ${label} email:`, error);
    }
  } catch (err) {
    console.error(`Failed to send ${label} email:`, err);
  }
}

export function notifyOwner(subject, lines) {
  return sendEmail(NOTIFY_TO, subject, lines, "owner notification");
}

// Needs BOOKING_FROM_EMAIL on a domain verified in Resend — the
// onboarding@resend.dev sandbox sender only delivers to the account owner.
export function emailCustomer(to, subject, lines) {
  return sendEmail(to, subject, lines, "customer");
}

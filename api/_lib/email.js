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

// Best-effort notification — a failed email must never block a booking that
// already made it into the database, so callers should not await this on
// the critical path of the response.
export async function notifyOwner(subject, lines) {
  const resend = getResendClient();
  if (!resend) {
    console.warn("Resend not configured — skipping owner notification email");
    return;
  }
  const html = `<p>${lines.map(escapeHtml).join("</p><p>")}</p>`;
  try {
    await resend.emails.send({ from: FROM, to: NOTIFY_TO, subject, html });
  } catch (err) {
    console.error("Failed to send notification email:", err);
  }
}

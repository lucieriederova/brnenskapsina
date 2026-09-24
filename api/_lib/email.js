import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const NOTIFY_TO = process.env.BOOKING_NOTIFY_EMAIL || "brnenskapsina@gmail.com";
const FROM = process.env.BOOKING_FROM_EMAIL || "Brněnská psina <onboarding@resend.dev>";

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

// Best-effort notification — a failed email must never block a booking that
// already made it into the database, so callers should not await this on
// the critical path of the response.
export async function notifyOwner(subject, lines) {
  if (!resend) {
    console.warn("RESEND_API_KEY not set — skipping owner notification email");
    return;
  }
  const html = `<p>${lines.map(escapeHtml).join("</p><p>")}</p>`;
  try {
    await resend.emails.send({ from: FROM, to: NOTIFY_TO, subject, html });
  } catch (err) {
    console.error("Failed to send notification email:", err);
  }
}

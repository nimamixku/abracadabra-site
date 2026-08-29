// Shared Resend sender -- extracted from the fetch-based call that used
// to live inline in app/api/confirm/route.js. Same "best-effort, never
// throws" contract: auth emails and order-backup emails both call this,
// and neither a login flow nor a sale should ever fail because an email
// provider had a bad moment.
//
// RESEND_API_KEY + RESEND_FROM_EMAIL must point at a verified sending
// domain to email addresses other than the Resend account owner's own --
// see the platform README for setup. Until that's done, this silently
// no-ops (magic links log to the server console instead, see lib/auth.js).
export async function sendEmail({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from || !to) {
    return { sent: false, reason: "not_configured" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("Resend send failed:", res.status, body);
      return { sent: false, reason: "provider_error" };
    }
    return { sent: true };
  } catch (err) {
    console.error("Resend send failed:", err);
    return { sent: false, reason: "network_error" };
  }
}

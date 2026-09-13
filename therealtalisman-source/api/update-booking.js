import { Redis } from "@upstash/redis";
import { Resend } from "resend";

const redis = Redis.fromEnv();

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const password = req.headers["x-admin-password"];
  if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { id, status, meetLink } = req.body || {};
  if (!id || !["confirmed", "declined", "pending"].includes(status)) {
    res.status(400).json({ error: "Invalid update." });
    return;
  }

  let updatedBooking = null;

  try {
    const existing = (await redis.get("bookings")) || [];
    const bookings = Array.isArray(existing) ? existing : [];
    const updated = bookings.map((b) => {
      if (b.id === id) {
        updatedBooking = { ...b, status, meetLink: meetLink || b.meetLink || "" };
        return updatedBooking;
      }
      return b;
    });
    await redis.set("bookings", updated);
  } catch (err) {
    console.error("Failed to update booking:", err);
    res.status(500).json({ error: "Could not update booking." });
    return;
  }

  // Email the customer, but never let an email failure block the status update above.
  if (updatedBooking && process.env.RESEND_API_KEY && updatedBooking.email) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const fromEmail = process.env.FROM_EMAIL || "bookings@onresend.dev";

      if (status === "confirmed") {
        await resend.emails.send({
          from: fromEmail,
          to: updatedBooking.email,
          subject: "Your therealtalisMAN session is confirmed!",
          text: [
            `Hi ${updatedBooking.name || "there"},`,
            "",
            `Your session — ${updatedBooking.category} — ${updatedBooking.label} — is confirmed for ${updatedBooking.date} at ${updatedBooking.time}.`,
            "",
            updatedBooking.meetLink
              ? `Join here at your session time: ${updatedBooking.meetLink}`
              : "Your Google Meet link will follow separately before your session.",
            "",
            "See you then!",
            "— therealtalisMAN",
          ].join("\n"),
        });
      } else if (status === "declined") {
        await resend.emails.send({
          from: fromEmail,
          to: updatedBooking.email,
          subject: "About your therealtalisMAN booking",
          text: [
            `Hi ${updatedBooking.name || "there"},`,
            "",
            `We're sorry — we're unable to confirm your requested session (${updatedBooking.category} — ${updatedBooking.label}) for ${updatedBooking.date} at ${updatedBooking.time}.`,
            "",
            `Please reach out to us to reschedule or ask any questions: ${process.env.NOTIFY_EMAIL || ""}`,
            "",
            "— therealtalisMAN",
          ].join("\n"),
        });
      }
    } catch (err) {
      console.error("Booking status email failed:", err);
    }
  }

  res.status(200).json({ success: true });
}

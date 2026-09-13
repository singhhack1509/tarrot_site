import { Redis } from "@upstash/redis";
import { Resend } from "resend";

const redis = Redis.fromEnv();

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { name, email, date, time, category, label, price, note } = req.body || {};

  if (!name || !email || !date || !time || !category || !label || !price) {
    res.status(400).json({ error: "Missing booking details." });
    return;
  }

  const booking = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    email,
    date,
    time,
    category,
    label,
    price,
    note: note || "",
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  try {
    const existing = (await redis.get("bookings")) || [];
    const bookings = Array.isArray(existing) ? existing : [];
    bookings.unshift(booking); // newest first
    await redis.set("bookings", bookings);
  } catch (err) {
    console.error("Failed to save booking:", err);
    res.status(500).json({ error: "Could not save booking." });
    return;
  }

  // Optional nudge to the reader — doesn't block the booking if it fails.
  if (process.env.RESEND_API_KEY && process.env.NOTIFY_EMAIL) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: process.env.FROM_EMAIL || "bookings@onresend.dev",
        to: process.env.NOTIFY_EMAIL,
        subject: `New booking request: ${category} — ${label}`,
        text: [
          "A new booking request is waiting in your portal.",
          "",
          `Name: ${name}`,
          `Session: ${category} — ${label} (₹${price})`,
          `Requested: ${date} at ${time}`,
          note ? `Note: ${note}` : "",
          "",
          "Open your admin portal to confirm or decline it.",
        ].filter(Boolean).join("\n"),
      });
    } catch (err) {
      console.error("New-booking alert email failed:", err);
    }
  }

  res.status(200).json({ success: true, id: booking.id });
}

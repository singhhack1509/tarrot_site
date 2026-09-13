import { Redis } from "@upstash/redis";

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
    res.status(200).json({ success: true, id: booking.id });
  } catch (err) {
    console.error("Failed to save booking:", err);
    res.status(500).json({ error: "Could not save booking." });
  }
}

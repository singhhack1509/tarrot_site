import { Redis } from "@upstash/redis";

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

  const { id, status } = req.body || {};
  if (!id || !["confirmed", "declined", "pending"].includes(status)) {
    res.status(400).json({ error: "Invalid update." });
    return;
  }

  try {
    const existing = (await redis.get("bookings")) || [];
    const bookings = Array.isArray(existing) ? existing : [];
    const updated = bookings.map((b) => (b.id === id ? { ...b, status } : b));
    await redis.set("bookings", updated);
    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Failed to update booking:", err);
    res.status(500).json({ error: "Could not update booking." });
  }
}

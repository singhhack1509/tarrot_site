import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const password = req.headers["x-admin-password"];
  if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const bookings = (await redis.get("bookings")) || [];
    res.status(200).json({ bookings });
  } catch (err) {
    console.error("Failed to fetch bookings:", err);
    res.status(500).json({ error: "Could not load bookings." });
  }
}

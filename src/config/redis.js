import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

export const redis = new Redis(redisUrl);

redis.on("connect", () => {
  console.log("[Redis] Connected successfully");
});

redis.on("error", (err) => {
  console.error("[Redis] Connection error:", err.message);
});

/**
 * Seed or reset the available ticket stock for an event in Redis
 * @param {string} eventId
 * @param {number|string} count
 */
export const seedEventStock = async (eventId, count) => {
  return await redis.set(`event:stock:${eventId}`, count);
};

/**
 * Get the live ticket stock for an event from Redis
 * @param {string} eventId
 * @returns {Promise<number|null>}
 */
export const getEventStock = async (eventId) => {
  const stock = await redis.get(`event:stock:${eventId}`);
  if (stock === null) {
    return null;
  }
  const parsed = parseInt(stock, 10);
  return Number.isNaN(parsed) ? stock : parsed;
};

export default redis;

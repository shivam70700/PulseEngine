import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

/**
 * BullMQ requires maxRetriesPerRequest to be null
 */
export const getRedisConnectionConfig = () => {
  try {
    const parsed = new URL(redisUrl);
    return {
      host: parsed.hostname || "localhost",
      port: parsed.port ? parseInt(parsed.port, 10) : 6379,
      password: parsed.password || undefined,
      username: parsed.username || undefined,
      maxRetriesPerRequest: null,
    };
  } catch {
    return {
      host: "localhost",
      port: 6379,
      maxRetriesPerRequest: null,
    };
  }
};

export const redisConfig = getRedisConnectionConfig();

export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
});

redis.on("connect", () => {
  console.log("[Redis] Connected successfully");
});

redis.on("error", (err) => {
  console.error("[Redis] Connection error:", err.message);
});

/**
 * Atomic Lua script for ticket reservation:
 * KEYS[1]: event:stock:${eventId}
 * KEYS[2]: event:users:${eventId} (optional user double-booking set)
 *
 * Checks if stock exists (returns -2 if missing).
 * Checks if stock > 0 (returns -1 if sold out).
 * Decrements stock atomically and returns remaining count (>= 0).
 */
redis.defineCommand("reserveTicketAtomic", {
  numberOfKeys: 1,
  lua: `
    local stock = redis.call('GET', KEYS[1])
    if not stock then
      return -2
    end
    local current = tonumber(stock)
    if current <= 0 then
      return -1
    end
    return redis.call('DECR', KEYS[1])
  `,
});

/**
 * Helper to run reserveTicketAtomic Lua script
 * @param {string} eventId
 * @returns {Promise<number>}
 */
export const reserveTicketAtomic = async (eventId) => {
  return await redis.reserveTicketAtomic(
    `event:stock:${eventId}`,
    `event:users:${eventId}`,
  );
};

/**
 * Roll back / increment ticket stock in Redis if a DB transaction fails
 * @param {string} eventId
 * @returns {Promise<number>}
 */
export const incrementEventStock = async (eventId) => {
  return await redis.incr(`event:stock:${eventId}`);
};

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

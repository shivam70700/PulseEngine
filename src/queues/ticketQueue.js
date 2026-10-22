import { Queue } from "bullmq";
import { redisConfig } from "../config/redis.js";

export const ticketQueue = new Queue("ticket-reservation", {
  connection: redisConfig,
});

ticketQueue.on("error", (err) => {
  console.error("[TicketQueue] Queue error:", err.message);
});

export default ticketQueue;

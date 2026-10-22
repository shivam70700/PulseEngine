import { Worker } from "bullmq";
import { prisma } from "../config/db.js";
import { redisConfig, incrementEventStock } from "../config/redis.js";

export let ticketWorker = null;

/**
 * Initializes and starts the BullMQ Worker for ticket-reservation queue
 */
export const initTicketWorker = () => {
  if (ticketWorker) {
    return ticketWorker;
  }

  ticketWorker = new Worker(
    "ticket-reservation",
    async (job) => {
      const { userId, eventId } = job.data;

      try {
        const ticket = await prisma.$transaction(async (tx) => {
          // 1. Decrement availableCount on Event where id === eventId and availableCount > 0
          const updateResult = await tx.event.updateMany({
            where: {
              id: eventId,
              availableCount: { gt: 0 },
            },
            data: {
              availableCount: { decrement: 1 },
            },
          });

          if (updateResult.count === 0) {
            throw new Error(
              `Failed to reserve ticket: Event ${eventId} sold out or not found`,
            );
          }

          // 2. Create Ticket record with userId, eventId, and status: 'CONFIRMED'
          const createdTicket = await tx.ticket.create({
            data: {
              userId,
              eventId,
              status: "CONFIRMED",
            },
            include: {
              event: true,
            },
          });

          return createdTicket;
        });

        return ticket;
      } catch (error) {
        // Roll back Redis stock if PostgreSQL transaction fails
        try {
          await incrementEventStock(eventId);
        } catch (redisErr) {
          console.error(
            `[TicketWorker] Failed to restore Redis stock for event ${eventId}:`,
            redisErr.message,
          );
        }
        throw error;
      }
    },
    {
      connection: redisConfig,
      concurrency: 5,
    },
  );

  ticketWorker.on("completed", (job) => {
    console.log(`[TicketWorker] Job ${job.id} completed successfully`);
  });

  ticketWorker.on("failed", (job, err) => {
    console.error(`[TicketWorker] Job ${job?.id} failed:`, err.message);
  });

  ticketWorker.on("error", (err) => {
    console.error("[TicketWorker] Worker connection error:", err.message);
  });

  return ticketWorker;
};

export default initTicketWorker;

import { prisma } from "../config/db.js";
import { reserveTicketAtomic, seedEventStock } from "../config/redis.js";
import { ticketQueue } from "../queues/ticketQueue.js";

/**
 * @desc   Reserve a ticket with high-concurrency Redis check & queue
 * @route  POST /api/tickets/reserve
 */
export const reserveTicket = async (req, res, next) => {
  try {
    const { eventId } = req.body;

    // 1. Run atomic Lua script in Redis
    let remainingStock = await reserveTicketAtomic(eventId);

    // 2. If key doesn't exist (-2), lazy-load stock from PostgreSQL and retry once
    if (remainingStock === -2) {
      const event = await prisma.event.findUnique({
        where: { id: eventId },
        select: { id: true, availableCount: true },
      });

      if (!event) {
        return res.status(404).json({
          success: false,
          message: "Event not found",
        });
      }

      await seedEventStock(event.id, event.availableCount);
      remainingStock = await reserveTicketAtomic(eventId);
    }

    // 3. If stock <= 0 (-1), immediately return HTTP 409 Conflict
    if (remainingStock === -1) {
      return res.status(409).json({
        success: false,
        status: "SOLD_OUT",
        message: "Tickets are sold out!",
      });
    }

    // 4. If result >= 0, enqueue job in BullMQ and immediately return HTTP 202 Accepted
    if (remainingStock >= 0) {
      const job = await ticketQueue.add("reserve", {
        userId: req.user.id,
        eventId,
      });

      return res.status(202).json({
        success: true,
        status: "QUEUED",
        jobId: job.id,
        remainingRedisStock: remainingStock,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Unexpected response during ticket reservation",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Check BullMQ reservation job state and return ticket data
 * @route  GET /api/tickets/job/:jobId
 */
export const getJobStatus = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const job = await ticketQueue.getJob(jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Reservation job not found",
      });
    }

    const state = await job.getState();
    const isCompleted = state === "completed";
    const isFailed = state === "failed";

    res.status(200).json({
      success: true,
      jobId: job.id,
      state,
      ticket: isCompleted ? job.returnvalue : null,
      failedReason: isFailed ? job.failedReason : null,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Get all tickets for the authenticated user
 * @route  GET /api/tickets/my-tickets
 */
export const getMyTickets = async (req, res, next) => {
  try {
    const tickets = await prisma.ticket.findMany({
      where: { userId: req.user.id },
      include: {
        event: true,
      },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({
      success: true,
      count: tickets.length,
      data: tickets,
    });
  } catch (error) {
    next(error);
  }
};

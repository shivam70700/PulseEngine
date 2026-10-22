import { prisma } from "../config/db.js";
import {
  reserveTicketAtomic,
  seedEventStock,
  getEventStock,
} from "../config/redis.js";
import { ticketQueue } from "../queues/ticketQueue.js";
import { getIO } from "../config/socket.js";

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

    const io = getIO();
    const timestamp = new Date().toISOString();

    // 3. If stock <= 0 (-1), immediately emit SOLD_OUT and return HTTP 409 Conflict
    if (remainingStock === -1) {
      if (io) {
        io.emit("ticket:update", {
          type: "SOLD_OUT",
          eventId,
          timestamp,
        });
      }

      return res.status(409).json({
        success: false,
        status: "SOLD_OUT",
        message: "Tickets are sold out!",
      });
    }

    // 4. If result >= 0, enqueue job in BullMQ, emit QUEUED, and return HTTP 202 Accepted
    if (remainingStock >= 0) {
      const job = await ticketQueue.add("reserve", {
        userId: req.user.id,
        eventId,
      });

      if (io) {
        io.emit("ticket:update", {
          type: "QUEUED",
          eventId,
          jobId: job.id,
          remainingRedisStock: remainingStock,
          timestamp,
        });
      }

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

/**
 * @desc   Simulate a live high-concurrency flash sale stress test
 * @route  POST /api/tickets/simulate
 */
export const simulateFlashSale = async (req, res, next) => {
  try {
    const { eventId, concurrentRequests = 100 } = req.body;
    const totalRequests = Number(concurrentRequests) || 100;

    if (!eventId) {
      return res.status(400).json({
        success: false,
        message: "eventId is required",
      });
    }

    // 1. Ensure demo user exists in PostgreSQL
    const demoUser = await prisma.user.upsert({
      where: { email: "demo@pulseengine.com" },
      update: {},
      create: {
        email: "demo@pulseengine.com",
        name: "Demo Concurrency User",
        password: "demopasswordhash123",
        role: "USER",
      },
    });

    // 2. Ensure Redis key is seeded if not present
    const existingStock = await getEventStock(eventId);
    if (existingStock === null) {
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
    }

    const io = getIO();
    const startTime = Date.now();

    // 3. Define single reservation execution
    const executeSingleReservation = async () => {
      try {
        const remainingStock = await reserveTicketAtomic(eventId);
        const timestamp = new Date().toISOString();

        if (remainingStock === -1) {
          if (io) {
            io.emit("ticket:update", {
              type: "SOLD_OUT",
              eventId,
              timestamp,
            });
          }
          return { accepted: false, status: "SOLD_OUT" };
        }

        if (remainingStock >= 0) {
          const job = await ticketQueue.add("reserve", {
            userId: demoUser.id,
            eventId,
          });

          if (io) {
            io.emit("ticket:update", {
              type: "QUEUED",
              eventId,
              jobId: job.id,
              remainingRedisStock: remainingStock,
              timestamp,
            });
          }

          return {
            accepted: true,
            status: "QUEUED",
            jobId: job.id,
            remainingRedisStock: remainingStock,
          };
        }

        return { accepted: false, status: "ERROR" };
      } catch (err) {
        return { accepted: false, status: "ERROR", error: err.message };
      }
    };

    // 4. Fire all requests concurrently with Promise.all
    const tasks = Array.from({ length: totalRequests }, () =>
      executeSingleReservation(),
    );
    const results = await Promise.all(tasks);
    const durationMs = Date.now() - startTime;

    // 5. Aggregate metrics
    const acceptedInRedis = results.filter((r) => r.accepted).length;
    const rejectedSoldOut = results.filter(
      (r) => r.status === "SOLD_OUT",
    ).length;

    res.status(200).json({
      success: true,
      summary: {
        totalRequests,
        acceptedInRedis,
        rejectedSoldOut,
        durationMs,
      },
    });
  } catch (error) {
    next(error);
  }
};

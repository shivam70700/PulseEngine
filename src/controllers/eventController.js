import { prisma } from "../config/db.js";
import { seedEventStock, getEventStock } from "../config/redis.js";

/**
 * @desc   Create a new ticket event
 * @route  POST /api/events
 */
export const createEvent = async (req, res, next) => {
  try {
    const { title, description, totalTickets, ticketPrice, saleStartTime } =
      req.body;

    // When an event is created, availableCount equals totalTickets
    const event = await prisma.event.create({
      data: {
        title,
        description,
        totalTickets,
        ticketPrice,
        availableCount: totalTickets,
        saleStartTime: new Date(saleStartTime),
      },
    });

    // Seed initial ticket stock in Redis
    await seedEventStock(event.id, event.totalTickets);

    res.status(201).json({
      success: true,
      data: {
        ...event,
        redisStock: event.totalTickets,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Get all ticket events
 * @route  GET /api/events
 */
export const getEvents = async (req, res, next) => {
  try {
    const events = await prisma.event.findMany({
      orderBy: { createdAt: "desc" },
    });

    const eventsWithStock = await Promise.all(
      events.map(async (event) => {
        const redisStock = await getEventStock(event.id);
        return {
          ...event,
          redisStock,
        };
      }),
    );

    res.status(200).json({
      success: true,
      count: eventsWithStock.length,
      data: eventsWithStock,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Reset event stock and clear purchased tickets
 * @route  POST /api/events/:id/reset
 */
export const resetEventStock = async (req, res, next) => {
  try {
    const { id } = req.params;

    const event = await prisma.event.findUnique({
      where: { id },
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    const [, updatedEvent] = await prisma.$transaction([
      prisma.ticket.deleteMany({
        where: { eventId: id },
      }),
      prisma.event.update({
        where: { id },
        data: {
          availableCount: event.totalTickets,
        },
      }),
    ]);

    await seedEventStock(id, event.totalTickets);

    res.status(200).json({
      success: true,
      message: "Event stock reset successfully",
      data: {
        ...updatedEvent,
        redisStock: event.totalTickets,
      },
    });
  } catch (error) {
    next(error);
  }
};

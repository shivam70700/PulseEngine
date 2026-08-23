import { prisma } from '../config/db.js';

/**
 * @desc   Create a new ticket event
 * @route  POST /api/events
 */

export const createEvent = async (req, res, next) => {
  try {
    const { title, description, totalTickets, ticketPrice, saleStartTime } = req.body;

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

    res.status(201).json({
      success: true,
      data: event,
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
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({
      success: true,
      count: events.length,
      data: events,
    });
  } catch (error) {
    next(error);
  }
};
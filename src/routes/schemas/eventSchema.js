import { z } from 'zod';

export const createEventSchema = z.object({
  body: z.object({
    title: z.string().min(3, 'Title must be at least 3 characters long'),
    description: z.string().optional(),
    totalTickets: z.number().int().positive('Total tickets must be a positive integer'),
    ticketPrice: z.number().positive('Price must be greater than 0'),
    saleStartTime: z.string().datetime({ message: 'Must be a valid ISO date string' }),
  }),
});
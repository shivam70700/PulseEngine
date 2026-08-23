import { z } from 'zod';

export const createEventSchema = z.object({
  body: z.object({
    title: z
      .string({ required_error: 'Title is required' })
      .min(3, 'Title must be at least 3 characters long'),
    description: z.string().optional(),
    totalTickets: z
      .number({ required_error: 'Total tickets is required' })
      .int('Total tickets must be an integer')
      .positive('Total tickets must be greater than 0'),
    ticketPrice: z
      .number({ required_error: 'Ticket price is required' })
      .nonnegative('Ticket price cannot be negative'),
    saleStartTime: z
      .string({ required_error: 'Sale start time is required' })
      .datetime({ message: 'Invalid ISO 8601 date string' }),
  }),
});
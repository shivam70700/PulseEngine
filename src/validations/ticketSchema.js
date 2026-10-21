import { z } from "zod";

export const reserveTicketSchema = z.object({
  body: z.object({
    eventId: z
      .string({ required_error: "Event ID is required" })
      .uuid("Event ID must be a valid UUID"),
  }),
});

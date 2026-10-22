import { Router } from "express";
import { protect } from "../middlewares/authMiddleware.js";
import { validate } from "../middlewares/validate.js";
import { reserveTicketSchema } from "../validations/ticketSchema.js";
import {
  reserveTicket,
  getJobStatus,
  getMyTickets,
  simulateFlashSale,
} from "../controllers/ticketController.js";

const router = Router();

router.post("/reserve", protect, validate(reserveTicketSchema), reserveTicket);
router.get("/job/:jobId", protect, getJobStatus);
router.get("/my-tickets", protect, getMyTickets);
router.post("/simulate", simulateFlashSale);

export default router;

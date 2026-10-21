import { Router } from "express";
import { validate } from "../middlewares/validate.js";
import { protect, authorize } from "../middlewares/authMiddleware.js";
import { createEventSchema } from "../validations/eventSchema.js";
import {
  createEvent,
  getEvents,
  resetEventStock,
} from "../controllers/eventController.js";

const router = Router();

router
  .route("/")
  .post(protect, authorize("ADMIN"), validate(createEventSchema), createEvent)
  .get(getEvents);

router.post("/:id/reset", resetEventStock);

export default router;

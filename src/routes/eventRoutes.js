import { Router } from 'express';
import { validate } from '../middlewares/validate.js';
import { createEventSchema } from '../validations/eventSchema.js';
import { createEvent, getEvents } from '../controllers/eventController.js';

const router = Router();

router
  .route('/')
  .post(validate(createEventSchema), createEvent)
  .get(getEvents);

export default router;
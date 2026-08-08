import { Router } from 'express';
import { validate } from '../middlewares/validate.js';
import { createEventSchema } from './schemas/eventSchema.js';

const router = Router();

// Endpoint to create a flash sale event
router.post('/', validate(createEventSchema), (req, res) => {
  // If request hits this controller, data is 100% guaranteed to be valid!
  res.status(201).json({
    success: true,
    message: 'Event schema validated successfully!',
    data: req.body,
  });
});

export default router;
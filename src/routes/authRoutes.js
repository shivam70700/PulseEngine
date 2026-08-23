import { Router } from 'express';
import { validate } from '../middlewares/validate.js';
import { protect } from '../middlewares/authMiddleware.js';
import { registerSchema, loginSchema } from '../validations/authSchema.js';
import { register, login, getMe } from '../controllers/authController.js';

const router = Router();

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.get('/me', protect, getMe);

export default router;
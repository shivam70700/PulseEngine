import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { errorHandler } from './middlewares/errorHandler.js';
import eventRoutes from './routes/eventRoutes.js'; 
import { prisma } from './config/db.js';

const app = express();

// Global Middlewares
app.use(helmet()); // Security headers
app.use(cors()); // Enable CORS
app.use(express.json()); // Body parser

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP', timestamp: new Date().toISOString() });
});

app.get('/health/db', async (req, res, next) => {
  try {
    const userCount = await prisma.user.count();
    const eventCount = await prisma.event.count();
    res.json({
      status: 'UP',
      database: 'PostgreSQL (Docker)',
      counts: { users: userCount, events: eventCount }
    });
  } catch (error) {
    next(error);
  }
});


// Mount Routes
app.use('/api/events', eventRoutes); // <-- Added

// Global Error Handler
app.use(errorHandler);

export default app;
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { correlationMiddleware } from './middlewares/correlationMiddleware.js';
import { errorHandler } from './middlewares/errorHandler.js';
import eventRoutes from './routes/eventRoutes.js';
import { prisma } from './config/db.js';
import { redis } from './config/redis.js';
import authRoutes from './routes/authRoutes.js';
import ticketRoutes from './routes/ticketRoutes.js';

const app = express();

// Trace correlation ID across async execution contexts
app.use(correlationMiddleware);

// Global Middlewares
app.use(helmet({ contentSecurityPolicy: false })); // Security headers (CSP disabled for CDN scripts)
app.use(cors()); // Enable CORS
app.use(express.json()); // Body parser
app.use(express.static('public')); // Serve static frontend

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP', timestamp: new Date().toISOString() });
});

app.get('/health/db', async (req, res, next) => {
  try {
    const userCount = await prisma.user.count();
    const eventCount = await prisma.event.count();
    let redisStatus = 'DOWN';
    let redisPing = null;

    try {
      redisPing = await redis.ping();
      if (redisPing === 'PONG') {
        redisStatus = 'UP';
      }
    } catch (redisErr) {
      console.error('[HealthCheck] Redis ping error:', redisErr.message);
    }

    const isHealthy = redisStatus === 'UP';

    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'UP' : 'DEGRADED',
      database: 'PostgreSQL (Docker)',
      counts: { users: userCount, events: eventCount },
      redis: {
        status: redisStatus,
        ping: redisPing,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/tickets', ticketRoutes);

// Global Error Handler
app.use(errorHandler);

export default app;

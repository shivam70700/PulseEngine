import http from 'http';
import app from './app.js';
import { config } from './config/env.js';
import { initTicketWorker } from './workers/ticketWorker.js';
import { initSocket } from './config/socket.js';
import { prisma } from './config/db.js';
import { redis } from './config/redis.js';

// Wrap Express app in an HTTP server
const httpServer = http.createServer(app);

// Attach Socket.io server with CORS enabled
initSocket(httpServer);

// Initialize background queue worker
const worker = initTicketWorker();

// Graceful Shutdown Handler
let isShuttingDown = false;

const gracefulShutdown = async (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`\n[PulseEngine] Received ${signal}. Starting graceful shutdown...`);

  // Force exit timeout in case cleanup hangs
  const forceExitTimeout = setTimeout(() => {
    console.error('[PulseEngine] Graceful shutdown timed out. Forcing exit.');
    process.exit(1);
  }, 10000);
  forceExitTimeout.unref();

  try {
    // 1. Stop accepting new HTTP connections
    await new Promise((resolve) => {
      httpServer.close((err) => {
        if (err) {
          console.error('[PulseEngine] Error closing HTTP server:', err.message);
        } else {
          console.log('[PulseEngine] HTTP server closed cleanly.');
        }
        resolve();
      });
    });

    // 2. Close BullMQ worker cleanly
    if (worker) {
      console.log('[PulseEngine] Closing BullMQ worker...');
      try {
        await Promise.race([
          worker.close(),
          new Promise((r) => setTimeout(r, 1500)),
        ]);
        console.log('[PulseEngine] BullMQ worker closed cleanly.');
      } catch (err) {
        console.error('[PulseEngine] Error closing BullMQ worker:', err.message);
      }
    }

    // 3. Disconnect Prisma
    try {
      console.log('[PulseEngine] Disconnecting Prisma...');
      await Promise.race([
        prisma.$disconnect(),
        new Promise((r) => setTimeout(r, 1500)),
      ]);
      console.log('[PulseEngine] Prisma disconnected cleanly.');
    } catch (err) {
      console.error('[PulseEngine] Error disconnecting Prisma:', err.message);
    }

    // 4. Disconnect Redis
    try {
      console.log('[PulseEngine] Disconnecting Redis...');
      await Promise.race([
        redis.quit(),
        new Promise((r) => setTimeout(r, 1500)),
      ]);
      console.log('[PulseEngine] Redis connection closed cleanly.');
    } catch (err) {
      console.error('[PulseEngine] Error disconnecting Redis:', err.message);
    }

    console.log('[PulseEngine] Graceful shutdown completed. Exiting.');
    process.exit(0);
  } catch (error) {
    console.error(
      '[PulseEngine] Unexpected error during graceful shutdown:',
      error
    );
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

httpServer.listen(config.port, () => {
  console.log(
    `[PulseEngine] Server running on port ${config.port} in ${config.nodeEnv} mode`
  );
});

export default httpServer;

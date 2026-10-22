import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

export const correlationStorage = new AsyncLocalStorage();

/**
 * Get current correlation ID from AsyncLocalStorage
 * @returns {string|null}
 */
export const getCorrelationId = () => {
  return correlationStorage.getStore() || null;
};

/**
 * Middleware to trace requests with a correlation ID across async execution contexts
 */
export const correlationMiddleware = (req, res, next) => {
  const correlationId =
    req.headers["x-correlation-id"] ||
    req.headers["x-request-id"] ||
    randomUUID();

  // Attach to response headers
  res.setHeader("x-correlation-id", correlationId);

  // Attach to request object for convenience
  req.correlationId = correlationId;

  // Run downstream handlers within AsyncLocalStorage context
  correlationStorage.run(correlationId, () => {
    next();
  });
};

export default correlationMiddleware;

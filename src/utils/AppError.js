/**
 * Custom Error class to handle operational API errors
 */
export class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true; // Distinguishes operational errors from system crashes

    Error.captureStackTrace(this, this.constructor);
  }
}
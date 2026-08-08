import { ZodError } from 'zod';
import { AppError } from '../utils/AppError.js';

/**
 * Higher-order middleware function that validates request data against a Zod schema.
 * @param {import('zod').ZodSchema} schema 
 */
export const validate = (schema) => (req, res, next) => {
  try {
    const parsed = schema.parse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    // Reassign body and params safely
    req.body = parsed.body;
    req.params = parsed.params;

    // Mutate req.query properties safely without reassigning the read-only getter
    if (parsed.query) {
      Object.assign(req.query, parsed.query);
    }

    next();
  } catch (error) {
    if (error instanceof ZodError) {
      const errorMessages = error.issues.map(
        (issue) => `${issue.path.join('.')}: ${issue.message}`
      );
      
      return next(new AppError(`Validation failed: ${errorMessages.join(' | ')}`, 400));
    }
    next(error);
  }
};
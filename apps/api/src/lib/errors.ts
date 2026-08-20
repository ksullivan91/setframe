/**
 * Uniform application error mapped to docs/api.md's error shape:
 * { error: { code, message, requestId } }. Route handlers throw this;
 * the global error handler (see plugins/error-handler.ts) formats it and
 * never leaks stack traces in production.
 */
export class ApiError extends Error {
  statusCode: number;
  code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export const notFound = (message = 'Resource not found') =>
  new ApiError(404, 'NOT_FOUND', message);

export const unauthorized = (message = 'Authentication required') =>
  new ApiError(401, 'UNAUTHORIZED', message);

export const forbidden = (message = 'Not allowed') => new ApiError(403, 'FORBIDDEN', message);

export const badRequest = (message = 'Invalid request') =>
  new ApiError(400, 'VALIDATION_ERROR', message);

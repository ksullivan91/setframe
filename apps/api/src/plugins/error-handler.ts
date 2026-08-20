import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { ApiError } from '../lib/errors';

/**
 * Formats every error into docs/api.md's shape:
 * { error: { code, message, requestId } }. Never leaks stack traces or
 * internal error detail in production (master spec §18).
 */
const errorHandlerPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.setErrorHandler((error: Error & { statusCode?: number }, request, reply) => {
    const requestId = request.id;

    if (error instanceof ApiError) {
      reply.status(error.statusCode).send({
        error: { code: error.code, message: error.message, requestId },
      });
      return;
    }

    // fastify-type-provider-zod validation errors surface with a `code` of
    // FST_ERR_VALIDATION and a 400 statusCode already set by the provider.
    if (error.statusCode && error.statusCode < 500) {
      reply.status(error.statusCode).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message,
          requestId,
        },
      });
      return;
    }

    request.log.error({ err: error }, 'Unhandled error');
    const isProd = process.env.NODE_ENV === 'production';
    reply.status(500).send({
      error: {
        code: 'INTERNAL_ERROR',
        message: isProd ? 'An unexpected error occurred' : error.message,
        requestId,
      },
    });
  });

  fastify.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      error: {
        code: 'NOT_FOUND',
        message: 'Route not found',
        requestId: request.id,
      },
    });
  });
};

export default fp(errorHandlerPlugin);

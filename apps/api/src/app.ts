import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import {
  serializerCompiler,
  validatorCompiler,
  jsonSchemaTransform,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import errorHandlerPlugin from './plugins/error-handler.js';
import authPlugin from './plugins/auth.js';
import { systemRoutes } from './routes/system.js';
import { meRoutes } from './routes/me.js';
import { exerciseRoutes } from './routes/exercises.js';
import { programRoutes } from './routes/programs.js';
import { dayTypeRoutes } from './routes/day-types.js';
import { workoutSessionRoutes } from './routes/workout-sessions.js';
import { dailyRoutes } from './routes/daily.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { progressRoutes } from './routes/progress.js';
import { restDayRoutes } from './routes/rest-days.js';
import { notificationPreferenceRoutes } from './routes/notification-preferences.js';
import { appleHealthRoutes } from './routes/apple-health.js';
import { additionalActivityRoutes } from './routes/additional-activities.js';
import { additionalActivityPresetRoutes } from './routes/additional-activity-presets.js';

function isAllowedOrigin(origin: string, allowedOrigins: string[]) {
  return allowedOrigins.some((allowedOrigin) => {
    if (allowedOrigin.includes('*')) {
      const pattern = allowedOrigin
        .replace(/[-/\^$+?.()|[\]{}]/g, '\\$&')
        .replace(/\\\*/g, '.*');
      return new RegExp(`^${pattern}$`).test(origin);
    }

    return allowedOrigin === origin;
  });
}

export function buildApp() {
  const app = Fastify({
    logger: {
      transport:
        process.env.NODE_ENV === 'production'
          ? undefined
          : { target: 'pino-pretty', options: { singleLine: true } },
    },
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  /**
   * Treat an empty body under `application/json` as no body at all.
   *
   * Fastify's default JSON parser answers 400 FST_ERR_CTP_EMPTY_JSON_BODY
   * when a request declares `Content-Type: application/json` and sends
   * nothing. apps/mobile's fetch wrapper set that header on *every*
   * request, so every bodyless DELETE from the phone was rejected before
   * it reached a handler — "Could not remove activity" — while the same
   * call from apps/web succeeded, because its header is conditional.
   *
   * The client is fixed too, but this stays: a DELETE with no body is a
   * well-formed request whatever content-type a client volunteers, and
   * builds already on testers' phones should not stay broken waiting for
   * an app update. Malformed *non-empty* JSON still fails as before.
   */
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    (_request, body: string, done) => {
      if (body === undefined || body === null || body.length === 0) {
        done(null, undefined);
        return;
      }
      try {
        done(null, JSON.parse(body));
      } catch (error) {
        (error as { statusCode?: number }).statusCode = 400;
        done(error as Error, undefined);
      }
    },
  );

  app.register(errorHandlerPlugin);
  app.register(authPlugin);
  app.register(cors, {
    // ADR 0004: CORS must explicitly allow the Cloudflare Pages web
    // origin(s); wide-open in non-production for local dev convenience.
    // @fastify/cors defaults `methods` to 'GET,HEAD,POST' only, which
    // silently fails PATCH/PUT/DELETE preflights — this API uses all of
    // those, so the full method set must be listed explicitly.
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'PUT', 'DELETE'],
    origin(origin, callback) {
      if (process.env.NODE_ENV !== 'production') {
        callback(null, true);
        return;
      }

      const allowedOrigins = (process.env.CORS_ORIGIN ?? '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);

      if (!origin) {
        callback(null, true);
        return;
      }

      callback(null, isAllowedOrigin(origin, allowedOrigins));
    },
  });
  app.register(helmet);

  app.register(systemRoutes);
  app.register(meRoutes);
  app.register(exerciseRoutes);
  app.register(programRoutes);
  app.register(dayTypeRoutes);
  app.register(workoutSessionRoutes);
  app.register(dailyRoutes);
  app.register(dashboardRoutes);
  app.register(progressRoutes);
  app.register(restDayRoutes);
  app.register(notificationPreferenceRoutes);
  app.register(appleHealthRoutes);
  app.register(additionalActivityRoutes);
  app.register(additionalActivityPresetRoutes);

  return app;
}

export { jsonSchemaTransform };

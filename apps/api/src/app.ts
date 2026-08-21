import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import {
  serializerCompiler,
  validatorCompiler,
  jsonSchemaTransform,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import errorHandlerPlugin from './plugins/error-handler';
import authPlugin from './plugins/auth';
import { systemRoutes } from './routes/system';
import { meRoutes } from './routes/me';
import { exerciseRoutes } from './routes/exercises';
import { programRoutes } from './routes/programs';
import { dayTypeRoutes } from './routes/day-types';
import { workoutSessionRoutes } from './routes/workout-sessions';
import { dailyRoutes } from './routes/daily';
import { dashboardRoutes } from './routes/dashboard';
import { progressRoutes } from './routes/progress';
import { notificationPreferenceRoutes } from './routes/notification-preferences';
import { appleHealthRoutes } from './routes/apple-health';

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

  app.register(errorHandlerPlugin);
  app.register(authPlugin);
  app.register(cors, {
    // ADR 0004: CORS must explicitly allow the Cloudflare Pages web
    // origin(s); wide-open in non-production for local dev convenience.
    origin: process.env.NODE_ENV === 'production' ? (process.env.CORS_ORIGIN?.split(',') ?? []) : true,
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
  app.register(notificationPreferenceRoutes);
  app.register(appleHealthRoutes);

  return app;
}

export { jsonSchemaTransform };

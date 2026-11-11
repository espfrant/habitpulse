import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import type { HabitRepository } from './infrastructure/repositories/habit-repository.js';
import { HabitService, NotFoundError } from './application/habit-service.js';
import { healthRoutes } from './presentation/routes/health-routes.js';
import { habitRoutes } from './presentation/routes/habit-routes.js';

export interface AppDependencies {
  repository: HabitRepository;
  checkDbReadiness?: () => Promise<boolean>;
  corsOrigin?: string | boolean | string[];
}

export async function buildApp(
  deps: AppDependencies,
): Promise<FastifyInstance> {
  const app = Fastify({
    logger: process.env.NODE_ENV === 'test' ? false : true,
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(cors, {
    origin: deps.corsOrigin ?? true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });

  await app.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'HabitPulse API',
        description:
          'Minimalist habit tracker with GitHub-style contribution heatmaps and streak calculations',
        version: '0.1.0',
      },
      servers: [
        {
          url: '/',
          description: 'Local development server',
        },
      ],
    },
    transform: jsonSchemaTransform,
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
  });

  app.setErrorHandler((error: any, request, reply) => {
    if (error instanceof NotFoundError || error.statusCode === 404) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: error.message,
      });
    }

    if (error.statusCode === 400 || error.validation) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: error.message,
      });
    }

    if (error.statusCode) {
      return reply.status(error.statusCode).send({
        statusCode: error.statusCode,
        error: error.name || 'Error',
        message: error.message,
      });
    }

    request.log.error(error);
    return reply.status(500).send({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'An unexpected internal error occurred',
    });
  });

  // Health and readiness routes
  await app.register(healthRoutes, {
    checkDbReadiness: deps.checkDbReadiness,
  });

  // API v1 Habit routes
  const habitService = new HabitService(deps.repository);
  await app.register(habitRoutes, {
    prefix: '/api/v1',
    habitService,
  });

  return app;
}

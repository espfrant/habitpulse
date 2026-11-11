import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';

export interface HealthRouteOptions {
  checkDbReadiness?: () => Promise<boolean>;
}

export const healthRoutes: FastifyPluginAsync<HealthRouteOptions> = async (
  fastify,
  options,
) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.get(
    '/healthz',
    {
      schema: {
        description: 'Liveness probe',
        tags: ['Health'],
        response: {
          200: z.object({
            status: z.literal('ok'),
          }),
        },
      },
    },
    async (_req, reply) => {
      return reply.status(200).send({ status: 'ok' });
    },
  );

  app.get(
    '/readyz',
    {
      schema: {
        description: 'Readiness probe verifying database connectivity',
        tags: ['Health'],
        response: {
          200: z.object({
            status: z.literal('ok'),
          }),
          503: z.object({
            status: z.literal('unhealthy'),
          }),
        },
      },
    },
    async (_req, reply) => {
      let isReady = true;
      if (options.checkDbReadiness) {
        try {
          isReady = await options.checkDbReadiness();
        } catch {
          isReady = false;
        }
      }

      if (isReady) {
        return reply.status(200).send({ status: 'ok' });
      }

      return reply.status(503).send({ status: 'unhealthy' });
    },
  );
};

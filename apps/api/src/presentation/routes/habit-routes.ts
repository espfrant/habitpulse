import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { formatDateToIso } from '../../domain/date-utils.js';
import type { HabitService } from '../../application/habit-service.js';
import {
  createHabitBodySchema,
  dashboardQuerySchema,
  dashboardResponseSchema,
  errorResponseSchema,
  habitDashboardItemSchema,
  habitEntryParamSchema,
  habitIdParamSchema,
  habitResponseSchema,
  heatmapQuerySchema,
  heatmapResponseSchema,
  seedDemoBodySchema,
  seedResponseSchema,
  upsertEntryBodySchema,
  upsertEntryQuerySchema,
  upsertEntryResponseSchema,
} from '../schemas/habit-schemas.js';

export interface HabitRouteOptions {
  habitService: HabitService;
}

export const habitRoutes: FastifyPluginAsync<HabitRouteOptions> = async (
  fastify,
  options,
) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();
  const { habitService } = options;

  app.get(
    '/dashboard',
    {
      schema: {
        description: 'Get dashboard summary metrics and weekly habit matrix',
        tags: ['Dashboard'],
        querystring: dashboardQuerySchema,
        response: {
          200: dashboardResponseSchema,
        },
      },
    },
    async (req, reply) => {
      const date = req.query.date ?? formatDateToIso(new Date());
      const dashboard = await habitService.getDashboard(date);
      return reply.status(200).send(dashboard);
    },
  );

  app.get(
    '/habits',
    {
      schema: {
        description: 'List all habits for the current user',
        tags: ['Habits'],
        response: {
          200: z.array(habitResponseSchema),
        },
      },
    },
    async (_req, reply) => {
      const habits = await habitService.listHabits();
      const formatted = habits.map((h) => ({
        ...h,
        createdAt: h.createdAt.toISOString(),
      }));
      return reply.status(200).send(formatted);
    },
  );

  app.post(
    '/habits',
    {
      schema: {
        description: 'Create a new habit',
        tags: ['Habits'],
        body: createHabitBodySchema,
        response: {
          201: habitResponseSchema,
          400: errorResponseSchema,
        },
      },
    },
    async (req, reply) => {
      const created = await habitService.createHabit(req.body);
      return reply.status(201).send({
        ...created,
        createdAt: created.createdAt.toISOString(),
      });
    },
  );

  app.delete(
    '/habits/:id',
    {
      schema: {
        description: 'Delete a habit and its entries',
        tags: ['Habits'],
        params: habitIdParamSchema,
        response: {
          204: z.null().describe('Habit successfully deleted'),
          404: errorResponseSchema,
        },
      },
    },
    async (req, reply) => {
      await habitService.deleteHabit(req.params.id);
      return reply.status(204).send(null);
    },
  );

  app.put(
    '/habits/:id/entries/:date',
    {
      schema: {
        description: 'Idempotently log or clear progress for a habit date',
        tags: ['Entries'],
        params: habitEntryParamSchema,
        querystring: upsertEntryQuerySchema,
        body: upsertEntryBodySchema,
        response: {
          200: upsertEntryResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (req, reply) => {
      const updated = await habitService.upsertHabitEntry(
        req.params.id,
        req.params.date,
        req.body.value,
        req.query.referenceDate,
      );
      return reply.status(200).send(updated);
    },
  );

  app.get(
    '/habits/:id/heatmap',
    {
      schema: {
        description: 'Get habit contribution heatmap grid and lifetime stats',
        tags: ['Heatmap'],
        params: habitIdParamSchema,
        querystring: heatmapQuerySchema,
        response: {
          200: heatmapResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (req, reply) => {
      const endDate = req.query.endDate ?? formatDateToIso(new Date());
      const days = req.query.days ?? 365;
      const heatmap = await habitService.getHabitHeatmap(
        req.params.id,
        endDate,
        days,
      );
      return reply.status(200).send(heatmap);
    },
  );

  app.post(
    '/demo/seed',
    {
      schema: {
        description: 'Reset and seed demo habits with 365 days of historical data',
        tags: ['Demo'],
        body: seedDemoBodySchema,
        response: {
          200: seedResponseSchema,
        },
      },
    },
    async (req, reply) => {
      const referenceDate =
        req.body?.referenceDate ?? formatDateToIso(new Date());
      const result = await habitService.seedDemoData(referenceDate);
      return reply.status(200).send(result);
    },
  );
};

import { z } from 'zod';
import { CATPPUCCIN_COLORS } from '../../domain/habit.js';

export const catppuccinColorSchema = z.enum(CATPPUCCIN_COLORS);
export const trackingTypeSchema = z.enum(['boolean', 'quantitative']);
export const frequencyTypeSchema = z.enum(['daily', 'weekly']);
export const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted as YYYY-MM-DD');

export const uuidSchema = z
  .string()
  .regex(
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
    'Must be a valid UUID',
  );

export const habitIdParamSchema = z.object({
  id: uuidSchema,
});

export const habitEntryParamSchema = z.object({
  id: uuidSchema,
  date: dateStringSchema,
});

export const dashboardQuerySchema = z.object({
  date: dateStringSchema.optional(),
});

export const upsertEntryQuerySchema = z.object({
  referenceDate: dateStringSchema.optional(),
});

export const heatmapQuerySchema = z.object({
  endDate: dateStringSchema.optional(),
  days: z.coerce.number().int().min(1).max(730).optional().default(365),
});

export const createHabitBodySchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().max(500).nullish(),
    color: catppuccinColorSchema,
    trackingType: trackingTypeSchema,
    targetValue: z.number().int().min(1).optional().default(1),
    unit: z.string().max(32).nullish(),
    frequencyType: frequencyTypeSchema,
    frequencyCount: z.number().int().min(1).max(7).optional().default(1),
  })
  .transform((val) => {
    const isBoolean = val.trackingType === 'boolean';
    return {
      ...val,
      name: val.name.trim(),
      targetValue: isBoolean ? 1 : val.targetValue,
      unit: isBoolean ? null : (val.unit ?? null),
      frequencyCount: val.frequencyType === 'daily' ? 1 : val.frequencyCount,
      description: val.description ?? null,
    };
  });

export const upsertEntryBodySchema = z.object({
  value: z.number().int().min(0),
});

export const seedDemoBodySchema = z
  .object({
    referenceDate: dateStringSchema.optional(),
  })
  .optional();

export const habitResponseSchema = z.object({
  id: uuidSchema,
  userId: uuidSchema.optional(),
  name: z.string(),
  description: z.string().nullable(),
  color: catppuccinColorSchema,
  trackingType: trackingTypeSchema,
  targetValue: z.number(),
  unit: z.string().nullable(),
  frequencyType: frequencyTypeSchema,
  frequencyCount: z.number(),
  createdAt: z.string(),
});

export const weekEntrySchema = z.object({
  date: dateStringSchema,
  value: z.number(),
  completed: z.boolean(),
});

export const habitDashboardItemSchema = habitResponseSchema.extend({
  currentStreak: z.number(),
  bestStreak: z.number(),
  completionRate30d: z.number(),
  totalCompletions: z.number(),
  weekEntries: z.array(weekEntrySchema),
});

export const dashboardSummarySchema = z.object({
  activeDailyStreakSum: z.number(),
  bestActiveStreak: z.number(),
  completedTodayCount: z.number(),
  totalHabitsCount: z.number(),
  monthlyCompletionRate: z.number(),
});

export const dashboardResponseSchema = z.object({
  date: z.string(),
  weekDates: z.array(z.string()),
  summary: dashboardSummarySchema,
  habits: z.array(habitDashboardItemSchema),
});

export const upsertEntryResponseSchema = habitDashboardItemSchema.extend({
  entry: weekEntrySchema,
});

export const heatmapCellSchema = z.object({
  date: z.string(),
  value: z.number(),
  targetValue: z.number(),
  level: z.union([
    z.literal(0),
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
  ]),
});

export const heatmapResponseSchema = z.object({
  habit: habitResponseSchema,
  stats: z.object({
    currentStreak: z.number(),
    bestStreak: z.number(),
    completionRate30d: z.number(),
    totalCompletions: z.number(),
  }),
  cells: z.array(heatmapCellSchema),
});

export const seedResponseSchema = z.object({
  habitsCreated: z.number(),
  entriesCreated: z.number(),
  referenceDate: z.string(),
});

export const errorResponseSchema = z.object({
  statusCode: z.number(),
  error: z.string(),
  message: z.string(),
});

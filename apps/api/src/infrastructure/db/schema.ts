import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  date,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';

export const usersTable = pgTable('users', {
  id: uuid('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  displayName: varchar('display_name', { length: 100 }).notNull(),
  timezone: varchar('timezone', { length: 64 }).notNull().default('UTC'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const habitsTable = pgTable(
  'habits',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 120 }).notNull(),
    description: varchar('description', { length: 500 }),
    color: varchar('color', { length: 32 }).notNull().default('mauve'),
    trackingType: varchar('tracking_type', { length: 16 }).notNull(),
    targetValue: integer('target_value').notNull().default(1),
    unit: varchar('unit', { length: 32 }),
    frequencyType: varchar('frequency_type', { length: 16 }).notNull(),
    frequencyCount: integer('frequency_count').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_habits_user_id').on(table.userId, table.createdAt)],
);

export const habitEntriesTable = pgTable(
  'habit_entries',
  {
    id: uuid('id').primaryKey(),
    habitId: uuid('habit_id')
      .notNull()
      .references(() => habitsTable.id, { onDelete: 'cascade' }),
    entryDate: date('entry_date', { mode: 'string' }).notNull(),
    value: integer('value').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('habit_entries_habit_date_idx').on(table.habitId, table.entryDate)],
);

export type UserRow = InferSelectModel<typeof usersTable>;
export type NewUserRow = InferInsertModel<typeof usersTable>;
export type HabitRow = InferSelectModel<typeof habitsTable>;
export type NewHabitRow = InferInsertModel<typeof habitsTable>;
export type HabitEntryRow = InferSelectModel<typeof habitEntriesTable>;
export type NewHabitEntryRow = InferInsertModel<typeof habitEntriesTable>;

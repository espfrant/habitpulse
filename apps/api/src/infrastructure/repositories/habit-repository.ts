import { and, asc, eq, gte, inArray, lte } from 'drizzle-orm';
import type pg from 'pg';
import {
  DEFAULT_USER_ID,
  type CatppuccinColor,
  type FrequencyType,
  type HabitEntryRecord,
  type HabitProps,
  type TrackingType,
} from '../../domain/habit.js';
import type { DatabaseClient } from '../db/client.js';
import { habitEntriesTable, habitsTable, usersTable, type HabitRow } from '../db/schema.js';
import { generateDemoDataset } from '../seed/demo-seeder.js';

export interface CreateHabitInput {
  userId?: string;
  name: string;
  description?: string | null;
  color: CatppuccinColor;
  trackingType: TrackingType;
  targetValue?: number;
  unit?: string | null;
  frequencyType: FrequencyType;
  frequencyCount?: number;
}

export interface HabitRepository {
  ensureDefaultUser(): Promise<void>;
  listHabits(userId: string): Promise<HabitProps[]>;
  getHabitById(habitId: string, userId: string): Promise<HabitProps | null>;
  createHabit(input: CreateHabitInput): Promise<HabitProps>;
  deleteHabit(habitId: string, userId: string): Promise<boolean>;
  upsertEntry(habitId: string, entryDate: string, value: number): Promise<void>;
  getEntriesForHabits(
    habitIds: string[],
    startDate?: string,
    endDate?: string,
  ): Promise<Map<string, HabitEntryRecord[]>>;
  replaceAllWithDemoData(
    userId: string,
    referenceDate: string,
  ): Promise<{ habitsCreated: number; entriesCreated: number }>;
}

function normalizeHabitInput(input: CreateHabitInput) {
  const isBoolean = input.trackingType === 'boolean';
  const targetValue = isBoolean ? 1 : Math.max(1, input.targetValue ?? 1);
  const unit = isBoolean ? null : (input.unit ?? null);
  const isDaily = input.frequencyType === 'daily';
  const frequencyCount = isDaily ? 1 : Math.max(1, Math.min(7, input.frequencyCount ?? 1));
  const userId = input.userId ?? DEFAULT_USER_ID;
  const description = input.description ?? null;

  return {
    userId,
    name: input.name.trim(),
    description,
    color: input.color,
    trackingType: input.trackingType,
    targetValue,
    unit,
    frequencyType: input.frequencyType,
    frequencyCount,
  };
}

function mapHabitRow(row: HabitRow): HabitProps {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    description: row.description,
    color: row.color as CatppuccinColor,
    trackingType: row.trackingType as TrackingType,
    targetValue: row.targetValue,
    unit: row.unit,
    frequencyType: row.frequencyType as FrequencyType,
    frequencyCount: row.frequencyCount,
    createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt),
  };
}

export class InMemoryHabitRepository implements HabitRepository {
  private users = new Map<string, { id: string; email: string; displayName: string; timezone: string }>();
  private habits = new Map<string, HabitProps>();
  private entries = new Map<string, Map<string, number>>(); // habitId -> (entryDate -> value)

  async ensureDefaultUser(): Promise<void> {
    if (!this.users.has(DEFAULT_USER_ID)) {
      this.users.set(DEFAULT_USER_ID, {
        id: DEFAULT_USER_ID,
        email: 'demo@habitpulse.dev',
        displayName: 'Demo User',
        timezone: 'UTC',
      });
    }
  }

  async listHabits(userId: string): Promise<HabitProps[]> {
    const list: HabitProps[] = [];
    for (const habit of this.habits.values()) {
      if (habit.userId === userId) {
        list.push(habit);
      }
    }
    return list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async getHabitById(habitId: string, userId: string): Promise<HabitProps | null> {
    const habit = this.habits.get(habitId);
    if (!habit || habit.userId !== userId) {
      return null;
    }
    return habit;
  }

  async createHabit(input: CreateHabitInput): Promise<HabitProps> {
    const normalized = normalizeHabitInput(input);
    const id = crypto.randomUUID();
    const habit: HabitProps = {
      id,
      userId: normalized.userId,
      name: normalized.name,
      description: normalized.description,
      color: normalized.color,
      trackingType: normalized.trackingType,
      targetValue: normalized.targetValue,
      unit: normalized.unit,
      frequencyType: normalized.frequencyType,
      frequencyCount: normalized.frequencyCount,
      createdAt: new Date(),
    };
    this.habits.set(id, habit);
    return habit;
  }

  async deleteHabit(habitId: string, userId: string): Promise<boolean> {
    const habit = this.habits.get(habitId);
    if (!habit || habit.userId !== userId) {
      return false;
    }
    this.habits.delete(habitId);
    this.entries.delete(habitId);
    return true;
  }

  async upsertEntry(habitId: string, entryDate: string, value: number): Promise<void> {
    let habitEntries = this.entries.get(habitId);
    if (!habitEntries) {
      habitEntries = new Map<string, number>();
      this.entries.set(habitId, habitEntries);
    }

    if (value <= 0) {
      habitEntries.delete(entryDate);
    } else {
      habitEntries.set(entryDate, value);
    }
  }

  async getEntriesForHabits(
    habitIds: string[],
    startDate?: string,
    endDate?: string,
  ): Promise<Map<string, HabitEntryRecord[]>> {
    const result = new Map<string, HabitEntryRecord[]>();
    for (const habitId of habitIds) {
      const records: HabitEntryRecord[] = [];
      const habitEntries = this.entries.get(habitId);
      if (habitEntries) {
        for (const [dateStr, val] of habitEntries.entries()) {
          if (startDate && dateStr < startDate) continue;
          if (endDate && dateStr > endDate) continue;
          records.push({ entryDate: dateStr, value: val });
        }
      }
      records.sort((a, b) => a.entryDate.localeCompare(b.entryDate));
      result.set(habitId, records);
    }
    return result;
  }

  async replaceAllWithDemoData(
    userId: string,
    referenceDate: string,
  ): Promise<{ habitsCreated: number; entriesCreated: number }> {
    await this.ensureDefaultUser();

    for (const [id, habit] of this.habits.entries()) {
      if (habit.userId === userId) {
        this.habits.delete(id);
        this.entries.delete(id);
      }
    }

    const demo = generateDemoDataset(referenceDate);
    let entriesCreated = 0;

    for (const habitDef of demo.habits) {
      const habit = await this.createHabit({
        userId,
        name: habitDef.name,
        description: habitDef.description,
        color: habitDef.color,
        trackingType: habitDef.trackingType,
        targetValue: habitDef.targetValue,
        unit: habitDef.unit,
        frequencyType: habitDef.frequencyType,
        frequencyCount: habitDef.frequencyCount,
      });

      for (const entry of habitDef.entries) {
        await this.upsertEntry(habit.id, entry.entryDate, entry.value);
        entriesCreated++;
      }
    }

    return {
      habitsCreated: demo.habits.length,
      entriesCreated,
    };
  }
}

export class PostgresHabitRepository implements HabitRepository {
  constructor(
    private db: DatabaseClient,
    private pool?: pg.Pool,
  ) {}

  async ensureDefaultUser(): Promise<void> {
    await this.db
      .insert(usersTable)
      .values({
        id: DEFAULT_USER_ID,
        email: 'demo@habitpulse.dev',
        displayName: 'Demo User',
        timezone: 'UTC',
        createdAt: new Date(),
      })
      .onConflictDoNothing();
  }

  async listHabits(userId: string): Promise<HabitProps[]> {
    const rows = await this.db
      .select()
      .from(habitsTable)
      .where(eq(habitsTable.userId, userId))
      .orderBy(asc(habitsTable.createdAt));

    return rows.map(mapHabitRow);
  }

  async getHabitById(habitId: string, userId: string): Promise<HabitProps | null> {
    const rows = await this.db
      .select()
      .from(habitsTable)
      .where(and(eq(habitsTable.id, habitId), eq(habitsTable.userId, userId)))
      .limit(1);

    return rows.length > 0 ? mapHabitRow(rows[0]!) : null;
  }

  async createHabit(input: CreateHabitInput): Promise<HabitProps> {
    const normalized = normalizeHabitInput(input);
    const id = crypto.randomUUID();
    const now = new Date();

    const [created] = await this.db
      .insert(habitsTable)
      .values({
        id,
        userId: normalized.userId,
        name: normalized.name,
        description: normalized.description,
        color: normalized.color,
        trackingType: normalized.trackingType,
        targetValue: normalized.targetValue,
        unit: normalized.unit,
        frequencyType: normalized.frequencyType,
        frequencyCount: normalized.frequencyCount,
        createdAt: now,
      })
      .returning();

    return mapHabitRow(created!);
  }

  async deleteHabit(habitId: string, userId: string): Promise<boolean> {
    const result = await this.db
      .delete(habitsTable)
      .where(and(eq(habitsTable.id, habitId), eq(habitsTable.userId, userId)))
      .returning({ id: habitsTable.id });

    return result.length > 0;
  }

  async upsertEntry(habitId: string, entryDate: string, value: number): Promise<void> {
    if (value <= 0) {
      await this.db
        .delete(habitEntriesTable)
        .where(
          and(
            eq(habitEntriesTable.habitId, habitId),
            eq(habitEntriesTable.entryDate, entryDate),
          ),
        );
    } else {
      const id = crypto.randomUUID();
      const now = new Date();
      await this.db
        .insert(habitEntriesTable)
        .values({
          id,
          habitId,
          entryDate,
          value,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [habitEntriesTable.habitId, habitEntriesTable.entryDate],
          set: {
            value,
            updatedAt: now,
          },
        });
    }
  }

  async getEntriesForHabits(
    habitIds: string[],
    startDate?: string,
    endDate?: string,
  ): Promise<Map<string, HabitEntryRecord[]>> {
    const result = new Map<string, HabitEntryRecord[]>();
    for (const id of habitIds) {
      result.set(id, []);
    }

    if (habitIds.length === 0) {
      return result;
    }

    const conditions = [inArray(habitEntriesTable.habitId, habitIds)];
    if (startDate) {
      conditions.push(gte(habitEntriesTable.entryDate, startDate));
    }
    if (endDate) {
      conditions.push(lte(habitEntriesTable.entryDate, endDate));
    }

    const rows = await this.db
      .select({
        habitId: habitEntriesTable.habitId,
        entryDate: habitEntriesTable.entryDate,
        value: habitEntriesTable.value,
      })
      .from(habitEntriesTable)
      .where(and(...conditions))
      .orderBy(asc(habitEntriesTable.entryDate));

    for (const row of rows) {
      const list = result.get(row.habitId);
      if (list) {
        list.push({ entryDate: row.entryDate, value: row.value });
      }
    }

    return result;
  }

  async replaceAllWithDemoData(
    userId: string,
    referenceDate: string,
  ): Promise<{ habitsCreated: number; entriesCreated: number }> {
    await this.ensureDefaultUser();

    // Delete existing habits for userId (cascades habit_entries)
    await this.db.delete(habitsTable).where(eq(habitsTable.userId, userId));

    const demo = generateDemoDataset(referenceDate);
    let entriesCreated = 0;

    for (const habitDef of demo.habits) {
      const habit = await this.createHabit({
        userId,
        name: habitDef.name,
        description: habitDef.description,
        color: habitDef.color,
        trackingType: habitDef.trackingType,
        targetValue: habitDef.targetValue,
        unit: habitDef.unit,
        frequencyType: habitDef.frequencyType,
        frequencyCount: habitDef.frequencyCount,
      });

      if (habitDef.entries.length > 0) {
        const entryRows = habitDef.entries.map((e) => ({
          id: crypto.randomUUID(),
          habitId: habit.id,
          entryDate: e.entryDate,
          value: e.value,
          updatedAt: new Date(),
        }));

        // Batch insert in chunks of 200
        for (let i = 0; i < entryRows.length; i += 200) {
          const chunk = entryRows.slice(i, i + 200);
          await this.db.insert(habitEntriesTable).values(chunk);
        }
        entriesCreated += entryRows.length;
      }
    }

    return {
      habitsCreated: demo.habits.length,
      entriesCreated,
    };
  }
}

import { describe, expect, it, beforeEach } from 'vitest';
import { newDb } from 'pg-mem';
import { generateDemoDataset } from '../../src/infrastructure/seed/demo-seeder.js';
import {
  InMemoryHabitRepository,
  PostgresHabitRepository,
  type HabitRepository,
} from '../../src/infrastructure/repositories/habit-repository.js';
import { ensureSchema } from '../../src/infrastructure/db/migrate.js';
import { createDrizzleClient } from '../../src/infrastructure/db/client.js';
import { DEFAULT_USER_ID } from '../../src/domain/habit.js';

describe('generateDemoDataset', () => {
  it('generates 5 curated Catppuccin habits and 365 days of historical entries', () => {
    const dataset = generateDemoDataset('2026-11-11');
    expect(dataset.habits).toHaveLength(5);
    expect(dataset.habits.some((h) => h.trackingType === 'quantitative')).toBe(true);
    expect(dataset.habits.some((h) => h.frequencyType === 'weekly')).toBe(true);
    for (const habit of dataset.habits) {
      expect(habit.entries.length).toBeGreaterThan(100);
      expect(habit.entries.every((e) => e.entryDate <= '2026-11-11')).toBe(true);
    }
  });

  it('is completely deterministic for identical referenceDate', () => {
    const ds1 = generateDemoDataset('2026-11-11');
    const ds2 = generateDemoDataset('2026-11-11');
    expect(ds1).toEqual(ds2);
  });
});

describe.each([
  {
    name: 'InMemoryHabitRepository',
    createRepo: async () => new InMemoryHabitRepository(),
  },
  {
    name: 'PostgresHabitRepository (pg-mem)',
    createRepo: async () => {
      const db = newDb();
      db.public.registerFunction({
        name: 'gen_random_uuid',
        implementation: () => crypto.randomUUID(),
      });
      db.public.registerFunction({
        name: 'now',
        implementation: () => new Date().toISOString(),
      });
      const pg = db.adapters.createPg();
      const pool = new pg.Pool();

      const wrapQuery = (orig: any) => {
        return async function (q: any, v?: any, cb?: any) {
          let rowModeArray = false;
          let config = q;
          if (typeof q === 'string') {
            config = { text: q, values: v };
          }
          if (typeof config === 'object' && config !== null) {
            delete config.types;
            if (config.rowMode === 'array') {
              rowModeArray = true;
              delete config.rowMode;
            }
          }
          const res = await orig(config, v, cb);
          if (rowModeArray && res && Array.isArray(res.rows)) {
            res.rows = res.rows.map((row: any) =>
              Array.isArray(row) ? row : Object.values(row),
            );
          }
          return res;
        };
      };

      pool.query = wrapQuery(pool.query.bind(pool));
      const origConnect = pool.connect.bind(pool);
      pool.connect = async function () {
        const client = await (origConnect as any)();
        client.query = wrapQuery(client.query.bind(client));
        return client;
      };

      await ensureSchema(pool as any);
      const drizzleClient = createDrizzleClient(pool as any);
      return new PostgresHabitRepository(drizzleClient, pool as any);
    },
  },
])('$name contract verification', ({ createRepo }) => {
  let repo: HabitRepository;

  beforeEach(async () => {
    repo = await createRepo();
    await repo.ensureDefaultUser();
  });

  it('coerces boolean targetValue=1 and unit=null regardless of inputs', async () => {
    const habit = await repo.createHabit({
      userId: DEFAULT_USER_ID,
      name: 'Floss Teeth',
      description: 'Daily floss',
      color: 'teal',
      trackingType: 'boolean',
      targetValue: 50, // Should be coerced to 1
      unit: 'times', // Should be coerced to null
      frequencyType: 'daily',
    });

    expect(habit.targetValue).toBe(1);
    expect(habit.unit).toBeNull();
    expect(habit.frequencyCount).toBe(1);
  });

  it('coerces daily frequencyCount=1 regardless of input', async () => {
    const habit = await repo.createHabit({
      userId: DEFAULT_USER_ID,
      name: 'Read Book',
      color: 'sapphire',
      trackingType: 'quantitative',
      targetValue: 20,
      unit: 'pages',
      frequencyType: 'daily',
      frequencyCount: 5, // Should be coerced to 1 for daily
    });

    expect(habit.frequencyCount).toBe(1);
    expect(habit.targetValue).toBe(20);
    expect(habit.unit).toBe('pages');
  });

  it('lists habits for user ordered by creation', async () => {
    const h1 = await repo.createHabit({
      userId: DEFAULT_USER_ID,
      name: 'Habit 1',
      color: 'blue',
      trackingType: 'boolean',
      frequencyType: 'daily',
    });
    const h2 = await repo.createHabit({
      userId: DEFAULT_USER_ID,
      name: 'Habit 2',
      color: 'mauve',
      trackingType: 'quantitative',
      targetValue: 10,
      unit: 'min',
      frequencyType: 'weekly',
      frequencyCount: 3,
    });

    const habits = await repo.listHabits(DEFAULT_USER_ID);
    expect(habits).toHaveLength(2);
    expect(habits.map((h) => h.id)).toContain(h1.id);
    expect(habits.map((h) => h.id)).toContain(h2.id);

    const retrieved = await repo.getHabitById(h1.id, DEFAULT_USER_ID);
    expect(retrieved?.name).toBe('Habit 1');

    // Cross-user access returns null
    const otherUserHabit = await repo.getHabitById(h1.id, '00000000-0000-0000-0000-000000000002');
    expect(otherUserHabit).toBeNull();

    const nonExistent = await repo.getHabitById('00000000-0000-0000-0000-999999999999', DEFAULT_USER_ID);
    expect(nonExistent).toBeNull();
  });

  it('upserts entries and deletes entry when value is 0', async () => {
    const habit = await repo.createHabit({
      userId: DEFAULT_USER_ID,
      name: 'Meditation',
      color: 'green',
      trackingType: 'boolean',
      frequencyType: 'daily',
    });

    // Insert entry
    await repo.upsertEntry(habit.id, '2026-11-10', 1);
    let entriesMap = await repo.getEntriesForHabits([habit.id]);
    expect(entriesMap.get(habit.id)).toEqual([{ entryDate: '2026-11-10', value: 1 }]);

    // Update existing entry with new value
    await repo.upsertEntry(habit.id, '2026-11-10', 2);
    entriesMap = await repo.getEntriesForHabits([habit.id]);
    expect(entriesMap.get(habit.id)).toEqual([{ entryDate: '2026-11-10', value: 2 }]);

    // Upsert value = 0 deletes the entry
    await repo.upsertEntry(habit.id, '2026-11-10', 0);
    entriesMap = await repo.getEntriesForHabits([habit.id]);
    expect(entriesMap.get(habit.id) ?? []).toEqual([]);
  });

  it('filters entries by date range', async () => {
    const habit = await repo.createHabit({
      userId: DEFAULT_USER_ID,
      name: 'Exercise',
      color: 'peach',
      trackingType: 'quantitative',
      targetValue: 30,
      unit: 'min',
      frequencyType: 'daily',
    });

    await repo.upsertEntry(habit.id, '2026-11-01', 30);
    await repo.upsertEntry(habit.id, '2026-11-05', 45);
    await repo.upsertEntry(habit.id, '2026-11-10', 30);

    const filtered = await repo.getEntriesForHabits([habit.id], '2026-11-03', '2026-11-08');
    expect(filtered.get(habit.id)).toEqual([{ entryDate: '2026-11-05', value: 45 }]);

    const startOnly = await repo.getEntriesForHabits([habit.id], '2026-11-05');
    expect(startOnly.get(habit.id)).toEqual([
      { entryDate: '2026-11-05', value: 45 },
      { entryDate: '2026-11-10', value: 30 },
    ]);

    const endOnly = await repo.getEntriesForHabits([habit.id], undefined, '2026-11-05');
    expect(endOnly.get(habit.id)).toEqual([
      { entryDate: '2026-11-01', value: 30 },
      { entryDate: '2026-11-05', value: 45 },
    ]);

    const emptyHabits = await repo.getEntriesForHabits([]);
    expect(emptyHabits.size).toBe(0);
  });

  it('deletes habit and cascades entries while preserving other users habits', async () => {
    const habit = await repo.createHabit({
      userId: DEFAULT_USER_ID,
      name: 'To Delete',
      color: 'red',
      trackingType: 'boolean',
      frequencyType: 'daily',
    });
    await repo.upsertEntry(habit.id, '2026-11-10', 1);

    // Cross-user delete returns false and does not delete
    const crossDelete = await repo.deleteHabit(habit.id, '00000000-0000-0000-0000-000000000002');
    expect(crossDelete).toBe(false);

    const deleted = await repo.deleteHabit(habit.id, DEFAULT_USER_ID);
    expect(deleted).toBe(true);

    const fetched = await repo.getHabitById(habit.id, DEFAULT_USER_ID);
    expect(fetched).toBeNull();

    const notFound = await repo.deleteHabit(habit.id, DEFAULT_USER_ID);
    expect(notFound).toBe(false);
  });

  it('replaceAllWithDemoData resets and populates 5 habits with 365 days of entries', async () => {
    // First create a habit that should be wiped
    await repo.createHabit({
      userId: DEFAULT_USER_ID,
      name: 'Old Habit',
      color: 'rosewater',
      trackingType: 'boolean',
      frequencyType: 'daily',
    });

    const result = await repo.replaceAllWithDemoData(DEFAULT_USER_ID, '2026-11-11');
    expect(result.habitsCreated).toBe(5);
    expect(result.entriesCreated).toBeGreaterThan(500);

    const habits = await repo.listHabits(DEFAULT_USER_ID);
    expect(habits).toHaveLength(5);
    expect(habits.some((h) => h.name === 'Old Habit')).toBe(false);

    const entriesMap = await repo.getEntriesForHabits(habits.map((h) => h.id));
    for (const habit of habits) {
      const entries = entriesMap.get(habit.id) ?? [];
      expect(entries.length).toBeGreaterThan(100);
    }
  });
});

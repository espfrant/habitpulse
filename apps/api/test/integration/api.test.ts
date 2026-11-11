import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { InMemoryHabitRepository } from '../../src/infrastructure/repositories/habit-repository.js';

describe('Fastify REST API integration', () => {
  let app: FastifyInstance;
  let repository: InMemoryHabitRepository;

  beforeEach(async () => {
    repository = new InMemoryHabitRepository();
    await repository.ensureDefaultUser();
    app = await buildApp({
      repository,
      checkDbReadiness: async () => true,
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('Health and Readiness probes', () => {
    it('GET /healthz returns 200 ok', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/healthz',
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ status: 'ok' });
    });

    it('GET /readyz returns 200 when database is healthy', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/readyz',
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ status: 'ok' });
    });

    it('GET /readyz returns 503 when database check fails', async () => {
      const failingApp = await buildApp({
        repository,
        checkDbReadiness: async () => false,
      });
      await failingApp.ready();

      const res = await failingApp.inject({
        method: 'GET',
        url: '/readyz',
      });
      expect(res.statusCode).toBe(503);
      expect(res.json()).toEqual({ status: 'unhealthy' });

      await failingApp.close();
    });
  });

  describe('OpenAPI Documentation', () => {
    it('GET /docs/json returns valid OpenAPI specification', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/docs/json',
      });
      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.openapi).toMatch(/^3\./);
      expect(json.info.title).toBe('HabitPulse API');
      expect(json.paths['/api/v1/dashboard']).toBeDefined();
      expect(json.paths['/api/v1/habits']).toBeDefined();
    });

    it('GET /docs returns Swagger UI HTML', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/docs',
      });
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/html/);
    });
  });

  describe('Habits CRUD & validation', () => {
    it('POST /api/v1/habits creates boolean daily habit', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/habits',
        payload: {
          name: 'Morning Meditation',
          color: 'mauve',
          trackingType: 'boolean',
          frequencyType: 'daily',
        },
      });

      expect(res.statusCode).toBe(201);
      const habit = res.json();
      expect(habit.id).toBeDefined();
      expect(habit.name).toBe('Morning Meditation');
      expect(habit.color).toBe('mauve');
      expect(habit.trackingType).toBe('boolean');
      expect(habit.targetValue).toBe(1);
      expect(habit.unit).toBeNull();
      expect(habit.frequencyType).toBe('daily');
      expect(habit.frequencyCount).toBe(1);
    });

    it('POST /api/v1/habits creates quantitative weekly habit', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/habits',
        payload: {
          name: 'Gym Workout',
          description: 'Strength training',
          color: 'peach',
          trackingType: 'quantitative',
          targetValue: 60,
          unit: 'mins',
          frequencyType: 'weekly',
          frequencyCount: 3,
        },
      });

      expect(res.statusCode).toBe(201);
      const habit = res.json();
      expect(habit.id).toBeDefined();
      expect(habit.name).toBe('Gym Workout');
      expect(habit.description).toBe('Strength training');
      expect(habit.color).toBe('peach');
      expect(habit.trackingType).toBe('quantitative');
      expect(habit.targetValue).toBe(60);
      expect(habit.unit).toBe('mins');
      expect(habit.frequencyType).toBe('weekly');
      expect(habit.frequencyCount).toBe(3);
    });

    it('POST /api/v1/habits coerces boolean targetValue: 50 to 1', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/habits',
        payload: {
          name: 'Hydration',
          color: 'blue',
          trackingType: 'boolean',
          targetValue: 50,
          unit: 'glasses',
          frequencyType: 'daily',
        },
      });

      expect(res.statusCode).toBe(201);
      const habit = res.json();
      expect(habit.targetValue).toBe(1);
      expect(habit.unit).toBeNull();
    });

    it('POST /api/v1/habits rejects invalid frequencyCount: 9 with 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/habits',
        payload: {
          name: 'Overloaded Habit',
          color: 'red',
          trackingType: 'boolean',
          frequencyType: 'weekly',
          frequencyCount: 9,
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('DELETE /api/v1/habits/:id returns 204 for existing habit', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/habits',
        payload: {
          name: 'Habit to Delete',
          color: 'maroon',
          trackingType: 'boolean',
          frequencyType: 'daily',
        },
      });
      const habitId = createRes.json().id;

      const deleteRes = await app.inject({
        method: 'DELETE',
        url: `/api/v1/habits/${habitId}`,
      });
      expect(deleteRes.statusCode).toBe(204);

      const deleteAgainRes = await app.inject({
        method: 'DELETE',
        url: `/api/v1/habits/${habitId}`,
      });
      expect(deleteAgainRes.statusCode).toBe(404);
    });

    it('DELETE /api/v1/habits/:id returns 404 for non-existent habit', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/v1/habits/00000000-0000-0000-0000-000000000999',
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('Habit entries and streaks', () => {
    it('PUT /api/v1/habits/:id/entries/:date idempotently logs progress, updates streak, and value: 0 resets streak', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/habits',
        payload: {
          name: 'Streak Habit',
          color: 'green',
          trackingType: 'boolean',
          frequencyType: 'daily',
        },
      });
      const habitId = createRes.json().id;

      // Log progress on 2026-11-10
      const putRes1 = await app.inject({
        method: 'PUT',
        url: `/api/v1/habits/${habitId}/entries/2026-11-10`,
        payload: { value: 1 },
      });
      expect(putRes1.statusCode).toBe(200);
      const res1Json = putRes1.json();
      expect(res1Json.currentStreak).toBe(1);
      expect(res1Json.entry).toEqual({
        date: '2026-11-10',
        value: 1,
        completed: true,
      });

      // Log progress on 2026-11-11 (today)
      const putRes2 = await app.inject({
        method: 'PUT',
        url: `/api/v1/habits/${habitId}/entries/2026-11-11`,
        payload: { value: 1 },
      });
      expect(putRes2.statusCode).toBe(200);
      const res2Json = putRes2.json();
      expect(res2Json.currentStreak).toBe(2);
      expect(res2Json.bestStreak).toBe(2);

      // Idempotently log progress again
      const putRes3 = await app.inject({
        method: 'PUT',
        url: `/api/v1/habits/${habitId}/entries/2026-11-11`,
        payload: { value: 1 },
      });
      expect(putRes3.statusCode).toBe(200);
      expect(putRes3.json().currentStreak).toBe(2);

      // Reset today to 0 -> clears completion, streak drops back to 1 (from yesterday)
      const putRes4 = await app.inject({
        method: 'PUT',
        url: `/api/v1/habits/${habitId}/entries/2026-11-11`,
        payload: { value: 0 },
      });
      expect(putRes4.statusCode).toBe(200);
      const res4Json = putRes4.json();
      expect(res4Json.entry).toEqual({
        date: '2026-11-11',
        value: 0,
        completed: false,
      });
      // Yesterday is still completed, so active streak is 1
      expect(res4Json.currentStreak).toBe(1);

      // Clear yesterday to 0 -> drops streak back to 0
      const putRes5 = await app.inject({
        method: 'PUT',
        url: `/api/v1/habits/${habitId}/entries/2026-11-10`,
        payload: { value: 0 },
      });
      expect(putRes5.statusCode).toBe(200);
      expect(putRes5.json().currentStreak).toBe(0);
    });

    it('PUT /api/v1/habits/:id/entries/:date returns 404 for non-existent habit', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/v1/habits/00000000-0000-0000-0000-000000000999/entries/2026-11-11',
        payload: { value: 1 },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('Dashboard', () => {
    it('GET /api/v1/dashboard returns summary metrics and 7-day week entries', async () => {
      // Create two habits
      const h1Res = await app.inject({
        method: 'POST',
        url: '/api/v1/habits',
        payload: {
          name: 'Morning Jog',
          color: 'sapphire',
          trackingType: 'boolean',
          frequencyType: 'daily',
        },
      });
      const h1Id = h1Res.json().id;

      const h2Res = await app.inject({
        method: 'POST',
        url: '/api/v1/habits',
        payload: {
          name: 'Read Book',
          color: 'teal',
          trackingType: 'quantitative',
          targetValue: 20,
          unit: 'pages',
          frequencyType: 'daily',
        },
      });
      const h2Id = h2Res.json().id;

      // Mark h1 completed on 2026-11-11 (Wednesday)
      await app.inject({
        method: 'PUT',
        url: `/api/v1/habits/${h1Id}/entries/2026-11-11`,
        payload: { value: 1 },
      });

      // Mark h2 partially completed (10 pages) on 2026-11-11
      await app.inject({
        method: 'PUT',
        url: `/api/v1/habits/${h2Id}/entries/2026-11-11`,
        payload: { value: 10 },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/dashboard?date=2026-11-11',
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.date).toBe('2026-11-11');
      expect(data.weekDates).toEqual([
        '2026-11-09',
        '2026-11-10',
        '2026-11-11',
        '2026-11-12',
        '2026-11-13',
        '2026-11-14',
        '2026-11-15',
      ]);

      expect(data.summary).toEqual({
        activeDailyStreakSum: 1, // h1 is 1, h2 is 0
        bestActiveStreak: 1,
        completedTodayCount: 1, // h1 is completed, h2 is 10/20 (not completed)
        totalHabitsCount: 2,
        monthlyCompletionRate: expect.any(Number),
      });

      expect(data.habits).toHaveLength(2);
      const h1Dashboard = data.habits.find((h: any) => h.id === h1Id);
      expect(h1Dashboard).toBeDefined();
      expect(h1Dashboard.weekEntries).toHaveLength(7);
      const wednesdayEntry = h1Dashboard.weekEntries.find((e: any) => e.date === '2026-11-11');
      expect(wednesdayEntry).toEqual({
        date: '2026-11-11',
        value: 1,
        completed: true,
      });
    });
  });

  describe('Heatmap', () => {
    it('GET /api/v1/habits/:id/heatmap returns 30 cells with levels 0..4', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/habits',
        payload: {
          name: 'Pushups',
          color: 'red',
          trackingType: 'quantitative',
          targetValue: 50,
          unit: 'reps',
          frequencyType: 'daily',
        },
      });
      const habitId = createRes.json().id;

      // Add entries on 2026-11-10 (25 reps = level 2) and 2026-11-11 (50 reps = level 3)
      await app.inject({
        method: 'PUT',
        url: `/api/v1/habits/${habitId}/entries/2026-11-10`,
        payload: { value: 25 },
      });
      await app.inject({
        method: 'PUT',
        url: `/api/v1/habits/${habitId}/entries/2026-11-11`,
        payload: { value: 50 },
      });

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/habits/${habitId}/heatmap?endDate=2026-11-11&days=30`,
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.habit.id).toBe(habitId);
      expect(data.stats).toBeDefined();
      expect(data.cells).toHaveLength(30);

      const cellNov10 = data.cells.find((c: any) => c.date === '2026-11-10');
      const cellNov11 = data.cells.find((c: any) => c.date === '2026-11-11');
      expect(cellNov10).toEqual({
        date: '2026-11-10',
        value: 25,
        targetValue: 50,
        level: 2,
      });
      expect(cellNov11).toEqual({
        date: '2026-11-11',
        value: 50,
        targetValue: 50,
        level: 3,
      });
    });

    it('GET /api/v1/habits/:id/heatmap returns 404 for non-existent habit', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/habits/00000000-0000-0000-0000-000000000999/heatmap',
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('Demo seed', () => {
    it('POST /api/v1/demo/seed populates 5 demo habits and entries', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/demo/seed',
        payload: { referenceDate: '2026-11-11' },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.habitsCreated).toBe(5);
      expect(data.entriesCreated).toBeGreaterThan(100);

      // Verify dashboard now contains 5 habits
      const dashRes = await app.inject({
        method: 'GET',
        url: '/api/v1/dashboard?date=2026-11-11',
      });
      expect(dashRes.statusCode).toBe(200);
      expect(dashRes.json().habits).toHaveLength(5);
    });
  });
});

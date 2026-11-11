# HabitPulse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build HabitPulse, a full-stack habit tracker with a Fastify + Drizzle + PostgreSQL backend, a Catppuccin Mocha/Latte React frontend, automated domain and integration tests, Docker Compose, Kubernetes manifests, and GitHub Actions CI/CD.

**Architecture:** `pnpm` workspace monorepo with `apps/api` (Fastify 5, Drizzle ORM, Zod, OpenAPI 3.1, layered into `domain/`, `application/`, `infrastructure/`, `presentation/`) and `apps/web` (React 19, Vite, TailwindCSS with Catppuccin Mocha/Latte palette, TanStack Query). All streak calculations, completion rates, and 365-day heatmap aggregations are computed in pure domain modules and backed by PostgreSQL `DATE` (`YYYY-MM-DD`) entries with idempotent `UNIQUE (habit_id, entry_date)` upserts.

**Tech Stack:** TypeScript 5.x, Node.js 22, `pnpm`, Fastify 5, `fastify-type-provider-zod`, `@fastify/swagger`, Drizzle ORM (`pg`), Vitest, React 19, Vite, TailwindCSS, TanStack Query, Docker, Kubernetes, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-11-habitpulse-design.md`

## Global Constraints

- TypeScript 5.x with `"strict": true` enabled across all workspaces.
- Default user UUID: `00000000-0000-0000-0000-000000000001` (`demo@habitpulse.dev`).
- Allowed Catppuccin accent tokens: `rosewater`, `flamingo`, `pink`, `mauve`, `red`, `maroon`, `peach`, `yellow`, `green`, `teal`, `sky`, `sapphire`, `blue`, `lavender`.
- All calendar dates (`entry_date`, query parameters `date` and `endDate`) use strict `YYYY-MM-DD` strings; never shift calendar dates via UTC timestamp conversions.
- For `boolean` habits, `target_value` is coerced to `1` and `unit` to `null`. For `daily` habits, `frequency_count` is coerced to `1`.

## Review Focus

1. **Duplicate / out-of-order entries or `value = 0` upserts on the same date:** Upserting `value: 0` on an existing completed date must immediately drop that date from completed status and recompute the streak without leaving stale counts.
2. **Morning streak preservation (`referenceDate` not yet logged):** Checking dashboard at 08:00 AM before logging today's entry must preserve an active daily streak from `referenceDate - 1 day` and an active weekly streak from the previous ISO week if the current week is still in progress.
3. **Invalid habit combinations on creation:** Submitting a `boolean` habit with `targetValue: 50` or a `weekly` habit with `frequencyCount: 9` must either coerce boolean target to `1` or reject invalid `frequencyCount > 7` with HTTP `400`.
4. **Leap-year and year-boundary ISO weeks (e.g. Dec 29 – Jan 4):** Weekly streak calculation across December–January boundaries must group days by continuous Monday-anchored 7-day ISO weeks rather than splitting by `(year, weekNumber)` discontinuities.
5. **Non-existent habit UUID in `DELETE /api/v1/habits/:id`, `PUT /api/v1/habits/:id/entries/:date`, or `GET /api/v1/habits/:id/heatmap`:** Must return HTTP `404` with a structured error payload rather than `500` or silent success.

---

### Task 1: Monorepo Root, Domain Entities, and Streak/Heatmap Calculator (TDD)

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/vitest.config.ts`
- Create: `apps/api/src/domain/habit.ts`
- Create: `apps/api/src/domain/date-utils.ts`
- Create: `apps/api/src/domain/streak-calculator.ts`
- Test: `apps/api/test/unit/streak-calculator.test.ts`

**Interfaces:**
- Consumes: none (foundational task)
- Produces:
  - `CATPPUCCIN_COLORS`: `readonly ['rosewater', 'flamingo', 'pink', 'mauve', 'red', 'maroon', 'peach', 'yellow', 'green', 'teal', 'sky', 'sapphire', 'blue', 'lavender']`
  - `CatppuccinColor`, `TrackingType` (`'boolean' | 'quantitative'`), `FrequencyType` (`'daily' | 'weekly'`)
  - `HabitProps`: `{ id: string; userId: string; name: string; description: string | null; color: CatppuccinColor; trackingType: TrackingType; targetValue: number; unit: string | null; frequencyType: FrequencyType; frequencyCount: number; createdAt: Date }`
  - `HabitEntryRecord`: `{ entryDate: string; value: number }`
  - `HeatmapCell`: `{ date: string; value: number; targetValue: number; level: 0 | 1 | 2 | 3 | 4 }`
  - `HabitStats`: `{ currentStreak: number; bestStreak: number; completionRate30d: number; totalCompletions: number }`
  - `calculateHabitStats(habit: Pick<HabitProps, 'trackingType' | 'targetValue' | 'frequencyType' | 'frequencyCount'>, entries: HabitEntryRecord[], referenceDate: string): HabitStats`
  - `buildHeatmapGrid(habit: Pick<HabitProps, 'targetValue'>, entries: HabitEntryRecord[], endDate: string, days?: number): HeatmapCell[]`
  - `getIsoWeekDates(referenceDate: string): string[]` (returns 7 `YYYY-MM-DD` strings from Monday to Sunday of the week containing `referenceDate`)

- [ ] **Step 1: Scaffold monorepo root and `apps/api` package configuration**

Create `pnpm-workspace.yaml` with `packages: ["apps/*"]`, root `package.json` with scripts `build`, `test`, `lint`, `typecheck`, `dev`, `tsconfig.base.json` with `"strict": true`, `.gitignore`, and `apps/api/package.json` with `vitest`, `typescript`, `@types/node`. Install dependencies with `pnpm install`.

- [ ] **Step 2: Write the failing unit tests for domain streak, completion rate, and heatmap calculation**

In `apps/api/test/unit/streak-calculator.test.ts`, write tests asserting:
```ts
import { describe, expect, it } from 'vitest';
import {
  buildHeatmapGrid,
  calculateHabitStats,
  getIsoWeekDates,
} from '../../src/domain/streak-calculator.js';

describe('streak-calculator domain logic', () => {
  it('computes daily streak when today is completed', () => {
    const stats = calculateHabitStats(
      { trackingType: 'boolean', targetValue: 1, frequencyType: 'daily', frequencyCount: 1 },
      [
        { entryDate: '2026-11-09', value: 1 },
        { entryDate: '2026-11-10', value: 1 },
        { entryDate: '2026-11-11', value: 1 },
      ],
      '2026-11-11',
    );
    expect(stats.currentStreak).toBe(3);
    expect(stats.bestStreak).toBe(3);
    expect(stats.totalCompletions).toBe(3);
  });

  it('preserves active daily streak in the morning when yesterday was completed but today has no entry yet', () => {
    const stats = calculateHabitStats(
      { trackingType: 'quantitative', targetValue: 20, frequencyType: 'daily', frequencyCount: 1 },
      [
        { entryDate: '2026-11-09', value: 20 },
        { entryDate: '2026-11-10', value: 25 },
      ],
      '2026-11-11',
    );
    expect(stats.currentStreak).toBe(2);
    expect(stats.bestStreak).toBe(2);
  });

  it('ignores entries with value = 0 or below targetValue when computing streaks', () => {
    const stats = calculateHabitStats(
      { trackingType: 'quantitative', targetValue: 20, frequencyType: 'daily', frequencyCount: 1 },
      [
        { entryDate: '2026-11-09', value: 20 },
        { entryDate: '2026-11-10', value: 0 },
        { entryDate: '2026-11-11', value: 15 },
      ],
      '2026-11-11',
    );
    expect(stats.currentStreak).toBe(0);
    expect(stats.bestStreak).toBe(1);
    expect(stats.totalCompletions).toBe(1);
  });

  it('computes weekly streak across year boundaries (Dec–Jan ISO weeks)', () => {
    // 2025-12-22..2025-12-28 (Week 1: 3 completions)
    // 2025-12-29..2026-01-04 (Week 2 crossing New Year: 3 completions)
    // 2026-01-05..2026-01-11 (Current week on 2026-01-07: 1 completion so far, still in progress)
    const stats = calculateHabitStats(
      { trackingType: 'boolean', targetValue: 1, frequencyType: 'weekly', frequencyCount: 3 },
      [
        { entryDate: '2025-12-22', value: 1 },
        { entryDate: '2025-12-24', value: 1 },
        { entryDate: '2025-12-26', value: 1 },
        { entryDate: '2025-12-29', value: 1 },
        { entryDate: '2025-12-31', value: 1 },
        { entryDate: '2026-01-02', value: 1 },
        { entryDate: '2026-01-05', value: 1 },
      ],
      '2026-01-07',
    );
    expect(stats.currentStreak).toBe(2);
    expect(stats.bestStreak).toBe(2);
  });

  it('maps heatmap intensity levels 0..4 accurately', () => {
    const grid = buildHeatmapGrid(
      { targetValue: 20 },
      [
        { entryDate: '2026-11-08', value: 0 },
        { entryDate: '2026-11-09', value: 5 },   // 25% -> level 1
        { entryDate: '2026-11-10', value: 10 },  // 50% -> level 2
        { entryDate: '2026-11-11', value: 20 },  // 100% -> level 3
        { entryDate: '2026-11-12', value: 30 },  // 150% -> level 4
      ],
      '2026-11-12',
      5,
    );
    expect(grid.map((c) => c.level)).toEqual([0, 1, 2, 3, 4]);
  });

  it('returns Monday..Sunday dates for getIsoWeekDates', () => {
    expect(getIsoWeekDates('2026-11-11')).toEqual([
      '2026-11-09',
      '2026-11-10',
      '2026-11-11',
      '2026-11-12',
      '2026-11-13',
      '2026-11-14',
      '2026-11-15',
    ]);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @habitpulse/api test`
Expected: FAIL with module not found `../../src/domain/streak-calculator.js`.

- [ ] **Step 4: Implement `habit.ts`, `date-utils.ts`, and `streak-calculator.ts`**

Implement pure UTC-noon or integer day arithmetic on `YYYY-MM-DD` strings in `apps/api/src/domain/date-utils.ts` (converting `YYYY-MM-DD` to `Date.UTC(y, m - 1, d)` so timezone shifts never occur), `apps/api/src/domain/habit.ts` with the domain types and `DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001'`, and `apps/api/src/domain/streak-calculator.ts` implementing `calculateHabitStats`, `buildHeatmapGrid`, and `getIsoWeekDates`.
Intensity level rule in `buildHeatmapGrid`:
- `value <= 0` -> `0`
- `value / targetValue < 0.5` -> `1`
- `value / targetValue < 1` -> `2`
- `value === targetValue` (or `ratio === 1`) -> `3`
- `value > targetValue` -> `4`

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @habitpulse/api test`
Expected: PASS (6 passed).

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json .gitignore apps/api
git commit -m "feat(domain): add habit entities and streak/heatmap calculator with unit tests"
```

---

### Task 2: Database Layer, Drizzle Schema, Repository, and Demo Seeder

**Files:**
- Create: `apps/api/src/infrastructure/db/schema.ts`
- Create: `apps/api/src/infrastructure/db/client.ts`
- Create: `apps/api/src/infrastructure/db/migrate.ts`
- Create: `apps/api/src/infrastructure/repositories/habit-repository.ts`
- Create: `apps/api/src/infrastructure/seed/demo-seeder.ts`
- Test: `apps/api/test/unit/demo-seeder.test.ts`

**Interfaces:**
- Consumes: `HabitProps`, `HabitEntryRecord`, `CatppuccinColor`, `TrackingType`, `FrequencyType`, `DEFAULT_USER_ID` from `apps/api/src/domain/habit.ts`
- Produces:
  - `usersTable`, `habitsTable`, `habitEntriesTable` in `apps/api/src/infrastructure/db/schema.ts`
  - `CreateHabitInput`: `{ userId?: string; name: string; description?: string | null; color: CatppuccinColor; trackingType: TrackingType; targetValue?: number; unit?: string | null; frequencyType: FrequencyType; frequencyCount?: number }`
  - `HabitRepository` interface & `PostgresHabitRepository` class + `InMemoryHabitRepository` (for fast isolated testing when needed alongside Postgres):
    - `ensureDefaultUser(): Promise<void>`
    - `listHabits(userId: string): Promise<HabitProps[]>`
    - `getHabitById(habitId: string, userId: string): Promise<HabitProps | null>`
    - `createHabit(input: CreateHabitInput): Promise<HabitProps>`
    - `deleteHabit(habitId: string, userId: string): Promise<boolean>`
    - `upsertEntry(habitId: string, entryDate: string, value: number): Promise<void>`
    - `getEntriesForHabits(habitIds: string[], startDate?: string, endDate?: string): Promise<Map<string, HabitEntryRecord[]>>`
    - `replaceAllWithDemoData(userId: string, referenceDate: string): Promise<{ habitsCreated: number; entriesCreated: number }>`
  - `generateDemoDataset(referenceDate: string)` in `apps/api/src/infrastructure/seed/demo-seeder.ts`

- [ ] **Step 1: Add Drizzle ORM and `pg` dependencies to `apps/api`**

Add `drizzle-orm`, `pg`, `@types/pg`, `drizzle-kit` (dev), and `pg-mem` (dev, for instant SQL-backed integration tests alongside real Postgres when `DATABASE_URL` is provided).

- [ ] **Step 2: Write the failing test for deterministic demo dataset generation**

In `apps/api/test/unit/demo-seeder.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { generateDemoDataset } from '../../src/infrastructure/seed/demo-seeder.js';

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
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @habitpulse/api test`
Expected: FAIL with module not found `demo-seeder.js`.

- [ ] **Step 4: Implement Drizzle schema, schema bootstrapper, `PostgresHabitRepository`, and `demo-seeder.ts`**

- In `apps/api/src/infrastructure/db/schema.ts`, define `usersTable`, `habitsTable`, and `habitEntriesTable` matching section 5.2 of the spec, with `uniqueIndex('habit_entries_habit_date_idx').on(table.habitId, table.entryDate)`.
- In `apps/api/src/infrastructure/db/migrate.ts`, export `ensureSchema(pool: pg.Pool): Promise<void>` executing idempotent `CREATE TABLE IF NOT EXISTS` and `CREATE UNIQUE INDEX IF NOT EXISTS` statements for `users`, `habits`, and `habit_entries` so both production startup and test databases initialize cleanly without external CLI friction.
- In `apps/api/src/infrastructure/repositories/habit-repository.ts`, implement `PostgresHabitRepository` using Drizzle queries (`onConflictDoUpdate` on `(habit_id, entry_date)` when `value > 0`, and `DELETE` when `value === 0`). Normalize `targetValue = 1, unit = null` when `trackingType === 'boolean'` and `frequencyCount = 1` when `frequencyType === 'daily'`.
- In `apps/api/src/infrastructure/seed/demo-seeder.ts`, implement deterministic PRNG-based 365-day history generation for 5 habits (`Deep Work Architecture`, `Read 20 Technical Pages`, `Strength Training`, `Mindfulness Meditation`, `Hydration (ml)`).

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @habitpulse/api test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add pnpm-lock.yaml apps/api
git commit -m "feat(infra): add Drizzle PostgreSQL schema, habit repository, and demo seeder"
```

---

### Task 3: Application Service, Fastify REST API, Zod Schemas, OpenAPI, and Integration Tests

**Files:**
- Create: `apps/api/src/application/habit-service.ts`
- Create: `apps/api/src/presentation/schemas/habit-schemas.ts`
- Create: `apps/api/src/presentation/routes/habit-routes.ts`
- Create: `apps/api/src/presentation/routes/health-routes.ts`
- Create: `apps/api/src/config/env.ts`
- Create: `apps/api/src/app.ts`
- Create: `apps/api/src/server.ts`
- Test: `apps/api/test/integration/api.test.ts`

**Interfaces:**
- Consumes: `HabitRepository`, `calculateHabitStats`, `buildHeatmapGrid`, `getIsoWeekDates`
- Produces:
  - `HabitService` in `apps/api/src/application/habit-service.ts`:
    - `getDashboard(referenceDate: string)`
    - `createHabit(input: CreateHabitInput)`
    - `deleteHabit(habitId: string)`
    - `upsertHabitEntry(habitId: string, date: string, value: number, referenceDate?: string)`
    - `getHabitHeatmap(habitId: string, endDate: string, days: number)`
    - `seedDemoData(referenceDate: string)`
  - `buildApp(deps: { repository: HabitRepository; checkDbReadiness?: () => Promise<boolean> })` in `apps/api/src/app.ts`
  - REST endpoints matching spec section 5.4:
    - `GET /healthz`
    - `GET /readyz`
    - `GET /docs/json` & `GET /docs`
    - `GET /api/v1/dashboard?date=YYYY-MM-DD`
    - `POST /api/v1/habits`
    - `DELETE /api/v1/habits/:id`
    - `PUT /api/v1/habits/:id/entries/:date`
    - `GET /api/v1/habits/:id/heatmap?endDate=YYYY-MM-DD&days=365`
    - `POST /api/v1/demo/seed`

- [ ] **Step 1: Install Fastify, Zod, Swagger, and CORS packages in `apps/api`**

Install `fastify`, `@fastify/cors`, `@fastify/swagger`, `@fastify/swagger-ui`, `fastify-type-provider-zod`, `zod`.

- [ ] **Step 2: Write the failing API integration tests in `apps/api/test/integration/api.test.ts`**

Write comprehensive integration tests exercising:
1. `GET /healthz` and `GET /readyz` return `200`.
2. `POST /api/v1/habits` creates boolean/daily and quantitative/weekly habits; rejects invalid `frequencyCount: 9` with `400`; coerces boolean `targetValue: 50` to `1`.
3. `PUT /api/v1/habits/:id/entries/:date` idempotently logs progress, updates `currentStreak`, and setting `value: 0` clears the completion and drops the streak back to `0`.
4. `GET /api/v1/dashboard?date=2026-11-11` returns summary metrics and the 7-day Monday–Sunday week entries for each habit.
5. `GET /api/v1/habits/:id/heatmap?endDate=2026-11-11&days=30` returns 30 cells with levels `0..4`.
6. `DELETE /api/v1/habits/:id` returns `204` for an existing habit and `404` for a non-existent UUID (`00000000-0000-0000-0000-000000000999`).
7. `POST /api/v1/demo/seed` populates the 5 demo habits and returns `{ habitsCreated: 5, ... }`.

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @habitpulse/api test`
Expected: FAIL with `Cannot find module '../../src/app.js'`.

- [ ] **Step 4: Implement `HabitService`, Zod schemas, Fastify routes, `app.ts`, and `server.ts`**

- Implement `NotFoundError` in `apps/api/src/application/habit-service.ts` mapped to HTTP `404` in Fastify's error handler.
- Register `fastify-type-provider-zod`, `@fastify/swagger`, `@fastify/swagger-ui` (mounted at `/docs`), and `@fastify/cors` in `apps/api/src/app.ts`.
- Implement `apps/api/src/server.ts` with `ensureSchema`, `ensureDefaultUser`, and graceful `SIGINT`/`SIGTERM` shutdown.

- [ ] **Step 5: Run tests and typecheck to verify they pass**

Run: `pnpm --filter @habitpulse/api test && pnpm --filter @habitpulse/api typecheck`
Expected: PASS (all unit and integration tests green, zero TypeScript errors).

- [ ] **Step 6: Commit**

```bash
git add pnpm-lock.yaml apps/api
git commit -m "feat(api): implement Fastify REST API, Zod schemas, OpenAPI docs, and integration tests"
```

---

### Task 4: Frontend SPA (`apps/web`) with Catppuccin Mocha & Latte UI

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/index.html`
- Create: `apps/web/src/index.css`
- Create: `apps/web/src/theme/catppuccin.ts`
- Create: `apps/web/src/api/client.ts`
- Create: `apps/web/src/components/Header.tsx`
- Create: `apps/web/src/components/SummaryCards.tsx`
- Create: `apps/web/src/components/WeeklyHabitMatrix.tsx`
- Create: `apps/web/src/components/AnnualHeatmap.tsx`
- Create: `apps/web/src/components/NewHabitModal.tsx`
- Create: `apps/web/src/App.tsx`
- Create: `apps/web/src/main.tsx`
- Test: `apps/web/test/App.test.tsx`

**Interfaces:**
- Consumes: REST API endpoints from Task 3 (`/api/v1/dashboard`, `/api/v1/habits`, `/api/v1/habits/:id/entries/:date`, `/api/v1/habits/:id/heatmap`, `/api/v1/demo/seed`)
- Produces:
  - Interactive Catppuccin Mocha (default) & Latte dashboard SPA
  - Theme persistence in `localStorage` under key `'habitpulse-theme'` (`'mocha' | 'latte'`)
  - Habit creation modal supporting boolean & quantitative tracking types, daily & weekly frequencies, and 14 Catppuccin accent colors
  - Interactive weekly habit matrix (toggle boolean habits or enter/increment quantitative progress, select habit for heatmap, delete habit)
  - 365-day GitHub-style consistency heatmap tinted with the selected habit's Catppuccin accent color

- [ ] **Step 1: Scaffold `apps/web` with React 19, Vite, TailwindCSS, TanStack Query, Lucide React, and Vitest + Testing Library**

Create `apps/web/package.json`, `vite.config.ts` (with `/api` proxy to `http://localhost:3000` in dev and `jsdom` test environment), `tsconfig.json`, and `index.html`. Install dependencies with `pnpm install`.

- [ ] **Step 2: Write the failing component tests in `apps/web/test/App.test.tsx`**

Write tests verifying:
1. Renders dashboard summary metrics, habit rows, and switches between Catppuccin `Mocha` and `Latte` themes.
2. Opens the "New Habit" modal, validates inputs, and triggers `createHabit`.
3. Clicking a day cell in the weekly habit matrix calls `upsertHabitEntry` and clicking delete calls `deleteHabit`.

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @habitpulse/web test`
Expected: FAIL with module not found `../src/App.js`.

- [ ] **Step 4: Implement Catppuccin theme tokens, API client, and UI components**

- Define exact Catppuccin Mocha (`#1e1e2e`, `#181825`, `#313244`, `#cdd6f4`, `#a6adc8`) and Latte (`#eff1f5`, `#e6e9ef`, `#ccd0da`, `#4c4f69`, `#6c6f85`) CSS custom properties and all 14 accent colors in `apps/web/src/index.css` and `apps/web/src/theme/catppuccin.ts`.
- Implement `Header.tsx`, `SummaryCards.tsx`, `WeeklyHabitMatrix.tsx`, `AnnualHeatmap.tsx`, `NewHabitModal.tsx`, and `App.tsx`.

- [ ] **Step 5: Run tests, typecheck, and production Vite build to verify they pass**

Run: `pnpm --filter @habitpulse/web test && pnpm --filter @habitpulse/web typecheck && pnpm --filter @habitpulse/web build`
Expected: PASS and clean production bundle in `apps/web/dist`.

- [ ] **Step 6: Commit**

```bash
git add pnpm-lock.yaml apps/web
git commit -m "feat(web): build Catppuccin Mocha/Latte habit dashboard, weekly matrix, and 365-day heatmap"
```

---

### Task 5: Docker, Kubernetes Manifests, GitHub Actions CI/CD, and Portfolio README

**Files:**
- Create: `apps/api/Dockerfile`
- Create: `apps/web/Dockerfile`
- Create: `apps/web/nginx.conf`
- Create: `docker-compose.yml`
- Create: `.dockerignore`
- Create: `k8s/00-namespace.yaml`
- Create: `k8s/01-postgres.yaml`
- Create: `k8s/02-api.yaml`
- Create: `k8s/03-web.yaml`
- Create: `k8s/04-ingress.yaml`
- Create: `.github/workflows/ci.yml`
- Create: `README.md`

**Interfaces:**
- Consumes: `apps/api` and `apps/web` build artifacts, `/healthz` and `/readyz` probes
- Produces:
  - Multi-stage Dockerfiles for API and Web (Nginx reverse-proxying `/api` and `/docs` to `api:3000`)
  - `docker-compose.yml` running `postgres:16-alpine`, `api`, and `web`
  - Kubernetes manifests (`k8s/`) with liveness/readiness probes and resource limits
  - `.github/workflows/ci.yml` running PostgreSQL 16 service container, typecheck, unit & integration tests, and build verification
  - Comprehensive bilingual/portfolio-grade `README.md` with architecture diagrams, domain design notes, API reference, and quickstart guide

- [ ] **Step 1: Create Dockerfiles, `nginx.conf`, `.dockerignore`, and `docker-compose.yml`**

Configure multi-stage builds using `node:22-alpine` and `nginx:1.27-alpine`, exposing the web app on `http://localhost:8080` and API on `http://localhost:3000`.

- [ ] **Step 2: Create Kubernetes manifests in `k8s/` and GitHub Actions workflow in `.github/workflows/ci.yml`**

Wire `/healthz` as `livenessProbe` and `/readyz` as `readinessProbe` in `k8s/02-api.yaml`. Configure `.github/workflows/ci.yml` with a `postgres:16-alpine` service container and full workspace verification.

- [ ] **Step 3: Write `README.md` showcasing architecture, domain complexity, Catppuccin palette, and DevOps setup**

Include Mermaid architecture & ER diagrams, streak math explanation, local dev commands, Docker Compose usage, and Kubernetes deployment instructions.

- [ ] **Step 4: Run full workspace verification (`pnpm typecheck`, `pnpm test`, `pnpm build`)**

Run: `pnpm typecheck && pnpm test && pnpm build`
Expected: PASS across all workspaces (`@habitpulse/api` and `@habitpulse/web`).

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "chore(devops): add Docker Compose, Kubernetes manifests, GitHub Actions CI, and portfolio README"
```

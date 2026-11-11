# HabitPulse — Design Specification

- **Date:** 2026-11-11
- **Status:** Approved
- **Repository:** `/home/espfrant/Work/habitpulse`

---

## 1. Intent & The Why

**HabitPulse** serves two tightly aligned purposes:
1. **Personal Daily Tool:** A clean, distraction-free web application to track daily and weekly habits, visualize streaks and annual consistency heatmaps, and add or remove habits at any time, styled with a minimalist **Catppuccin** color palette.
2. **Backend Software Engineering Portfolio & AI-Assisted Engineering Showcase:** A flagship GitHub repository for backend software engineering interviews. Rather than embedding LLM API wrappers inside the product, AI-assisted engineering is demonstrated through the **engineering rigor of the repository itself**: clean architecture, non-trivial domain modeling (streak calculation across daily/weekly windows, timezone-aware date boundaries, quantitative & boolean goals, SQL heatmap aggregations), strict end-to-end TypeScript typing, automated unit + real-database integration tests, OpenAPI documentation, Docker multi-stage builds, Kubernetes manifests, and GitHub Actions CI/CD.

---

## 2. Goals, Non-Goals & Anti-Goals

### Goals
- **Frictionless Habit Management:** Create, list, view progress, and delete habits at any time.
- **Rich Domain Logic:**
  - Support two habit tracking types:
    - `boolean`: Done / Not done for a given date.
    - `quantitative`: Numeric progress toward a daily target (e.g., "Read 20 pages", target `20`, unit `pages`).
  - Support two frequency rules:
    - `daily`: Expected every day.
    - `weekly`: Expected $N$ days per ISO week ($1 \le N \le 7$, e.g., "Gym 3x/week").
  - Compute **Current Streak**, **Best Streak**, **Completion Rate (Last 30 Days)**, and **365-Day Heatmap Grid** accurately on the backend.
- **Single-User Mode with Multi-Tenant Schema & One-Click Demo Seed:**
  - No login wall so recruiters and the user can immediately interact with the app upon starting it.
  - Database tables include `user_id` referencing a default user (`00000000-0000-0000-0000-000000000001`) to demonstrate multi-tenant relational modeling.
  - An idempotent **"Load / Reset Demo Data"** endpoint and UI button (`POST /api/v1/demo/seed`) populates realistic habits and 12 months of historical entries so the heatmap and streaks look rich out of the box.
- **Catppuccin Minimalist UI:**
  - Support **Catppuccin Mocha** (dark, default) and **Catppuccin Latte** (light) themes, persisted in `localStorage`.
  - Clean single-page dashboard showing summary metrics, the weekly habit tracker grid, a GitHub-style annual consistency heatmap, and a modal/drawer to create habits.
- **Production-Grade Backend & DevOps:**
  - Separate REST API (`apps/api`) and SPA frontend (`apps/web`) in a `pnpm` monorepo.
  - OpenAPI 3.1 / Swagger UI auto-generated from Zod schemas at `/docs`.
  - Health and readiness endpoints (`/healthz`, `/readyz`) for Kubernetes probes.
  - Docker Compose for 1-command local startup (`docker compose up --build`), Kubernetes manifests (`k8s/`), and GitHub Actions CI pipeline.

### Non-Goals
- **Authentication / Login Flows:** Explicitly excluded per user decision (Option 1: Single-user with integrated Demo mode and `user_id` schema readiness).
- **In-App AI / LLM Chatbots:** No OpenAI/Gemini API keys or chat widgets inside the product.
- **Push Notifications / Email Reminders / Mobile Native Apps:** Out of scope to keep focus on core backend architecture and minimalist web UI.
- **Social / Leaderboards / Sharing:** Strictly a personal tracker.

### Anti-Goals (What Would Make This a Failure Even If It Works)
- **Anemic Tutorial-Style Backend:** Putting all SQL queries and streak math inside route handlers or frontend components. All streak and aggregation rules must live in a well-tested backend Domain/Application layer.
- **Cluttered UI:** Overloading the screen with charts, gamification badges, or non-Catppuccin colors.
- **Flaky or Mock-Only Database Tests:** Relying exclusively on mocked ORMs instead of testing SQL queries and migrations against PostgreSQL.

---

## 3. Constraints

- **Language & Runtime:** TypeScript 5.x (strict mode enabled across the entire monorepo), Node.js 22 LTS, `pnpm` workspaces.
- **Database:** PostgreSQL 16.
- **Terminal-First Workflow:** The developer works from the terminal; all build, test, lint, migration, seed, and container commands must be operable via standard CLI scripts (`pnpm test`, `pnpm dev`, `docker compose up`).

---

## 4. Approaches Considered

### Approach A: Fastify + Drizzle ORM + Zod + React (Vite) Monorepo *(Selected)*
- **Stack:**
  - `apps/api`: Fastify 5 + `fastify-type-provider-zod` + `@fastify/swagger` + Drizzle ORM (`drizzle-orm/node-postgres`) + Pino logger.
  - `apps/web`: React 19 + Vite + TailwindCSS + Catppuccin palette + TanStack Query + Lucide icons.
  - `packages/shared` (or shared Zod contracts): Shared TypeScript types/schemas if needed, while keeping API decoupled.
  - Testing: Vitest + Testcontainers PostgreSQL (with fallback to a local/CI Postgres service container via `DATABASE_URL`).
- **Trade-offs:** Requires writing explicit domain logic and SQL/Drizzle queries rather than relying on heavy framework magic, which is a direct advantage for backend interviews.
- **Why Selected:** Chosen by the user. Fastify + Drizzle + Zod represents the modern high-performance TypeScript backend standard with zero-overhead SQL typing, automatic OpenAPI generation, and clean separation of concerns.

### Approach B: NestJS + Prisma ORM + React (Vite)
- **Trade-offs:** Familiar in traditional enterprise environments, but introduces heavy decorator/DI boilerplate and slower Prisma cold starts for a focused portfolio project.

### Approach C: Express + TypeORM / Knex + React
- **Trade-offs:** Legacy ecosystem choices that do not showcase modern TypeScript type inference or schema-driven OpenAPI generation as effectively.

---

## 5. Architecture & Technical Design

### 5.1 Monorepo Structure *(Builder's Call)*

```text
habitpulse/
├── apps/
│   ├── api/                        # Fastify + Drizzle Backend API
│   │   ├── src/
│   │   │   ├── domain/             # Pure business entities, streak & stats calculators (0 framework deps)
│   │   │   ├── application/        # Use cases / services orchestrating repositories & domain logic
│   │   │   ├── infrastructure/     # Drizzle schema, migrations, Postgres repositories, seeders
│   │   │   ├── presentation/       # Fastify routes, Zod DTO schemas, error handler, OpenAPI plugin
│   │   │   ├── config/             # Env validation with Zod
│   │   │   ├── app.ts              # Fastify app factory (for injectable testing)
│   │   │   └── server.ts           # Graceful shutdown & server entrypoint
│   │   ├── test/
│   │   │   ├── unit/               # Fast domain tests (streaks, weekly windows, completion rates)
│   │   │   └── integration/        # API + PostgreSQL integration tests
│   │   ├── Dockerfile
│   │   └── package.json
│   └── web/                        # React + Vite + Tailwind (Catppuccin) SPA
│       ├── src/
│       │   ├── api/                # Typed fetch client + TanStack Query hooks
│       │   ├── components/         # Header, SummaryCards, HabitList, HeatmapGrid, NewHabitModal
│       │   ├── theme/              # Catppuccin Mocha / Latte theme toggle & tokens
│       │   └── App.tsx
│       ├── Dockerfile              # Multi-stage Vite build -> Nginx static server
│       └── package.json
├── k8s/                            # Kubernetes manifests (Namespace, Postgres StatefulSet, API & Web Deployments, Services, Ingress)
├── docs/
│   └── superpowers/
│       ├── specs/                  # Design specifications
│       └── plans/                  # Step-by-step implementation plans
├── .github/
│   └── workflows/
│       └── ci.yml                  # Lint, typecheck, unit & integration tests, Docker build check
├── docker-compose.yml              # Postgres + API + Web for local full-stack execution
├── package.json
└── pnpm-workspace.yaml
```

### 5.2 Database Schema (PostgreSQL + Drizzle ORM)

All dates representing calendar days (`entry_date`) are stored as PostgreSQL `DATE` (`YYYY-MM-DD`) in the user's logical calendar date (passed by client or defaulting to UTC/configured timezone) so daily habit logs never shift across midnight due to UTC timestamp offsets.

1. **`users` table**
   - `id`: `UUID` Primary Key (Default user: `00000000-0000-0000-0000-000000000001`)
   - `email`: `VARCHAR(255)` UNIQUE NOT NULL (`demo@habitpulse.dev`)
   - `display_name`: `VARCHAR(100)` NOT NULL
   - `timezone`: `VARCHAR(64)` NOT NULL DEFAULT `'UTC'`
   - `created_at`: `TIMESTAMPTZ` NOT NULL DEFAULT `NOW()`

2. **`habits` table**
   - `id`: `UUID` Primary Key DEFAULT `gen_random_uuid()`
   - `user_id`: `UUID` NOT NULL REFERENCES `users(id)` ON DELETE CASCADE
   - `name`: `VARCHAR(120)` NOT NULL
   - `description`: `VARCHAR(500)` NULL
   - `color`: `VARCHAR(32)` NOT NULL DEFAULT `'mauve'` (Catppuccin accent token: `rosewater`, `flamingo`, `pink`, `mauve`, `red`, `maroon`, `peach`, `yellow`, `green`, `teal`, `sky`, `sapphire`, `blue`, `lavender`)
   - `tracking_type`: `VARCHAR(16)` NOT NULL (`'boolean'` | `'quantitative'`)
   - `target_value`: `INTEGER` NOT NULL DEFAULT `1` (For `'boolean'`, always `1`; for `'quantitative'`, $> 0$, e.g., `20`)
   - `unit`: `VARCHAR(32)` NULL (e.g., `'pages'`, `'min'`, `'ml'`; NULL for `'boolean'`)
   - `frequency_type`: `VARCHAR(16)` NOT NULL (`'daily'` | `'weekly'`)
   - `frequency_count`: `INTEGER` NOT NULL DEFAULT `1` (For `'daily'`, `1`; for `'weekly'`, `1..7` days per week)
   - `created_at`: `TIMESTAMPTZ` NOT NULL DEFAULT `NOW()`
   - **Indexes:** `idx_habits_user_id (user_id, created_at)`

3. **`habit_entries` table**
   - `id`: `UUID` Primary Key DEFAULT `gen_random_uuid()`
   - `habit_id`: `UUID` NOT NULL REFERENCES `habits(id)` ON DELETE CASCADE
   - `entry_date`: `DATE` NOT NULL (`YYYY-MM-DD`)
   - `value`: `INTEGER` NOT NULL (`>= 0`; for boolean habits: `1` = completed, `0` or deleted = not completed; for quantitative: numeric amount completed that day)
   - `updated_at`: `TIMESTAMPTZ` NOT NULL DEFAULT `NOW()`
   - **Constraints & Indexes:** `UNIQUE (habit_id, entry_date)` to guarantee idempotent upserts (`ON CONFLICT (habit_id, entry_date) DO UPDATE`).

### 5.3 Domain Rules: Completion, Streaks & Heatmap *(Builder's Call)*

1. **Daily Entry Completion:**
   - An entry on `entry_date` is considered **completed** if `value >= habit.target_value`.
   - Entry ratio for heatmap intensity on `entry_date`: `clamp(value / habit.target_value, 0, 1)` mapped to levels `0` (0%), `1` (1–49%), `2` (50–99%), `3` (100%), `4` (>100% or streak milestone).
2. **Streak Calculation (`domain/streak-calculator.ts`):**
   - **For `daily` habits (measured in days):**
     - Counts consecutive calendar days with a completed entry ending at `referenceDate` (today) or `referenceDate - 1 day` (so a streak is not lost at 8:00 AM before the user checks off today's habit).
     - `bestStreak` is the maximum consecutive completed days across the habit's history.
   - **For `weekly` habits (measured in ISO weeks, Mon–Sun):**
     - An ISO week is **completed** if the count of completed daily entries within that week is `>= habit.frequency_count`.
     - `currentStreak` counts consecutive completed ISO weeks up to the current week (if already met) or the immediately preceding ISO week (if the current week is still in progress and still mathematically achievable).
     - `bestStreak` is the maximum consecutive completed ISO weeks across history.
3. **Completion Rate (Last 30 Days):**
   - For `daily` habits: `(completed days in last 30 days) / min(30, days since habit creation)` (or full 30-day window for existing habits), clamped to `0..100%`.
   - For `weekly` habits: `(completed entries in last 4 completed/current ISO weeks) / (4 * frequency_count)`, clamped to `0..100%`.

### 5.4 REST API Endpoints (`apps/api`)

All responses use standard JSON envelopes and RFC 9457 Problem Details (or consistent structured error responses) on validation/404 errors.

- `GET /healthz` — Liveness probe (`{ status: "ok" }`).
- `GET /readyz` — Readiness probe (verifies PostgreSQL connectivity with `SELECT 1`).
- `GET /docs` — Swagger UI / OpenAPI 3.1 specification.
- `GET /api/v1/dashboard?date=YYYY-MM-DD`
  - Returns overall summary metrics (`activeDailyStreakSum`, `completedTodayCount`, `totalHabitsCount`, `monthlyCompletionRate`) and the list of habits with their current week's 7 days (`Mon`..`Sun`), `currentStreak`, `bestStreak`, and `completionRate30d`.
- `POST /api/v1/habits`
  - Creates a new habit (validated by Zod).
- `DELETE /api/v1/habits/:id`
  - Deletes a habit and cascades its `habit_entries`. Returns `204 No Content`.
- `PUT /api/v1/habits/:id/entries/:date`
  - Idempotent upsert of progress for a habit on `YYYY-MM-DD` with body `{ value: number }`. If `value === 0`, removes or zeroes the entry. Returns the updated habit summary & streak.
- `GET /api/v1/habits/:id/heatmap?endDate=YYYY-MM-DD&days=365`
  - Returns the 365-day array of `{ date, value, targetValue, level (0..4) }` plus habit stats (`currentStreak`, `bestStreak`, `totalCompletions`, `completionRate30d`) for the annual heatmap view.
- `POST /api/v1/demo/seed`
  - Idempotently resets/populates the default user with 5 curated habits (daily boolean, daily quantitative, weekly frequency) and 365 days of realistic historical data.

### 5.5 Frontend Design (`apps/web` — Catppuccin Minimalist UI)

- **Color Palette:** Official Catppuccin **Mocha** (dark: Base `#1e1e2e`, Mantle `#181825`, Surface0 `#313244`, Text `#cdd6f4`, Subtext0 `#a6adc8`, plus accent colors `Mauve #cba6f7`, `Green #a6e3a1`, `Peach #fab387`, `Red #f38ba8`, `Blue #89b4fa`) and **Latte** (light: Base `#eff1f5`, Mantle `#e6e9ef`, Surface0 `#ccd0da`, Text `#4c4f69`).
- **Components:**
  1. **Top Bar:** Brand logo, current date, **[Seed Demo Data]** button, **[Mocha / Latte]** theme switch, and **[+ New Habit]** button.
  2. **Summary Bar:** 3 minimalist metric cards (Today's Progress, Best Active Streak, 30-Day Consistency %).
  3. **Weekly Habit Matrix:** Each habit row displays its Catppuccin color pill, title, frequency/target subtitle, Mon–Sun interactive cells (click to toggle boolean, or click/increment for quantitative), current streak badge (`🔥 X days/weeks`), and a delete button with confirmation.
  4. **Annual Heatmap Panel:** Selecting any habit displays its 52-week GitHub-style contribution grid tinted in that habit's chosen Catppuccin accent color (4 opacity/shade levels), along with detailed statistics.

---

## 6. What Is Left to the Builder

- Exact Drizzle migration setup and folder naming inside `apps/api`.
- Exact CSS spacing, responsive breakpoints, and keyboard accessibility refinements in `apps/web`.
- Vitest test helper strategy (automatically using Testcontainers when Docker socket is available, or a test schema on `DATABASE_URL` so tests run fast in any environment).
- Kubernetes resource requests/limits and standard ConfigMap/Secret wiring in `k8s/`.

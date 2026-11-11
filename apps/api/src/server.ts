import { loadEnv } from './config/env.js';
import { createDatabasePool, createDrizzleClient } from './infrastructure/db/client.js';
import { ensureSchema } from './infrastructure/db/migrate.js';
import { PostgresHabitRepository } from './infrastructure/repositories/habit-repository.js';
import { buildApp } from './app.js';

export async function startServer() {
  const env = loadEnv();
  const pool = createDatabasePool(env.DATABASE_URL);
  const db = createDrizzleClient(pool);

  console.log('Ensuring database schema...');
  await ensureSchema(pool);

  const repository = new PostgresHabitRepository(db, pool);
  console.log('Ensuring default user exists...');
  await repository.ensureDefaultUser();

  const checkDbReadiness = async (): Promise<boolean> => {
    try {
      const client = await pool.connect();
      try {
        await client.query('SELECT 1');
        return true;
      } finally {
        client.release();
      }
    } catch {
      return false;
    }
  };

  const app = await buildApp({
    repository,
    checkDbReadiness,
    corsOrigin: env.CORS_ORIGIN,
  });

  const stop = async () => {
    console.log('Stopping server...');
    try {
      await app.close();
      await pool.end();
      console.log('Server stopped cleanly.');
      process.exit(0);
    } catch (err) {
      console.error('Error during shutdown:', err);
      process.exit(1);
    }
  };

  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);

  try {
    await app.listen({ port: env.PORT, host: env.HOST });
    console.log(`HabitPulse API running at http://${env.HOST}:${env.PORT}`);
    console.log(`OpenAPI documentation available at http://${env.HOST}:${env.PORT}/docs`);
    return app;
  } catch (err) {
    console.error('Failed to start server:', err);
    await pool.end();
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  startServer().catch((err) => {
    console.error('Fatal startup error:', err);
    process.exit(1);
  });
}

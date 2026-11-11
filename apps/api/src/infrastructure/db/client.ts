import pg from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema.js';

export type DatabaseClient = NodePgDatabase<typeof schema>;

export function createDatabasePool(connectionString?: string): pg.Pool {
  return new pg.Pool({
    connectionString:
      connectionString ||
      process.env.DATABASE_URL ||
      'postgres://postgres:postgres@localhost:5432/habitpulse',
  });
}

export function createDrizzleClient(pool: pg.Pool): DatabaseClient {
  return drizzle(pool, { schema });
}

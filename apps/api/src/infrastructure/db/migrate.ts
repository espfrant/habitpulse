import type pg from 'pg';

export async function ensureSchema(pool: pg.Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        display_name VARCHAR(100) NOT NULL,
        timezone VARCHAR(64) NOT NULL DEFAULT 'UTC',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS habits (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(120) NOT NULL,
        description VARCHAR(500),
        color VARCHAR(32) NOT NULL DEFAULT 'mauve',
        tracking_type VARCHAR(16) NOT NULL,
        target_value INTEGER NOT NULL DEFAULT 1,
        unit VARCHAR(32),
        frequency_type VARCHAR(16) NOT NULL,
        frequency_count INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_habits_user_id ON habits (user_id, created_at);

      CREATE TABLE IF NOT EXISTS habit_entries (
        id UUID PRIMARY KEY,
        habit_id UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
        entry_date DATE NOT NULL,
        value INTEGER NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE UNIQUE INDEX IF NOT EXISTS habit_entries_habit_date_idx ON habit_entries (habit_id, entry_date);
    `);
  } finally {
    client.release();
  }
}

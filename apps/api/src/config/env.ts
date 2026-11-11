export interface EnvConfig {
  PORT: number;
  HOST: string;
  DATABASE_URL: string;
  CORS_ORIGIN: string;
  NODE_ENV: string;
}

export function loadEnv(): EnvConfig {
  return {
    PORT: process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 3000,
    HOST: process.env.HOST || '0.0.0.0',
    DATABASE_URL:
      process.env.DATABASE_URL ||
      'postgres://postgres:postgres@localhost:5432/habitpulse',
    CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
    NODE_ENV: process.env.NODE_ENV || 'development',
  };
}

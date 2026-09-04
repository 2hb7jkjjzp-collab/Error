import pg from "pg";

let pool: pg.Pool | null = null;

function resolveSsl(connectionString: string): pg.PoolConfig["ssl"] {
  // Only enable SSL when the connection string or an explicit env var asks
  // for it. Self-hosted Postgres (docker-compose locally, or a plain
  // postgres:16-alpine service on Railway) does not speak SSL at all, and
  // guessing "not localhost => SSL" breaks against exactly that setup.
  // Managed providers that require SSL (Supabase, RDS, etc.) encode it in
  // the connection string (?sslmode=require) or should set PGSSL=true.
  if (process.env.PGSSL === "true") return { rejectUnauthorized: false };
  if (process.env.PGSSL === "false") return false;
  if (/sslmode=require|ssl=true/i.test(connectionString)) return { rejectUnauthorized: false };
  return false;
}

export function getPool(): pg.Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set");
    }
    pool = new pg.Pool({
      connectionString,
      ssl: resolveSsl(connectionString),
      max: Number(process.env.PG_POOL_MAX ?? 10),
    });
  }
  return pool;
}

export async function withTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

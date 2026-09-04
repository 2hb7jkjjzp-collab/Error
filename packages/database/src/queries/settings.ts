import { getPool } from "../pool.js";

export async function getSetting<T = unknown>(key: string): Promise<T | null> {
  const { rows } = await getPool().query("SELECT value FROM settings WHERE key = $1", [key]);
  return rows[0]?.value ?? null;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await getPool().query(
    `INSERT INTO settings (key, value, updated_at) VALUES ($1,$2, now())
     ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = now()`,
    [key, JSON.stringify(value)]
  );
}

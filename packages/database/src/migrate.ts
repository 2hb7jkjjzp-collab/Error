import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getPool, closePool } from "./pool.js";
import { logger } from "@meshal/shared";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Locates the top-level /migrations directory regardless of whether this
 * runs from source (tsx) or from dist/ inside the Docker image.
 */
function findMigrationsDir(): string {
  const candidates = [
    resolve(__dirname, "../../../migrations"),
    resolve(__dirname, "../../../../migrations"),
    resolve(process.cwd(), "migrations"),
  ];
  for (const c of candidates) {
    try {
      readdirSync(c);
      return c;
    } catch {
      // try next
    }
  }
  throw new Error(`Could not locate migrations directory. Tried: ${candidates.join(", ")}`);
}

export async function runMigrations(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const dir = findMigrationsDir();
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const { rows: applied } = await pool.query<{ filename: string }>(
    "SELECT filename FROM schema_migrations"
  );
  const appliedSet = new Set(applied.map((r) => r.filename));

  for (const file of files) {
    if (appliedSet.has(file)) continue;
    const sql = readFileSync(join(dir, file), "utf-8");
    logger.info("Applying migration", { event: "migration.apply", file });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [file]);
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
  logger.info("Migrations up to date", { event: "migration.done", count: files.length });
}

// Allow running directly: `node dist/migrate.js`
const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  runMigrations()
    .then(() => closePool())
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error("Migration failed", { event: "migration.error", error: String(err) });
      process.exit(1);
    });
}

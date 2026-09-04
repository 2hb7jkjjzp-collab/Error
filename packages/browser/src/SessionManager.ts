import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Persists authenticated Playwright storageState (cookies + localStorage) to
 * a directory that should be backed by a persistent volume in production
 * (sessions/<ats_type>/<tenant>.json.enc). Content is encrypted at rest with
 * AES-256-GCM using SESSION_ENCRYPTION_KEY. Sessions therefore survive
 * process/container restarts and are never stored in the database or logs.
 */
export class SessionManager {
  private readonly baseDir: string;
  private readonly key: Buffer;

  constructor(baseDir = process.env.SESSIONS_DIR ?? "./storage/sessions") {
    this.baseDir = baseDir;
    const secret = process.env.SESSION_ENCRYPTION_KEY ?? "dev-only-insecure-key-change-me";
    this.key = scryptSync(secret, "meshal-session-salt", 32);
  }

  private pathFor(atsType: string, tenant: string | null): string {
    const safeTenant = (tenant ?? "default").replace(/[^a-zA-Z0-9_-]/g, "_");
    return join(this.baseDir, atsType, `${safeTenant}.json.enc`);
  }

  has(atsType: string, tenant: string | null): boolean {
    return existsSync(this.pathFor(atsType, tenant));
  }

  save(atsType: string, tenant: string | null, storageState: unknown): void {
    const path = this.pathFor(atsType, tenant);
    mkdirSync(dirname(path), { recursive: true });
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const plaintext = Buffer.from(JSON.stringify(storageState), "utf-8");
    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const authTag = cipher.getAuthTag();
    writeFileSync(path, Buffer.concat([iv, authTag, encrypted]));
  }

  load(atsType: string, tenant: string | null): unknown | null {
    const path = this.pathFor(atsType, tenant);
    if (!existsSync(path)) return null;
    const buf = readFileSync(path);
    const iv = buf.subarray(0, 12);
    const authTag = buf.subarray(12, 28);
    const encrypted = buf.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", this.key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return JSON.parse(decrypted.toString("utf-8"));
  }

  /** Writes the decrypted storage state to a temp file for Playwright to consume, returns the path. */
  materializeForPlaywright(atsType: string, tenant: string | null): string | null {
    const state = this.load(atsType, tenant);
    if (!state) return null;
    const tmpPath = join(this.baseDir, atsType, `.tmp-${Date.now()}.json`);
    mkdirSync(dirname(tmpPath), { recursive: true });
    writeFileSync(tmpPath, JSON.stringify(state));
    return tmpPath;
  }
}

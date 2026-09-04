import { Router } from "express";
import { settingsDb } from "@meshal/database";

export const settingsRouter = Router();

settingsRouter.get("/settings", async (_req, res) => {
  const keys = ["candidate_policy", "scheduler_enabled"];
  const values: Record<string, unknown> = {};
  for (const key of keys) {
    values[key] = await settingsDb.getSetting(key);
  }
  res.json({ settings: values });
});

settingsRouter.put("/settings", async (req, res) => {
  const body = req.body as Record<string, unknown>;
  for (const [key, value] of Object.entries(body)) {
    await settingsDb.setSetting(key, value);
  }
  res.json({ ok: true });
});

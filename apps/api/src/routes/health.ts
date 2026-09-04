import { Router } from "express";
import { getPool } from "@meshal/database";

export const healthRouter = Router();

healthRouter.get("/healthz", async (_req, res) => {
  try {
    await getPool().query("SELECT 1");
    res.json({ status: "ok", db: "ok", time: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: "degraded", db: "unreachable", error: String(err) });
  }
});

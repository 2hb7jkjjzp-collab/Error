import { Router } from "express";
import jwt from "jsonwebtoken";
import { timingSafeEqual } from "node:crypto";

export const authRouter = Router();

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

authRouter.post("/login", (req, res) => {
  const { username, password } = req.body ?? {};
  const expectedUser = process.env.DASHBOARD_USERNAME ?? "admin";
  const expectedPass = process.env.DASHBOARD_PASSWORD;
  const secret = process.env.JWT_SECRET;

  if (!expectedPass || !secret) {
    res.status(500).json({ error: "NOT_CONFIGURED", message: "DASHBOARD_PASSWORD / JWT_SECRET not set on the server." });
    return;
  }
  if (typeof username !== "string" || typeof password !== "string" || !safeEqual(username, expectedUser) || !safeEqual(password, expectedPass)) {
    res.status(401).json({ error: "INVALID_CREDENTIALS" });
    return;
  }

  const token = jwt.sign({ username }, secret, { expiresIn: "12h" });
  res.json({ token });
});

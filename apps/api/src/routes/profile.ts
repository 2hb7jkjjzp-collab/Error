import { Router } from "express";
import multer from "multer";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { candidateDb } from "@meshal/database";
import type { CandidateProfile } from "@meshal/shared";

export const profileRouter = Router();

profileRouter.get("/profile", async (_req, res) => {
  const profile = await candidateDb.getActiveCandidateProfile();
  res.json({ profile });
});

profileRouter.put("/profile", async (req, res) => {
  const profile = req.body as CandidateProfile;
  if (!profile?.email || !profile?.first_name || !profile?.last_name) {
    res.status(400).json({ error: "INVALID_PROFILE", message: "email, first_name, last_name are required." });
    return;
  }
  const existing = await candidateDb.getActiveCandidateProfile();
  const id = await candidateDb.upsertCandidateProfile(existing?.id ?? null, profile);
  res.json({ ok: true, id });
});

profileRouter.get("/profile/answers", async (_req, res) => {
  const profile = await candidateDb.getActiveCandidateProfile();
  if (!profile) {
    res.json({ answers: [] });
    return;
  }
  const answers = await candidateDb.listCandidateAnswers(profile.id);
  res.json({ answers });
});

profileRouter.post("/profile/answers", async (req, res) => {
  const profile = await candidateDb.getActiveCandidateProfile();
  if (!profile) {
    res.status(400).json({ error: "NO_PROFILE", message: "Create a candidate profile first." });
    return;
  }
  const { question_pattern, category, answer, confidence, source, allowed_for_auto_answer } = req.body ?? {};
  if (!question_pattern || !category || !answer) {
    res.status(400).json({ error: "INVALID_ANSWER" });
    return;
  }
  const id = await candidateDb.upsertCandidateAnswer(profile.id, {
    question_pattern,
    category,
    answer,
    confidence: confidence ?? 1,
    source: source ?? "user",
    allowed_for_auto_answer: allowed_for_auto_answer ?? true,
  });
  res.json({ ok: true, id });
});

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      const dir = process.env.RESUME_PATH ? join(process.env.RESUME_PATH, "..") : "./storage/resume";
      mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => cb(null, `cv${extname(file.originalname)}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [".pdf", ".doc", ".docx"];
    cb(null, allowed.includes(extname(file.originalname).toLowerCase()));
  },
});

function extname(filename: string): string {
  const i = filename.lastIndexOf(".");
  return i >= 0 ? filename.slice(i) : "";
}

export const resumeRouter = Router();

resumeRouter.post("/resume", upload.single("resume"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "NO_FILE", message: "Upload a PDF/DOC/DOCX resume as 'resume'." });
    return;
  }
  const resumePath = req.file.path;
  const existing = await candidateDb.getActiveCandidateProfile();
  if (existing) {
    await candidateDb.upsertCandidateProfile(existing.id, { ...existing, resume_path: resumePath });
  }
  res.json({ ok: true, resume_path: resumePath });
});

import { Router } from "express";
import multer from "multer";
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

// Résumé bytes are stored in Postgres (candidate_profiles.resume_data), not
// on local disk: the API and worker are separate Railway services with
// independent volumes, so a file written to the API's disk would not be
// visible to the worker's browser automation. See migrations/003_resume_storage.sql.
const upload = multer({
  storage: multer.memoryStorage(),
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
  const existing = await candidateDb.getActiveCandidateProfile();
  if (!existing) {
    res.status(400).json({ error: "NO_PROFILE", message: "Create a candidate profile first, then upload a résumé." });
    return;
  }
  await candidateDb.setResumeBlob(existing.id, req.file.buffer, req.file.originalname);
  res.json({ ok: true, resume_filename: req.file.originalname });
});

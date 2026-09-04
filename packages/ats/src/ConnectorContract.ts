import type { Page } from "playwright";
import type { CandidateProfile, ATSType, CandidateAnswer } from "@meshal/shared";

export interface ApplicationContext {
  jobUrl: string;
  externalJobId: string | null;
  atsTenant: string | null;
  candidate: CandidateProfile;
  knownAnswers: CandidateAnswer[];
  applicationId: string;
}

export interface StepResult {
  ok: boolean;
  step: string;
  fieldsCompleted?: string[];
  unansweredFields?: string[];
  errorCode?: string;
  errorMessage?: string;
  details?: Record<string, unknown>;
}

export interface SubmissionSignals {
  confirmationText: string | null;
  confirmationUrl: string | null;
  externalApplicationId: string | null;
  screenshotPath: string | null;
}

/**
 * Every ATS connector implements this exact contract (Section 15). No
 * connector is authorized to mark an application SUBMITTED itself — that is
 * exclusively the Submission Verification Agent's job, using the signals
 * returned from collectSubmissionSignals().
 */
export interface ATSConnector {
  readonly atsType: ATSType;

  detect(url: string): boolean;
  open(page: Page, ctx: ApplicationContext): Promise<StepResult>;
  authenticate(page: Page, ctx: ApplicationContext): Promise<StepResult>;
  startApplication(page: Page, ctx: ApplicationContext): Promise<StepResult>;
  readCurrentStep(page: Page): Promise<{ step: string; totalSteps?: number }>;
  fillKnownFields(page: Page, ctx: ApplicationContext): Promise<StepResult>;
  uploadResume(page: Page, ctx: ApplicationContext): Promise<StepResult>;
  answerQuestions(page: Page, ctx: ApplicationContext): Promise<StepResult>;
  validateStep(page: Page): Promise<StepResult>;
  next(page: Page): Promise<StepResult>;
  submit(page: Page): Promise<StepResult>;
  collectSubmissionSignals(page: Page): Promise<SubmissionSignals>;
  close(page: Page): Promise<void>;
}

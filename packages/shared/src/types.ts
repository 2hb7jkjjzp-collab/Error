/** Job lifecycle state machine (Section 3 of the spec). */
export const JobState = {
  DISCOVERED: "DISCOVERED",
  VERIFYING: "VERIFYING",
  VERIFIED: "VERIFIED",
  MATCHING: "MATCHING",
  MATCHED: "MATCHED",
  QUEUED_FOR_APPLICATION: "QUEUED_FOR_APPLICATION",
  APPLYING: "APPLYING",
  SUBMISSION_PENDING_VERIFICATION: "SUBMISSION_PENDING_VERIFICATION",
  SUBMITTED: "SUBMITTED",
  REJECTED_BY_FILTER: "REJECTED_BY_FILTER",
  DUPLICATE: "DUPLICATE",
  CLOSED: "CLOSED",
  RETRY_PENDING: "RETRY_PENDING",
  NEEDS_ACTION: "NEEDS_ACTION",
  REPLIED: "REPLIED",
  INTERVIEW: "INTERVIEW",
  OFFER: "OFFER",
  REJECTED: "REJECTED",
} as const;
export type JobState = (typeof JobState)[keyof typeof JobState];

/** Allowed forward transitions. The orchestrator refuses anything else. */
export const JOB_STATE_TRANSITIONS: Record<JobState, JobState[]> = {
  DISCOVERED: [JobState.VERIFYING, JobState.DUPLICATE],
  VERIFYING: [JobState.VERIFIED, JobState.CLOSED, JobState.DUPLICATE, JobState.RETRY_PENDING],
  VERIFIED: [JobState.MATCHING],
  MATCHING: [JobState.MATCHED, JobState.REJECTED_BY_FILTER],
  MATCHED: [JobState.QUEUED_FOR_APPLICATION, JobState.REJECTED_BY_FILTER],
  QUEUED_FOR_APPLICATION: [JobState.APPLYING],
  APPLYING: [
    JobState.SUBMISSION_PENDING_VERIFICATION,
    JobState.NEEDS_ACTION,
    JobState.RETRY_PENDING,
  ],
  SUBMISSION_PENDING_VERIFICATION: [JobState.SUBMITTED, JobState.NEEDS_ACTION, JobState.RETRY_PENDING],
  SUBMITTED: [JobState.REPLIED, JobState.INTERVIEW, JobState.OFFER, JobState.REJECTED],
  RETRY_PENDING: [JobState.VERIFYING, JobState.APPLYING, JobState.NEEDS_ACTION],
  NEEDS_ACTION: [JobState.VERIFYING, JobState.APPLYING, JobState.RETRY_PENDING],
  REJECTED_BY_FILTER: [],
  DUPLICATE: [],
  CLOSED: [],
  REPLIED: [JobState.INTERVIEW, JobState.OFFER, JobState.REJECTED],
  INTERVIEW: [JobState.OFFER, JobState.REJECTED],
  OFFER: [JobState.REJECTED],
  REJECTED: [],
};

export const ATSType = {
  WORKDAY: "workday",
  GREENHOUSE: "greenhouse",
  LEVER: "lever",
  SMARTRECRUITERS: "smartrecruiters",
  ORACLE: "oracle",
  SUCCESSFACTORS: "successfactors",
  EMAIL: "email",
  UNKNOWN: "unknown",
} as const;
export type ATSType = (typeof ATSType)[keyof typeof ATSType];

export interface NormalizedJob {
  job_id: string;
  title: string;
  company: string;
  location: string | null;
  city: string | null;
  country: string | null;
  description: string | null;
  requirements: string | null;
  salary_min: number | null;
  salary_max: number | null;
  currency: string | null;
  employment_type: string | null;
  experience_level: string | null;
  source: string;
  source_url: string;
  original_application_url: string | null;
  application_email: string | null;
  ats_type: ATSType;
  ats_tenant: string | null;
  external_job_id: string | null;
  discovered_at: string;
  verified_at: string | null;
  status: JobState;
}

export interface EmployerRecord {
  employer_id: string;
  company_name: string;
  career_url: string | null;
  country: string | null;
  city: string | null;
  ats_type: ATSType | null;
  ats_tenant: string | null;
  ats_base_url: string | null;
  last_scan: string | null;
  active: boolean;
  discovery_method: string | null;
}

export interface CandidateProfile {
  legal_name: string;
  first_name: string;
  middle_name?: string | null;
  last_name: string;
  preferred_name?: string | null;
  email: string;
  phone: string;
  nationality?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  address?: string | null;
  city: string;
  country: string;
  postal_code?: string | null;
  linkedin_url?: string | null;
  portfolio_url?: string | null;
  current_employer?: string | null;
  current_job_title?: string | null;
  years_experience: number;
  current_salary?: number | null;
  expected_salary?: number | null;
  notice_period?: string | null;
  education: Array<{ degree: string; field: string; institution: string; year?: number }>;
  certifications: string[];
  languages: string[];
  skills: string[];
  work_history: Array<{
    employer: string;
    title: string;
    start_date: string;
    end_date?: string | null;
    description?: string;
  }>;
  resume_path: string;
}

export const AnswerCategory = {
  PROFILE: "PROFILE",
  PROFESSIONAL: "PROFESSIONAL",
  SALARY: "SALARY",
  WORK_AUTHORIZATION: "WORK_AUTHORIZATION",
  LEGAL: "LEGAL",
  SENSITIVE: "SENSITIVE",
  VOLUNTARY_DEMOGRAPHIC: "VOLUNTARY_DEMOGRAPHIC",
  UNKNOWN: "UNKNOWN",
} as const;
export type AnswerCategory = (typeof AnswerCategory)[keyof typeof AnswerCategory];

export interface CandidateAnswer {
  id: string;
  question_pattern: string;
  category: AnswerCategory;
  answer: string;
  confidence: number;
  source: string;
  allowed_for_auto_answer: boolean;
}

export interface MatchResult {
  score: number;
  eligible: boolean;
  auto_apply: boolean;
  confidence: number;
  reasons: string[];
  rejection_reasons: string[];
  salary_analysis: string;
  experience_analysis: string;
  skills_analysis: string;
}

export interface JobEvent {
  event_id: string;
  job_id: string;
  application_id?: string | null;
  agent: string;
  event_type: string;
  timestamp: string;
  run_id: string;
  payload: Record<string, unknown>;
  error?: Record<string, unknown> | null;
}

export const QueueName = {
  DISCOVERY: "discovery",
  VERIFICATION: "verification",
  MATCHING: "matching",
  APPLICATION: "application",
  SUBMISSION_VERIFICATION: "submission_verification",
  TRACKING: "tracking",
} as const;
export type QueueName = (typeof QueueName)[keyof typeof QueueName];

export interface QueueTask<T = Record<string, unknown>> {
  task_id: string;
  queue: QueueName;
  job_id: string | null;
  application_id: string | null;
  payload: T;
  attempts: number;
  max_attempts: number;
  run_at: string;
  priority: number;
}

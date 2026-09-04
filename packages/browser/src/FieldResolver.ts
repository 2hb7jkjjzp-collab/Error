import type { CandidateProfile } from "@meshal/shared";

/**
 * Form intelligence: classifies a form field semantically from its label,
 * name, placeholder, aria-label, and nearby text — rather than relying on
 * brittle CSS selectors that differ per ATS tenant.
 */
export type CandidateField = keyof CandidateProfile | "full_name" | "cover_letter" | "resume_upload";

interface FieldSignal {
  field: CandidateField;
  patterns: RegExp[];
}

const FIELD_SIGNALS: FieldSignal[] = [
  { field: "first_name", patterns: [/first\s*name/i, /given\s*name/i, /الاسم\s*الأول/] },
  { field: "last_name", patterns: [/last\s*name/i, /family\s*name/i, /surname/i, /اسم\s*العائلة/] },
  { field: "full_name", patterns: [/full\s*name/i, /^name$/i, /الاسم\s*الكامل/] },
  { field: "email", patterns: [/e-?mail/i, /البريد\s*الإلكتروني/] },
  { field: "phone", patterns: [/phone/i, /mobile/i, /contact\s*number/i, /رقم\s*الجوال/, /الهاتف/] },
  { field: "city", patterns: [/^city$/i, /current\s*city/i, /المدينة/] },
  { field: "country", patterns: [/^country$/i, /الدولة/] },
  { field: "linkedin_url", patterns: [/linkedin/i] },
  { field: "portfolio_url", patterns: [/portfolio/i, /website/i, /personal\s*site/i] },
  { field: "current_employer", patterns: [/current\s*employer/i, /current\s*company/i, /جهة\s*العمل/] },
  { field: "current_job_title", patterns: [/current\s*(job\s*)?title/i, /current\s*position/i, /المسمى\s*الوظيفي/] },
  { field: "years_experience", patterns: [/years?\s*of\s*experience/i, /total\s*experience/i, /سنوات\s*الخبرة/] },
  {
    field: "expected_salary",
    patterns: [/expected\s*(compensation|salary)/i, /salary\s*expectation/i, /desired\s*salary/i, /الراتب\s*المتوقع/],
  },
  { field: "current_salary", patterns: [/current\s*salary/i, /current\s*compensation/i, /الراتب\s*الحالي/] },
  { field: "notice_period", patterns: [/notice\s*period/i, /فترة\s*الإشعار/] },
  { field: "nationality", patterns: [/nationality/i, /الجنسية/] },
  { field: "resume_upload", patterns: [/resume/i, /cv/i, /curriculum\s*vitae/i, /السيرة\s*الذاتية/] },
  { field: "cover_letter", patterns: [/cover\s*letter/i, /خطاب\s*تغطية/] },
  { field: "address", patterns: [/address/i, /العنوان/] },
];

export interface FieldContext {
  label?: string | null;
  name?: string | null;
  placeholder?: string | null;
  ariaLabel?: string | null;
  nearbyText?: string | null;
  type?: string | null;
}

export function classifyField(ctx: FieldContext): CandidateField | null {
  const haystack = [ctx.label, ctx.name, ctx.placeholder, ctx.ariaLabel, ctx.nearbyText].filter(Boolean).join(" ");
  if (!haystack) return null;

  for (const signal of FIELD_SIGNALS) {
    if (signal.patterns.some((p) => p.test(haystack))) {
      return signal.field;
    }
  }
  if (ctx.type === "file" && /resume|cv/i.test(haystack)) return "resume_upload";
  return null;
}

export function valueForField(field: CandidateField, candidate: CandidateProfile): string | null {
  switch (field) {
    case "full_name":
      return candidate.preferred_name || `${candidate.first_name} ${candidate.last_name}`;
    case "resume_upload":
    case "cover_letter":
      return null; // handled by file-upload logic, not text fill
    default: {
      const v = (candidate as unknown as Record<string, unknown>)[field as string];
      if (v == null) return null;
      return String(v);
    }
  }
}

import { AnswerCategory, type CandidateAnswer } from "@meshal/shared";

const CATEGORY_PATTERNS: Array<{ category: AnswerCategory; patterns: RegExp[] }> = [
  {
    category: AnswerCategory.WORK_AUTHORIZATION,
    patterns: [/work\s*authoriz/i, /sponsorship/i, /visa/i, /legally\s*(authorized|eligible)/i, /إقامة/],
  },
  {
    category: AnswerCategory.LEGAL,
    patterns: [/criminal/i, /background\s*check/i, /convicted/i, /non-?compete/i, /legal\s*name/i],
  },
  {
    category: AnswerCategory.SALARY,
    patterns: [/salary/i, /compensation/i, /الراتب/],
  },
  {
    category: AnswerCategory.SENSITIVE,
    patterns: [/disability/i, /veteran/i, /religion/i, /race/i, /ethnicity/i],
  },
  {
    category: AnswerCategory.VOLUNTARY_DEMOGRAPHIC,
    patterns: [/voluntary/i, /self-identif/i, /gender\s*identity/i],
  },
  {
    category: AnswerCategory.PROFESSIONAL,
    patterns: [/years?\s*of\s*experience/i, /notice\s*period/i, /current\s*employer/i, /current\s*title/i],
  },
  {
    category: AnswerCategory.PROFILE,
    patterns: [/name/i, /email/i, /phone/i, /address/i, /city/i, /nationality/i],
  },
];

export function classifyQuestion(questionText: string): AnswerCategory {
  for (const { category, patterns } of CATEGORY_PATTERNS) {
    if (patterns.some((p) => p.test(questionText))) return category;
  }
  return AnswerCategory.UNKNOWN;
}

/**
 * Decides whether a question can be auto-answered. Required legal/sensitive
 * fields with no stored, explicitly-allowed answer are NEVER fabricated —
 * they surface as REQUIRED_UNKNOWN_FIELD / LEGAL_ANSWER_REQUIRED instead.
 */
export function resolveAnswer(
  questionText: string,
  required: boolean,
  knownAnswers: CandidateAnswer[]
): { answer: string | null; category: AnswerCategory; canAutoAnswer: boolean; reason: string } {
  const category = classifyQuestion(questionText);
  const known = knownAnswers.find((a) => new RegExp(a.question_pattern, "i").test(questionText));

  if (known && known.allowed_for_auto_answer) {
    return { answer: known.answer, category, canAutoAnswer: true, reason: `Matched known answer pattern "${known.question_pattern}".` };
  }

  if (!required) {
    return { answer: null, category, canAutoAnswer: true, reason: "Optional field left blank — no fabricated answer." };
  }

  if (category === AnswerCategory.LEGAL || category === AnswerCategory.SENSITIVE) {
    return { answer: null, category, canAutoAnswer: false, reason: "Required legal/sensitive field with no known answer; never fabricated." };
  }

  return { answer: null, category, canAutoAnswer: false, reason: "Required field with no known/allowed answer." };
}

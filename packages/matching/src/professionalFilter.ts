/**
 * Fast, deterministic pre-filter run BEFORE expensive semantic matching.
 * Section 9 of the spec: candidate's target field is Finance / Accounting /
 * Financial Control / Audit / Risk / Treasury / Tax / FP&A / Finance
 * Operations / Advisory / Consulting related to finance.
 */

const RELEVANT_KEYWORDS = [
  "accountant",
  "accounting",
  "financial control",
  "financial controller",
  "controller",
  "finance analyst",
  "financial analyst",
  "fp&a",
  "fp & a",
  "financial planning",
  "finance manager",
  "financial reporting",
  "reporting",
  "treasury",
  "tax",
  "audit",
  "internal audit",
  "risk",
  "internal controls",
  "cost accounting",
  "revenue accounting",
  "billing",
  "credit",
  "finance operations",
  "record-to-report",
  "record to report",
  "r2r",
  "finance transformation",
  "finance advisory",
  "accounting advisory",
  "cfo",
  "chief financial",
  "general ledger",
  "gl accountant",
  "bookkeeper",
  "financial planning and analysis",
  "consulting",
  "advisory",
  "finance",
];

const OBVIOUSLY_IRRELEVANT_KEYWORDS = [
  "pilates",
  "yoga instructor",
  "nurse",
  "nursing",
  "physician",
  "doctor",
  "driver",
  "chef",
  "cook",
  "barista",
  "fitness trainer",
  "personal trainer",
  "graphic designer",
  "software developer",
  "software engineer",
  "electrician",
  "plumber",
  "mechanic",
  "hairdresser",
  "beautician",
  "flight attendant",
  "security guard",
  "housekeeping",
  "waiter",
  "waitress",
];

export interface ProfessionalFilterResult {
  pass: boolean;
  matchedKeywords: string[];
  reason: string;
}

export function professionalPreFilter(title: string, description?: string | null): ProfessionalFilterResult {
  const haystack = `${title} ${description ?? ""}`.toLowerCase();
  const titleLower = title.toLowerCase();

  const irrelevantHit = OBVIOUSLY_IRRELEVANT_KEYWORDS.find((k) => titleLower.includes(k));
  const relevantHits = RELEVANT_KEYWORDS.filter((k) => haystack.includes(k));

  if (irrelevantHit && relevantHits.length === 0) {
    return {
      pass: false,
      matchedKeywords: [],
      reason: `Title matches an obviously irrelevant profession ("${irrelevantHit}") with no finance context.`,
    };
  }

  if (relevantHits.length === 0) {
    return {
      pass: false,
      matchedKeywords: [],
      reason: "No finance/accounting/audit/risk/treasury/tax keywords found in title or description.",
    };
  }

  return {
    pass: true,
    matchedKeywords: relevantHits,
    reason: `Matched finance-domain keywords: ${relevantHits.slice(0, 5).join(", ")}`,
  };
}

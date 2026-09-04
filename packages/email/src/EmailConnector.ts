import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { logger } from "@meshal/shared";

export interface EmailMatchCriteria {
  company: string;
  title: string;
  applicationIdHints?: string[];
  senderDomainHint?: string | null;
  sinceDate: Date;
}

export interface FoundEmail {
  messageId: string;
  sender: string;
  subject: string;
  receivedAt: Date;
  excerpt: string;
}

export type EmailClassification =
  | "REPLIED"
  | "INTERVIEW"
  | "OFFER"
  | "REJECTED"
  | "ACTION_REQUIRED"
  | "UNKNOWN_REPLY";

const CLASSIFICATION_PATTERNS: Array<{ classification: EmailClassification; patterns: RegExp[] }> = [
  { classification: "OFFER", patterns: [/offer/i, /we are pleased to offer/i, /عرض\s*عمل/] },
  { classification: "INTERVIEW", patterns: [/interview/i, /schedule a call/i, /مقابلة/] },
  { classification: "REJECTED", patterns: [/unfortunately/i, /not moving forward/i, /other candidates/i, /نأسف/] },
  { classification: "ACTION_REQUIRED", patterns: [/complete your application/i, /verify your email/i, /action required/i] },
];

export function classifyEmail(subject: string, body: string): EmailClassification {
  const haystack = `${subject} ${body}`;
  for (const { classification, patterns } of CLASSIFICATION_PATTERNS) {
    if (patterns.some((p) => p.test(haystack))) return classification;
  }
  return "UNKNOWN_REPLY";
}

/**
 * IMAP-based email confirmation search (Section 25/26). Requires
 * EMAIL_IMAP_HOST/USER/PASSWORD to be configured — if absent, callers should
 * treat email verification as unavailable rather than fabricating a match.
 * Only searches for and returns emails relevant to a specific application;
 * never exposes unrelated mailbox contents.
 */
export class EmailConnector {
  isConfigured(): boolean {
    return Boolean(process.env.EMAIL_IMAP_HOST && process.env.EMAIL_IMAP_USER && process.env.EMAIL_IMAP_PASSWORD);
  }

  async searchConfirmation(criteria: EmailMatchCriteria): Promise<FoundEmail[]> {
    if (!this.isConfigured()) {
      logger.warn("Email confirmation search skipped: IMAP not configured", { event: "email.not_configured" });
      return [];
    }

    const client = new ImapFlow({
      host: process.env.EMAIL_IMAP_HOST!,
      port: Number(process.env.EMAIL_IMAP_PORT ?? 993),
      secure: true,
      auth: { user: process.env.EMAIL_IMAP_USER!, pass: process.env.EMAIL_IMAP_PASSWORD! },
      logger: false,
    });

    const found: FoundEmail[] = [];
    try {
      await client.connect();
      const lock = await client.getMailboxLock("INBOX");
      try {
        const searchTerms = [criteria.company, criteria.title].filter(Boolean);
        for await (const message of client.fetch(
          { since: criteria.sinceDate, subject: searchTerms[0] },
          { envelope: true, source: true }
        )) {
          const parsed = await simpleParser(message.source!);
          const subject = parsed.subject ?? "";
          const bodyText = parsed.text ?? "";
          const matchesCompany = subject.toLowerCase().includes(criteria.company.toLowerCase()) ||
            bodyText.toLowerCase().includes(criteria.company.toLowerCase());
          if (!matchesCompany) continue;

          found.push({
            messageId: parsed.messageId ?? String(message.uid),
            sender: parsed.from?.text ?? "unknown",
            subject,
            receivedAt: parsed.date ?? new Date(),
            excerpt: bodyText.slice(0, 500),
          });
        }
      } finally {
        lock.release();
      }
      await client.logout();
    } catch (err) {
      logger.error("Email search failed", { event: "email.search_error", error: String(err) });
    }
    return found;
  }
}

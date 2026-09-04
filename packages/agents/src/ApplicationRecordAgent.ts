import { applicationsDb, eventsDb, evidenceDb } from "@meshal/database";

/**
 * Application Record Agent — Section 27. Not queue-driven like the other
 * agents; it is the authoritative READ layer other agents and the API rely
 * on so application counts are never inferred from the jobs table alone.
 * Kept as a small service class (no BaseAgent/queue wiring needed) because
 * its job is aggregation and lookup, not processing tasks.
 */
export class ApplicationRecordAgent {
  readonly name = "application_record_agent";

  async getFullRecord(applicationId: string) {
    const application = await applicationsDb.getApplication(applicationId);
    if (!application) return null;
    const [events, evidence] = await Promise.all([
      eventsDb.listEventsForApplication(applicationId),
      evidenceDb.listEvidenceForApplication(applicationId),
    ]);
    return { ...application, events, evidence };
  }

  async countsByStatus() {
    return applicationsDb.countApplicationsByStatus();
  }
}

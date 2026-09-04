import { getPool } from "../pool.js";
import type { EmployerRecord } from "@meshal/shared";

export async function upsertEmployer(
  employer: Omit<EmployerRecord, "employer_id" | "last_scan">
): Promise<string> {
  const pool = getPool();
  const { rows } = await pool.query<{ employer_id: string }>(
    `INSERT INTO employers (company_name, career_url, country, city, ats_type, ats_tenant, ats_base_url, active, discovery_method, last_scan)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, now())
     ON CONFLICT (company_name, ats_type, ats_tenant)
     DO UPDATE SET last_scan = now(), career_url = EXCLUDED.career_url, active = EXCLUDED.active
     RETURNING employer_id`,
    [
      employer.company_name,
      employer.career_url,
      employer.country,
      employer.city,
      employer.ats_type,
      employer.ats_tenant,
      employer.ats_base_url,
      employer.active,
      employer.discovery_method,
    ]
  );
  return rows[0].employer_id;
}

export async function listEmployers(limit = 200): Promise<EmployerRecord[]> {
  const { rows } = await getPool().query(
    "SELECT * FROM employers ORDER BY last_scan DESC NULLS LAST LIMIT $1",
    [limit]
  );
  return rows as EmployerRecord[];
}

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../api.js";

interface Job {
  job_id: string;
  title: string;
  company: string;
  city: string | null;
  status: string;
}

export default function Jobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    apiFetch<{ jobs: Job[] }>(`/jobs${status ? `?status=${status}` : ""}`).then((r) => setJobs(r.jobs));
  }, [status]);

  return (
    <div className="card">
      <h2>الوظائف</h2>
      <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ marginBottom: 10, width: "100%", padding: 8 }}>
        <option value="">كل الحالات</option>
        <option value="DISCOVERED">مكتشفة</option>
        <option value="VERIFIED">تم التحقق</option>
        <option value="MATCHED">مناسبة</option>
        <option value="SUBMITTED">تم التقديم</option>
        <option value="NEEDS_ACTION">تحتاج تدخل</option>
      </select>
      {jobs.map((j) => (
        <Link key={j.job_id} to={`/jobs/${j.job_id}`} style={{ textDecoration: "none", color: "inherit" }}>
          <div className="job-row">
            <div>
              <div>{j.title}</div>
              <div className="muted">{j.company} — {j.city ?? "?"}</div>
            </div>
            <span className={`badge ${badgeClass(j.status)}`}>{j.status}</span>
          </div>
        </Link>
      ))}
      {jobs.length === 0 && <p className="muted">لا توجد وظائف بعد.</p>}
    </div>
  );
}

export function badgeClass(status: string): string {
  if (status === "SUBMITTED") return "submitted";
  if (status === "NEEDS_ACTION") return "needs_action";
  if (["APPLYING", "QUEUED_FOR_APPLICATION", "SUBMISSION_PENDING_VERIFICATION"].includes(status)) return "pending";
  return "default";
}

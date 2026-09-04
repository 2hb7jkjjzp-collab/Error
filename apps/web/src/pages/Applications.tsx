import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../api.js";
import { badgeClass } from "./Jobs.js";

interface Application {
  application_id: string;
  title: string;
  company: string;
  status: string;
}

export default function Applications() {
  const [apps, setApps] = useState<Application[]>([]);

  useEffect(() => {
    apiFetch<{ applications: Application[] }>("/applications").then((r) => setApps(r.applications));
  }, []);

  return (
    <div className="card">
      <h2>التقديمات</h2>
      {apps.map((a) => (
        <Link key={a.application_id} to={`/applications/${a.application_id}`} style={{ textDecoration: "none", color: "inherit" }}>
          <div className="job-row">
            <div>
              <div>{a.title}</div>
              <div className="muted">{a.company}</div>
            </div>
            <span className={`badge ${badgeClass(a.status)}`}>{a.status === "SUBMITTED" ? "تم التقديم ✓" : a.status}</span>
          </div>
        </Link>
      ))}
      {apps.length === 0 && <p className="muted">لا توجد تقديمات بعد.</p>}
    </div>
  );
}

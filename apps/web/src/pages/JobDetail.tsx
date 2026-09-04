import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { apiFetch } from "../api.js";

export default function JobDetail() {
  const { id } = useParams();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    apiFetch(`/jobs/${id}`).then(setData);
  }, [id]);

  if (!data) return <div className="card">جارٍ التحميل...</div>;
  const { job, events, match } = data;

  return (
    <div>
      <div className="card">
        <h2>{job.title}</h2>
        <p className="muted">{job.company} — {job.city ?? job.location ?? "?"}</p>
        <p>المصدر: {job.source}</p>
        <p>الحالة: {job.status}</p>
        {job.original_application_url && (
          <p><a href={job.original_application_url} target="_blank" rel="noreferrer">رابط التقديم الأصلي</a></p>
        )}
        {match && (
          <>
            <p>نسبة المطابقة: {match.score}%</p>
            <p className="muted">{(match.reasons ?? []).join(" — ")}</p>
          </>
        )}
      </div>
      <div className="card">
        <h2>السجل الزمني</h2>
        {(events ?? []).map((e: any) => (
          <div key={e.event_id} className="timeline-item">
            <div>{e.event_type}</div>
            <div className="muted">{new Date(e.created_at).toLocaleString("ar-SA")}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

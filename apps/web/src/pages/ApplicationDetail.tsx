import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { apiFetch } from "../api.js";

export default function ApplicationDetail() {
  const { id } = useParams();
  const [data, setData] = useState<any>(null);
  const [retrying, setRetrying] = useState(false);

  async function load() {
    const res = await apiFetch(`/applications/${id}`);
    setData(res);
  }

  useEffect(() => {
    load();
  }, [id]);

  async function retry() {
    setRetrying(true);
    try {
      await apiFetch(`/applications/${id}/retry`, { method: "POST" });
      await load();
    } finally {
      setRetrying(false);
    }
  }

  if (!data) return <div className="card">جارٍ التحميل...</div>;

  return (
    <div>
      <div className="card">
        <h2>{data.title}</h2>
        <p className="muted">{data.company} — {data.location ?? "?"}</p>
        <p>الحالة: {data.status}</p>
        {data.blocker && <p style={{ color: "#b91c1c" }}>العائق: {data.blocker.message ?? data.blocker.code}</p>}
        {data.confirmation_url && <p><a href={data.confirmation_url} target="_blank" rel="noreferrer">رابط التأكيد</a></p>}
        {data.status !== "SUBMITTED" && (
          <button onClick={retry} disabled={retrying}>{retrying ? "جارٍ إعادة المحاولة..." : "إعادة المحاولة"}</button>
        )}
      </div>

      {data.evidence?.length > 0 && (
        <div className="card">
          <h2>أدلة الإرسال</h2>
          {data.evidence.map((ev: any) => (
            <div key={ev.id} className="job-row">
              <span>{ev.verification_method}</span>
              <span className="muted">{new Date(ev.created_at).toLocaleString("ar-SA")}</span>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <h2>السجل الزمني</h2>
        {(data.events ?? []).map((e: any) => (
          <div key={e.event_id} className="timeline-item">
            <div>{e.event_type}</div>
            <div className="muted">{new Date(e.created_at).toLocaleString("ar-SA")}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

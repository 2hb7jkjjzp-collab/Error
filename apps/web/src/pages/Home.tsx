import { useEffect, useState } from "react";
import { apiFetch } from "../api.js";

interface FunnelData {
  found: number;
  verified: number;
  matched: number;
  queued: number;
  attempted: number;
  submitted: number;
  needs_action: number;
}

interface DashboardResponse {
  funnel: FunnelData;
  live_agents: Array<{ agent: string; status: string; started_at: string }>;
  recent_runs: Array<{ run_id: string; agent: string; status: string; started_at: string }>;
}

const AGENT_LABELS_AR: Record<string, string> = {
  discovery_agent: "وكيل البحث",
  verification_agent: "وكيل التحقق",
  matching_agent: "وكيل المطابقة",
  application_agent: "وكيل التقديم",
  submission_verification_agent: "وكيل التحقق من الإرسال",
  tracking_agent: "وكيل المتابعة",
  orchestrator: "المنسق العام",
  tracking_scheduler: "جدولة المتابعة",
};

export default function Home() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  async function load() {
    try {
      const res = await apiFetch<DashboardResponse>("/dashboard");
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تحميل البيانات");
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  async function runNow() {
    setRunning(true);
    try {
      await apiFetch("/pipeline/run", { method: "POST" });
      await load();
    } finally {
      setRunning(false);
    }
  }

  if (error) return <div className="card">{error}</div>;
  if (!data) return <div className="card">جارٍ التحميل...</div>;

  const f = data.funnel;
  return (
    <div>
      <div className="card">
        <h2>اليوم</h2>
        <div className="stat-grid">
          <Stat label="وُجد" value={f.found} />
          <Stat label="تم التحقق" value={f.verified} />
          <Stat label="مناسبة" value={f.matched} />
          <Stat label="تم التقديم" value={f.submitted} />
          <Stat label="قيد المعالجة" value={f.attempted - f.submitted - f.needs_action} />
          <Stat label="تحتاج تدخل" value={f.needs_action} />
        </div>
        <button onClick={runNow} disabled={running} style={{ marginTop: 12 }}>
          {running ? "جارٍ التشغيل..." : "بحث وتقديم الآن"}
        </button>
      </div>

      <div className="card">
        <h2>نشاط الوكلاء الحالي</h2>
        {data.live_agents.length === 0 && <p className="muted">لا يوجد نشاط حالياً.</p>}
        {data.live_agents.map((a) => (
          <div key={a.agent} className="job-row">
            <span>{AGENT_LABELS_AR[a.agent] ?? a.agent}</span>
            <span className={`badge ${a.status === "RUNNING" ? "pending" : "default"}`}>{a.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat-tile">
      <div className="value">{value}</div>
      <div className="label">{label}</div>
    </div>
  );
}

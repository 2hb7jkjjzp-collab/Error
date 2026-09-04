import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { apiFetch } from "../api.js";

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default function ApplicationDetail() {
  const { id } = useParams();
  const [data, setData] = useState<any>(null);
  const [retrying, setRetrying] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [savingAnswer, setSavingAnswer] = useState<string | null>(null);
  const [savedQuestions, setSavedQuestions] = useState<Set<string>>(new Set());

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

  async function saveAnswer(question: string) {
    const answer = answers[question]?.trim();
    if (!answer) return;
    setSavingAnswer(question);
    try {
      await apiFetch("/profile/answers", {
        method: "POST",
        body: JSON.stringify({
          question_pattern: escapeRegex(question),
          category: "PROFESSIONAL",
          answer,
          confidence: 1,
          source: "user",
          allowed_for_auto_answer: true,
        }),
      });
      setSavedQuestions((prev) => new Set(prev).add(question));
    } finally {
      setSavingAnswer(null);
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

      {data.unanswered_fields?.length > 0 && (
        <div className="card">
          <h2>أسئلة تحتاج إجابتك</h2>
          <p className="muted">
            هذي أسئلة بنموذج التقديم ما قدر النظام يجاوب عليها تلقائيًا. اكتب الإجابة واحفظها، وبعدها اضغط
            "إعادة المحاولة" بالأعلى — بيتذكرها في أي تقديم جاي فيه نفس السؤال.
          </p>
          {data.unanswered_fields.map((q: string) => (
            <div key={q} style={{ marginBottom: 14 }}>
              <p style={{ fontWeight: 600 }}>{q}</p>
              {savedQuestions.has(q) ? (
                <p style={{ color: "#15803d" }}>تم الحفظ ✓</p>
              ) : (
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    placeholder="اكتب الإجابة هنا"
                    value={answers[q] ?? ""}
                    onChange={(e) => setAnswers({ ...answers, [q]: e.target.value })}
                    style={{ flex: 1, marginBottom: 0 }}
                  />
                  <button
                    style={{ width: "auto", whiteSpace: "nowrap" }}
                    onClick={() => saveAnswer(q)}
                    disabled={savingAnswer === q}
                  >
                    {savingAnswer === q ? "..." : "حفظ"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

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

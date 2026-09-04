import { useEffect, useState } from "react";
import { apiFetch } from "../api.js";

export default function ProfilePage() {
  const [profile, setProfile] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ profile: any }>("/profile").then((r) => setProfile(r.profile ?? emptyProfile()));
  }, []);

  function emptyProfile() {
    return {
      legal_name: "", first_name: "", last_name: "", email: "", phone: "",
      city: "Riyadh", country: "Saudi Arabia", years_experience: 0,
      education: [], certifications: [], languages: [], skills: [], work_history: [],
      resume_path: "",
    };
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      await apiFetch("/profile", { method: "PUT", body: JSON.stringify(profile) });
      setMessage("تم الحفظ بنجاح.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "خطأ غير متوقع");
    } finally {
      setSaving(false);
    }
  }

  async function uploadResume(file: File) {
    const form = new FormData();
    form.append("resume", file);
    const token = localStorage.getItem("meshal_token");
    const res = await fetch("/api/resume", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
    if (res.ok) setMessage("تم رفع السيرة الذاتية.");
  }

  if (!profile) return <div className="card">جارٍ التحميل...</div>;

  return (
    <div className="card">
      <h2>الملف الشخصي</h2>
      <input placeholder="الاسم الأول" value={profile.first_name} onChange={(e) => setProfile({ ...profile, first_name: e.target.value })} />
      <input placeholder="اسم العائلة" value={profile.last_name} onChange={(e) => setProfile({ ...profile, last_name: e.target.value })} />
      <input placeholder="الاسم القانوني الكامل" value={profile.legal_name} onChange={(e) => setProfile({ ...profile, legal_name: e.target.value })} />
      <input placeholder="البريد الإلكتروني" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} />
      <input placeholder="الجوال" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
      <input placeholder="المدينة" value={profile.city} onChange={(e) => setProfile({ ...profile, city: e.target.value })} />
      <input placeholder="سنوات الخبرة" type="number" value={profile.years_experience} onChange={(e) => setProfile({ ...profile, years_experience: Number(e.target.value) })} />
      <input placeholder="الراتب المتوقع (ريال)" type="number" value={profile.expected_salary ?? ""} onChange={(e) => setProfile({ ...profile, expected_salary: Number(e.target.value) })} />
      <label className="muted">السيرة الذاتية (PDF/DOC)</label>
      <input type="file" accept=".pdf,.doc,.docx" onChange={(e) => e.target.files?.[0] && uploadResume(e.target.files[0])} />
      {message && <p className="muted">{message}</p>}
      <button onClick={save} disabled={saving}>{saving ? "جارٍ الحفظ..." : "حفظ"}</button>
    </div>
  );
}

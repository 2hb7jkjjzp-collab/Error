import { clearToken } from "../api.js";
import { useNavigate } from "react-router-dom";

export default function SettingsPage() {
  const navigate = useNavigate();

  function logout() {
    clearToken();
    navigate("/login");
  }

  return (
    <div className="card">
      <h2>الإعدادات</h2>
      <p className="muted">
        سياسة التقديم الحالية: الرياض فقط، بحد أدنى للراتب 15,000 ريال (إن كان محدداً)، ونفس السيرة الذاتية الأصلية لكل تقديم.
      </p>
      <p className="muted">الجدولة: 6:00 و 8:00 صباحاً أيام العمل (بتوقيت الرياض)، ومتابعة كل ساعتين.</p>
      <button className="secondary" onClick={logout}>تسجيل الخروج</button>
    </div>
  );
}

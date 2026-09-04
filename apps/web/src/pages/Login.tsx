import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../api.js";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await login(username, password);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطأ غير متوقع");
    }
  }

  return (
    <div className="login-box">
      <div className="card">
        <h2>تسجيل الدخول</h2>
        <form onSubmit={onSubmit}>
          <input placeholder="اسم المستخدم" value={username} onChange={(e) => setUsername(e.target.value)} />
          <input placeholder="كلمة المرور" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <p style={{ color: "#b91c1c" }}>{error}</p>}
          <button type="submit">دخول</button>
        </form>
      </div>
    </div>
  );
}

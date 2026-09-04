import { Navigate, Route, Routes, NavLink } from "react-router-dom";
import { getToken } from "./api.js";
import Login from "./pages/Login.js";
import Home from "./pages/Home.js";
import Jobs from "./pages/Jobs.js";
import JobDetail from "./pages/JobDetail.js";
import Applications from "./pages/Applications.js";
import ApplicationDetail from "./pages/ApplicationDetail.js";
import ProfilePage from "./pages/Profile.js";
import SettingsPage from "./pages/Settings.js";

function RequireAuth({ children }: { children: React.ReactNode }) {
  if (!getToken()) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <div className="topbar">
        <h1>مِشعل — الوكيل الآلي للوظائف</h1>
      </div>
      <div className="content">{children}</div>
      <nav className="bottom-nav">
        <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>الرئيسية</NavLink>
        <NavLink to="/jobs" className={({ isActive }) => (isActive ? "active" : "")}>الوظائف</NavLink>
        <NavLink to="/applications" className={({ isActive }) => (isActive ? "active" : "")}>التقديمات</NavLink>
        <NavLink to="/profile" className={({ isActive }) => (isActive ? "active" : "")}>الملف الشخصي</NavLink>
        <NavLink to="/settings" className={({ isActive }) => (isActive ? "active" : "")}>الإعدادات</NavLink>
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          <RequireAuth>
            <Shell>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/jobs" element={<Jobs />} />
                <Route path="/jobs/:id" element={<JobDetail />} />
                <Route path="/applications" element={<Applications />} />
                <Route path="/applications/:id" element={<ApplicationDetail />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Routes>
            </Shell>
          </RequireAuth>
        }
      />
    </Routes>
  );
}

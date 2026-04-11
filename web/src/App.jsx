import { useEffect, useState } from "react";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import AdminShell from "./pages/admin/AdminShell.jsx";
import { setAuthToken } from "./lib/api.js";
import "./App.css";

const TOKEN_KEY = "cb_token";
const USER_KEY = "cb_user";
const SOURCE_KEY = "cb_source";

export default function App() {
  const [session, setSession] = useState(null);
  const [bootstrapped, setBootstrapped] = useState(false);

  useEffect(() => {
    if (bootstrapped) return;
    try {
      const token = window.localStorage.getItem(TOKEN_KEY);
      const rawUser = window.localStorage.getItem(USER_KEY);
      const source = window.localStorage.getItem(SOURCE_KEY) || "api";
      if (rawUser) {
        const user = JSON.parse(rawUser);
        if (token) setAuthToken(token);
        setSession({ token: token || null, user, source });
      }
    } catch (err) {
      console.warn("No se pudo recuperar la sesion:", err);
      window.localStorage.removeItem(TOKEN_KEY);
      window.localStorage.removeItem(USER_KEY);
      window.localStorage.removeItem(SOURCE_KEY);
    } finally {
      setBootstrapped(true);
    }
  }, [bootstrapped]);

  const handleLoginSuccess = ({ token = null, user, source = "api" }) => {
    if (token) setAuthToken(token);
    else setAuthToken(null);
    setSession({ token: token || null, user, source });
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.setItem(USER_KEY, JSON.stringify(user));
    window.localStorage.setItem(SOURCE_KEY, source);
  };

  const handleLogout = () => {
    setSession(null);
    setAuthToken(null);
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(USER_KEY);
    window.localStorage.removeItem(SOURCE_KEY);
  };

  const hasAccessToAdmin = session?.user?.role === "ADMIN" || session?.user?.role === "VENDEDOR";
  
  if (bootstrapped && session && hasAccessToAdmin) {
    return <AdminShell session={session} onLogout={handleLogout} />;
  }

  if (!bootstrapped) {
    return <div className="min-h-screen flex items-center justify-center">Cargando...</div>;
  }

  if (!session) {
    return <Login onLogin={handleLoginSuccess} />;
  }

  return (
    <div className="app-shell">
      <main className="app-card">
        <header className="brand">
          <div>
            <p className="brand__eyebrow">CB Medic</p>
            <h1 className="brand__title">Portal de Farmacia</h1>
          </div>
          <div className="brand__status">
            <span className="pill">{session.source === "demo" ? "Demo" : "Sesion activa"}</span>
            <p>{session.user.fullName}</p>
          </div>
        </header>
        <Dashboard user={session.user} source={session.source} onLogout={handleLogout} />
      </main>
    </div>
  );
}

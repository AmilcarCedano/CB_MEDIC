import { useEffect, useState } from "react";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import AdminShell from "./pages/admin/AdminShell.jsx";
import LoadingScreen from "./components/LoadingScreen.jsx";
import { api } from "./lib/api.js";
import "./App.css";

const USER_KEY = "cb_user";
const SOURCE_KEY = "cb_source";

export default function App() {
  const [session, setSession] = useState(null);
  const [bootstrapped, setBootstrapped] = useState(false);
  // Tiempo mínimo del loader de arranque para que la animación se aprecie
  // aunque la restauración de sesión sea instantánea (en producción la
  // latencia real puede extenderlo de forma natural).
  const [minSplashDone, setMinSplashDone] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMinSplashDone(true), 1400);
    return () => clearTimeout(timer);
  }, []);

  // El token vive en una cookie httpOnly (no accesible desde JS), así que la
  // única forma confiable de restaurar la sesión al recargar es preguntarle
  // al backend (la cookie viaja sola en la request gracias a withCredentials).
  useEffect(() => {
    if (bootstrapped) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get("/auth/me");
        if (cancelled) return;
        const source = window.localStorage.getItem(SOURCE_KEY) || "api";
        setSession({ user: data.user, source });
        window.localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      } catch {
        // Sin sesión válida (nunca inició sesión, o la cookie expiró/es inválida)
        window.localStorage.removeItem(USER_KEY);
        window.localStorage.removeItem(SOURCE_KEY);
      } finally {
        if (!cancelled) setBootstrapped(true);
      }
    })();
    return () => { cancelled = true; };
  }, [bootstrapped]);

  const handleLoginSuccess = ({ user, source = "api" }) => {
    setSession({ user, source });
    window.localStorage.setItem(USER_KEY, JSON.stringify(user));
    window.localStorage.setItem(SOURCE_KEY, source);
  };

  const handleLogout = () => {
    setSession(null);
    window.localStorage.removeItem(USER_KEY);
    window.localStorage.removeItem(SOURCE_KEY);
    api.post("/auth/logout").catch(() => {});
  };

  // Si el interceptor de axios detecta un 401 (token inválido/expirado) en
  // cualquier request, cerramos sesión sola en vez de dejar un error crudo
  // en pantalla — ver interceptor de respuesta en lib/api.js.
  useEffect(() => {
    const handleSessionExpired = () => handleLogout();
    window.addEventListener("cb:session-expired", handleSessionExpired);
    return () => window.removeEventListener("cb:session-expired", handleSessionExpired);
  }, []);

  const hasAccessToAdmin = session?.user?.role === "ADMIN" || session?.user?.role === "VENDEDOR";
  
  if (!bootstrapped || !minSplashDone) {
    return <LoadingScreen />;
  }

  if (session && hasAccessToAdmin) {
    return <AdminShell session={session} onLogout={handleLogout} />;
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

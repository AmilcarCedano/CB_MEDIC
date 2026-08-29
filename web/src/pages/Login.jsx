import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { consumeSessionNotice } from "../lib/sessionMessages.js";
import LoadingScreen from "../components/LoadingScreen.jsx";
import { Stethoscope, Lock, User, LogIn, AlertCircle, Building2, ShieldCheck, Activity, Eye, EyeOff } from "lucide-react";

const SESSION_NOTICE_MESSAGES = {
  inactivity: "Tu sesión se cerró automáticamente por inactividad. Vuelve a iniciar sesión.",
  expired: "Tu sesión expiró. Vuelve a iniciar sesión para continuar.",
};

export default function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [logoLoadFailed, setLogoLoadFailed] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const reason = consumeSessionNotice();
    if (reason && SESSION_NOTICE_MESSAGES[reason]) {
      setNotice(SESSION_NOTICE_MESSAGES[reason]);
    }
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setIsSubmitting(true);
    // Tiempo mínimo de visualización del loader (solo en éxito) para que
    // la transición se aprecie también cuando la respuesta es instantánea.
    const MIN_LOADER_MS = 1400;
    const startedAt = Date.now();
    try {
      const { data } = await api.post("/auth/login", { username, password });
      const remaining = MIN_LOADER_MS - (Date.now() - startedAt);
      if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
      onLogin({ ...data, source: "api" });
    } catch (err) {
      const message =
        err?.response?.data?.error || "No se pudo iniciar sesión. Verifica tus credenciales.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {isSubmitting && <LoadingScreen message="Iniciando sesión..." />}

      {/* Left Side - Image/Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden items-center justify-center bg-gradient-to-br from-blue-700 via-indigo-700 to-cyan-700">
        {/* Decorative elements */}
        <div className="absolute inset-0">
          <div className="absolute top-[-6rem] left-[-4rem] w-96 h-96 bg-cyan-300/20 rounded-full blur-3xl" />
          <div className="absolute bottom-[-8rem] right-[-6rem] w-[28rem] h-[28rem] bg-indigo-400/25 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
        </div>
        {/* Subtle grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center justify-center text-white px-12 max-w-lg text-center">
          {/* Logo/Icon */}
          <div className="inline-flex items-center justify-center w-32 h-32 bg-white/15 backdrop-blur-md rounded-[2rem] shadow-2xl ring-1 ring-white/25 mb-8 overflow-hidden relative">
            {logoLoadFailed ? (
              <Stethoscope size={64} className="text-white" aria-hidden="true" />
            ) : (
              <img
                src={`${import.meta.env.VITE_API_URL !== undefined ? import.meta.env.VITE_API_URL : "http://localhost:4000"}/uploads/system-logo.png`}
                alt="Logo"
                className="w-full h-full object-contain p-2"
                onError={() => setLogoLoadFailed(true)}
              />
            )}
          </div>

          <h1 className="text-6xl font-extrabold tracking-tight drop-shadow-sm">
            CB Medic
          </h1>
          <p className="mt-4 text-lg text-blue-100/90 font-medium leading-relaxed">
            Sistema integral de gestión farmacéutica
          </p>

          {/* Feature badges */}
          <div className="mt-10 grid grid-cols-1 gap-3 w-full">
            <div className="flex items-center gap-3 text-left bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3 ring-1 ring-white/15">
              <ShieldCheck size={20} className="text-cyan-200 flex-shrink-0" aria-hidden="true" />
              <span className="text-sm text-blue-50/90">Acceso seguro y protegido</span>
            </div>
            <div className="flex items-center gap-3 text-left bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3 ring-1 ring-white/15">
              <Activity size={20} className="text-cyan-200 flex-shrink-0" aria-hidden="true" />
              <span className="text-sm text-blue-50/90">Control de inventario en tiempo real</span>
            </div>
            <div className="flex items-center gap-3 text-left bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3 ring-1 ring-white/15">
              <Building2 size={20} className="text-cyan-200 flex-shrink-0" aria-hidden="true" />
              <span className="text-sm text-blue-50/90">Gestión centralizada de farmacia</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-5 py-10 sm:p-8">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl shadow-lg shadow-indigo-500/30 mb-4">
              <Stethoscope size={32} className="text-white" aria-hidden="true" />
            </div>
            <h1 className="text-3xl font-extrabold text-gray-900">CB Medic</h1>
            <p className="text-gray-500 mt-1 text-sm">Sistema Farmacéutico</p>
          </div>

          {/* Login Card */}
          <div className="bg-white/90 backdrop-blur rounded-2xl shadow-xl shadow-slate-200/60 p-7 sm:p-8 border border-gray-100">
            <div className="mb-7">
              <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Iniciar Sesión</h2>
              <p className="text-gray-500 mt-1.5">Ingresa tus credenciales para continuar</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Username Field */}
              <div className="space-y-2">
                <label htmlFor="login-username" className="block text-sm font-medium text-gray-700">
                  Usuario
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <User size={20} className="text-gray-400 group-focus-within:text-indigo-500 transition-colors" aria-hidden="true" />
                  </div>
                  <input
                    id="login-username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Ingresa tu usuario"
                    autoComplete="username"
                    disabled={isSubmitting}
                    required
                    className="w-full min-h-[48px] pl-11 pr-4 py-3 bg-gray-50/80 border border-gray-200 rounded-2xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <label htmlFor="login-password" className="block text-sm font-medium text-gray-700">
                  Contraseña
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Lock size={20} className="text-gray-400 group-focus-within:text-indigo-500 transition-colors" aria-hidden="true" />
                  </div>
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Ingresa tu contraseña"
                    autoComplete="current-password"
                    disabled={isSubmitting}
                    required
                    className="w-full min-h-[48px] pl-11 pr-11 py-3 bg-gray-50/80 border border-gray-200 rounded-2xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    disabled={isSubmitting}
                    tabIndex={-1}
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {showPassword ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
                  </button>
                </div>
              </div>

              {/* Aviso de sesión cerrada (inactividad / token expirado) */}
              {notice && !error && (
                <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl" role="status">
                  <AlertCircle size={20} className="text-amber-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <p className="text-amber-700 text-sm leading-snug">{notice}</p>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl" role="alert">
                  <AlertCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <p className="text-red-700 text-sm leading-snug">{error}</p>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full min-h-[48px] py-3.5 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-2xl shadow-lg shadow-indigo-500/30 transition-all duration-200 transform hover:scale-[1.02] hover:shadow-indigo-500/40 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Conectando...
                  </>
                ) : (
                  <>
                    <LogIn size={20} aria-hidden="true" />
                    Ingresar al Sistema
                  </>
                )}
              </button>
            </form>

            {/* Footer */}
            <div className="mt-7 pt-6 border-t border-gray-100">
              <p className="text-center text-sm text-gray-400">
                © 2025 CB Medic · Sistema Farmacéutico
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

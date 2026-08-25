// Pequeño helper para pasar el motivo de un cierre de sesión automático
// (token expirado / inactividad) desde donde ocurre (interceptor de axios,
// hook de inactividad) hasta la pantalla de Login, sin depender de un router.
const REASON_KEY = 'cb_session_notice';

export function setSessionNotice(reason) {
  try {
    sessionStorage.setItem(REASON_KEY, reason);
  } catch {
    // sessionStorage no disponible (modo privado, etc.) — no es crítico
  }
}

export function consumeSessionNotice() {
  try {
    const reason = sessionStorage.getItem(REASON_KEY);
    if (reason) sessionStorage.removeItem(REASON_KEY);
    return reason;
  } catch {
    return null;
  }
}

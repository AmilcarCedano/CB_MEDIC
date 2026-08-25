import { useEffect, useRef } from "react";
import { setSessionNotice } from "../lib/sessionMessages.js";

const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutos sin actividad
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];

/**
 * Cierra la sesión sola cuando no hay actividad del usuario (mouse, teclado,
 * touch, scroll) durante `timeoutMs`. Pensado para un punto de venta donde
 * la PC puede quedar desatendida con la sesión abierta.
 */
export default function useInactivityLogout(onTimeout, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const timerRef = useRef(null);
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  useEffect(() => {
    const resetTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setSessionNotice("inactivity");
        onTimeoutRef.current();
      }, timeoutMs);
    };

    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, resetTimer));
    };
  }, [timeoutMs]);
}

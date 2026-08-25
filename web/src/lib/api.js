import axios from "axios";
import { setSessionNotice } from "./sessionMessages.js";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "",
  // El token de sesión viaja en una cookie httpOnly (cb_token), no en JS —
  // withCredentials hace que el navegador la mande/reciba en cada request.
  withCredentials: true,
});

// Interceptor de request: agrega headers auxiliares NO sensibles (contexto
// de farmacia seleccionada, hints de usuario para filtros). La autenticación
// real va en la cookie httpOnly, enviada automáticamente por el navegador.
api.interceptors.request.use((config) => {
  const userStr = localStorage.getItem('cb_user');
  const targetFarmaciaId = localStorage.getItem('cb_target_farmacia_id');

  if (targetFarmaciaId) {
    config.headers['x-farmacia-id'] = targetFarmaciaId;
  }

  if (userStr) {
    try {
      const user = JSON.parse(userStr);
      if (user.id) config.headers['x-user-id'] = user.id;
      if (user.role) config.headers['x-user-role'] = user.role;
      // Si el usuario tiene una farmacia fija, la usamos como fallback si no hay una seleccionada dinamicamente
      if (!targetFarmaciaId && user.farmacia?.id) {
        config.headers['x-farmacia-id'] = user.farmacia.id;
      }
    } catch (e) {
      console.error('Error parsing user from localStorage:', e);
    }
  }
  return config;
});

// Interceptor de respuesta: ante un 401 en una request ya autenticada (no el
// login ni la verificación de sesión al arrancar la app), cerramos sesión
// sola en vez de dejar que cada pantalla muestre su propio error crudo.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const requestUrl = error?.config?.url || '';
    const isAuthBootstrap = requestUrl.includes('/auth/login') || requestUrl.includes('/auth/me');

    if (status === 401 && !isAuthBootstrap) {
      setSessionNotice('expired');
      window.dispatchEvent(new CustomEvent('cb:session-expired'));
    }

    return Promise.reject(error);
  }
);

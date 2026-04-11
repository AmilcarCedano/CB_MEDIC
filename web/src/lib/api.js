import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:4000",
});

// Interceptor para agregar headers de sesión y autenticación
api.interceptors.request.use((config) => {
  // Agregar Token de Autenticación (Bearer)
  const token = localStorage.getItem('cb_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Agregar headers auxiliares para compatibilidad legacy o filtros específicos
  const userStr = localStorage.getItem('cb_user') || localStorage.getItem('user');
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

export function setAuthToken(token) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

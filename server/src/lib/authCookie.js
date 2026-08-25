// Opciones de la cookie httpOnly que reemplaza el JWT en localStorage.
// Login, logout y el middleware de auth deben usar exactamente el mismo
// nombre/opciones (clearCookie solo borra si coinciden).
const COOKIE_NAME = 'cb_token';
const MAX_AGE_MS = 10 * 60 * 60 * 1000; // igual al expiresIn del JWT (10h)

function getCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_MS,
  };
}

module.exports = { COOKIE_NAME, getCookieOptions };

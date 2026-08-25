const router = require('express').Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const { logAudit } = require('../lib/audit');
const { authenticate } = require('../middleware/auth');
const { COOKIE_NAME, getCookieOptions } = require('../lib/authCookie');

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Falta usuario o contrasena' });
    }

    const user = await prisma.user.findUnique({
      where: { username },
      include: { farmacia: true },
    });
    
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Credenciales invalidas' });
    }

    let passwordValid = false;
    try {
      passwordValid = await bcrypt.compare(password, user.passwordHash);
    } catch (bcryptErr) {
      console.error('[Auth] Error comparando contraseña:', bcryptErr);
      passwordValid = false;
    }

    if (!passwordValid) {
      return res.status(401).json({ error: 'Credenciales invalidas' });
    }

    const payload = {
      sub: user.id,
      role: user.role,
      farmaciaId: user.farmaciaId ?? null,
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: '10h',
    });

    // Log auditoria ANTES de enviar respuesta
    logAudit({
      farmaciaId: user.farmaciaId || 0,
      usuarioId: user.id,
      accion: 'LOGIN',
      modulo: 'AUTENTICACION',
      descripcion: `Inicio de sesión: ${user.fullName} (${user.username})`,
      ip: req.ip
    }).catch(err => console.error('[Audit Log Error]', err));

    // El token viaja en una cookie httpOnly (no accesible desde JS en el
    // navegador) en vez de en el body — mitiga robo de token vía XSS.
    res.cookie(COOKIE_NAME, token, getCookieOptions());

    return res.json({
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        isActive: user.isActive,
        farmacia: user.farmacia
          ? { id: user.farmacia.id, nombre: user.farmacia.nombre }
          : null,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Login fallo' });
  }
});

// GET /auth/me — restaura la sesión al recargar la página, validando la
// cookie httpOnly (el frontend ya no tiene el token para decidir por sí solo).
router.get('/me', authenticate, async (req, res) => {
  const user = req.user;
  return res.json({
    user: {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      isActive: user.isActive,
      farmacia: user.farmacia
        ? { id: user.farmacia.id, nombre: user.farmacia.nombre }
        : null,
    },
  });
});

// POST /auth/logout — borra la cookie httpOnly en el navegador.
router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, getCookieOptions());
  return res.status(204).end();
});

module.exports = router;

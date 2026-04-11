const router = require('express').Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const { logAudit } = require('../lib/audit');

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
      // Fallback for plain text passwords (legacy data)
      if (user.passwordHash === password) {
        console.warn(`[WARN] Usuario ${user.username} tiene contraseña en texto plano.`);
        passwordValid = true;
      }
    }

    // Additional fallback if bcrypt returns false but password matches plain text
    if (!passwordValid && user.passwordHash === password) {
      console.warn(`[WARN] Usuario ${user.username} validado con texto plano fallback.`);
      passwordValid = true;
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

    return res.json({
      token,
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

module.exports = router;

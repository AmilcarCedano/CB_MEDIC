const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');

/**
 * Middleware de autenticación JWT
 * Verifica el token JWT y establece los datos del usuario autenticado
 * NO usa headers de cliente confiables - todo viene del JWT verificado
 */
const authenticate = async (req, res, next) => {
  try {
    // Obtener token del header Authorization: Bearer <token>
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token de autenticación requerido' });
    }

    const token = authHeader.substring(7); // Remover 'Bearer '

    // Verificar JWT_SECRET
    if (!process.env.JWT_SECRET) {
      console.error('[CRITICAL] JWT_SECRET no configurado');
      return res.status(500).json({ error: 'Error de configuración del servidor' });
    }

    // Verificar token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtErr) {
      if (jwtErr.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expirado', expired: true });
      }
      return res.status(401).json({ error: 'Token inválido' });
    }

    // Validar que el token tenga los campos necesarios
    if (!decoded.sub) {
      return res.status(401).json({ error: 'Token incompleto' });
    }
    
    // farmaciaId puede ser null para admins, pero debe existir en el token
    if (!('farmaciaId' in decoded)) {
      return res.status(401).json({ error: 'Token incompleto - falta farmaciaId' });
    }

    // Buscar usuario en base de datos para verificar que sigue activo
    const userId = Number(decoded.sub);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { farmacia: true },
    });

    if (!user) {
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }

    if (!user.isActive) {
      return res.status(401).json({ error: 'Usuario desactivado' });
    }

    // Verificar que el usuario pertenezca a la farmacia del token
    // Si el usuario es ADMIN, permitimos que actúe sobre cualquier farmaciaId (del query o del token)
    // Si no es ADMIN, debe coincidir exactamente con el de su usuario
    const tokenFarmaciaId = decoded.farmaciaId;
    const userFarmaciaId = user.farmaciaId;

    if (user.role !== 'ADMIN') {
      // Para vendedores, validamos que el farmaciaId del token sea igual al de su perfil
      if (userFarmaciaId !== tokenFarmaciaId) {
        return res.status(403).json({ error: 'Farmacia no válida para este usuario' });
      }
    }

    // Determinar farmaciaId efectiva
    // 1. Prioridad: Header x-farmacia-id (Enviado por el cliente cuando selecciona una sede)
    // 2. Query param ?farmaciaId=
    // 3. Farmacia del token (Si tiene una fija)
    // 4. Perfil de usuario en DB
    let effectiveFarmaciaId = req.headers['x-farmacia-id'] || req.query.farmaciaId || tokenFarmaciaId || userFarmaciaId;
    
    // Si sigue siendo null y es ADMIN, permitimos que siga (pero req.farmaciaId será null)
    // Pero si es VENDEDOR, es un error fatal de contexto
    if (user.role === 'VENDEDOR' && !effectiveFarmaciaId) {
       return res.status(400).json({ error: 'Contexto de farmacia requerido para este rol.' });
    }

    // Establecer datos en el request
    req.userId = user.id;
    req.userRole = user.role;
    req.farmaciaId = effectiveFarmaciaId ? Number(effectiveFarmaciaId) : null;
    req.user = user;

    next();
  } catch (err) {
    console.error('[Auth Middleware Error]', err);
    return res.status(500).json({ error: 'Error en autenticación' });
  }
};

/**
 * Middleware para verificar que el usuario sea ADMIN
 * Debe usarse DESPUÉS de authenticate
 */
const requireAdmin = (req, res, next) => {
  if (req.userRole !== 'ADMIN') {
    return res.status(403).json({ error: 'Acceso denegado. Se requiere rol de Administrador.' });
  }
  next();
};

/**
 * Middleware para verificar que el usuario sea VENDEDOR o ADMIN
 * Debe usarse DESPUÉS de authenticate
 */
const requireVendedorOrAdmin = (req, res, next) => {
  if (req.userRole !== 'VENDEDOR' && req.userRole !== 'ADMIN') {
    return res.status(403).json({ error: 'Acceso denegado. Rol no autorizado.' });
  }
  next();
};

/**
 * Middleware para aplicar filtro de 24 horas en consultas
 * Los vendedores solo ven registros de las últimas 24 horas
 * Los admins ven todo
 * @param {string} dateField - Campo de fecha a filtrar (default: 'createdAt')
 */
const applyTimeFilter = (dateField = 'createdAt') => {
  return (req, res, next) => {
    // Si es vendedor, establecer filtro de tiempo
    if (req.userRole === 'VENDEDOR') {
      req.timeFilter = {
        [dateField]: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 horas atrás
        },
      };
    } else {
      // Admin no tiene filtro de tiempo
      req.timeFilter = {};
    }
    next();
  };
};

module.exports = {
  authenticate,
  requireAdmin,
  requireVendedorOrAdmin,
  applyTimeFilter,
};

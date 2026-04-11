const router = require('express').Router();
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const { logAudit } = require('../lib/audit');
const { requireAdmin } = require('../middleware/auth');

const sanitizeUser = (user) => ({
  id: user.id,
  username: user.username,
  fullName: user.fullName,
  role: user.role,
  isActive: user.isActive,
  farmaciaId: user.farmaciaId,
  farmacia: user.farmacia
    ? {
        id: user.farmacia.id,
        nombre: user.farmacia.nombre,
      }
    : null,
  horario: user.horario,
  createdAt: user.createdAt,
});
// PUT /api/users/profile - Actualizar perfil propio (Nombre)
router.get('/profile', async (req, res) => {
  try {
     const user = await prisma.user.findUnique({
       where: { id: req.userId },
       include: { farmacia: true }
     });
     res.json(sanitizeUser(user));
  } catch(err) {
     res.status(500).json({ error: 'Error al obtener perfil' });
  }
});

router.put('/profile', async (req, res) => {
  try {
    const { fullName, username } = req.body;
    
    const data = {};
    if (fullName) data.fullName = fullName.trim();
    if (username) {
      const trimmedUsername = username.trim();
      // Verificar si el username ya está en uso por otro usuario
      const existing = await prisma.user.findUnique({
        where: { username: trimmedUsername }
      });
      if (existing && existing.id !== req.userId) {
        return res.status(400).json({ error: 'El nombre de usuario ya está en uso.' });
      }
      data.username = trimmedUsername;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'No se enviaron datos para actualizar.' });
    }

    const user = await prisma.user.update({
      where: { id: req.userId },
      data,
      include: { farmacia: true }
    });

    logAudit({
      farmaciaId: user.farmaciaId || 0,
      usuarioId: req.userId,
      accion: 'EDITAR_PERFIL',
      modulo: 'USUARIOS',
      descripcion: `Usuario actualizó su perfil (Nombre: ${user.fullName}, Username: ${user.username})`
    });

    return res.json(sanitizeUser(user));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'No se pudo actualizar el perfil' });
  }
});

// GET /api/users - Listar usuarios
// Admin: puede ver usuarios de todas las farmacias o filtrar por farmacia
// Vendedor: solo ve usuarios de su farmacia
router.get('/', async (req, res) => {
  try {
    const userRole = req.userRole;
    const userFarmaciaId = req.farmaciaId;
    const requestedFarmaciaId = req.query.farmaciaId ? Number(req.query.farmaciaId) : undefined;

    let where = {};

    if (userRole === 'VENDEDOR') {
      // Vendedor solo ve usuarios de su farmacia
      where.farmaciaId = userFarmaciaId;
    } else if (userRole === 'ADMIN') {
      // Admin puede filtrar por farmacia específica
      if (requestedFarmaciaId) {
        where.farmaciaId = requestedFarmaciaId;
      }
    }

    // REGLA: Ocultar siempre al administrador global ('admin') de las listas comunes
    where.username = { not: 'admin' };

    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { farmacia: true, horario: true },
    });

    return res.json(users.map(sanitizeUser));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'No se pudieron listar los usuarios' });
  }
});

// POST /api/users - Crear usuario (solo ADMIN)
// POST /api/users - Crear usuario (abierto a todos los autenticados, segun requerimiento)
router.post('/', async (req, res) => {
  try {
    const { username, fullName, password, farmaciaId, role = 'VENDEDOR', horario } = req.body || {};

    if (!username || !fullName || !password || !farmaciaId) {
      return res.status(400).json({ error: 'username, fullName, password y farmaciaId son obligatorios' });
    }

    // Validar que el rol sea válido
    if (role !== 'VENDEDOR' && role !== 'ADMIN') {
      return res.status(400).json({ error: 'Rol inválido. Debe ser VENDEDOR o ADMIN' });
    }

    const hash = await bcrypt.hash(password, 10);
    const schedule = horario || {
      lunes: true, martes: true, miercoles: true, jueves: true, viernes: true, sabado: false, domingo: false,
      horaInicio: '08:00',
      horaFin: '18:00'
    };

    const user = await prisma.user.create({
      data: {
        username: username.trim(),
        fullName: fullName.trim(),
        passwordHash: hash,
        farmaciaId: Number(farmaciaId),
        role: role,
        horario: {
          create: {
            lunes: schedule.lunes ?? true,
            martes: schedule.martes ?? true,
            miercoles: schedule.miercoles ?? true,
            jueves: schedule.jueves ?? true,
            viernes: schedule.viernes ?? true,
            sabado: schedule.sabado ?? false,
            domingo: schedule.domingo ?? false,
            horaInicio: new Date(`1970-01-01T${schedule.horaInicio || '08:00'}:00.000Z`),
            horaFin: new Date(`1970-01-01T${schedule.horaFin || '18:00'}:00.000Z`),
          },
        },
      },
      include: { farmacia: true, horario: true },
    });

    logAudit({
      farmaciaId: Number(farmaciaId),
      usuarioId: req.userId,
      accion: 'CREAR',
      modulo: 'USUARIOS',
      descripcion: `Usuario creado: ${fullName} (${username}) - Rol: ${role}`
    });

    return res.status(201).json(sanitizeUser(user));
  } catch (err) {
    console.error(err);
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Ese nombre de usuario ya existe' });
    }
    return res.status(500).json({ error: 'No se pudo crear el usuario' });
  }
});

// PUT /api/users/:id - Actualizar usuario
// Admin puede editar cualquier usuario
// Vendedor solo puede editar su propio perfil (no su rol ni farmacia)
router.put('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'ID invalido' });

    const currentUserId = req.userId;
    const currentUserRole = req.userRole;
    const currentUserFarmaciaId = req.farmaciaId;

    const { fullName, username, farmaciaId, isActive, role, horario } = req.body || {};

    // Verificar que el usuario existe
    const existingUser = await prisma.user.findUnique({
      where: { id },
      include: { farmacia: true }
    });

    if (!existingUser) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Verificar permisos
    if (currentUserRole === 'VENDEDOR') {
      // Vendedor solo puede editar su propio perfil
      if (id !== currentUserId) {
        return res.status(403).json({ error: 'No tienes permiso para editar este usuario' });
      }
      // Vendedor no puede cambiar su rol ni su farmacia
      if (role !== undefined && role !== existingUser.role) {
        return res.status(403).json({ error: 'No puedes cambiar tu propio rol' });
      }
      if (farmaciaId !== undefined && farmaciaId !== existingUser.farmaciaId) {
        return res.status(403).json({ error: 'No puedes cambiar tu farmacia asignada' });
      }
    }

    // Admin no puede editar a otros admins (solo a sí mismo)
    if (currentUserRole === 'ADMIN' && existingUser.role === 'ADMIN' && id !== currentUserId) {
      return res.status(403).json({ error: 'No puedes editar a otros administradores' });
    }

    const data = {
      fullName: fullName?.trim() || existingUser.fullName,
      username: username?.trim() || existingUser.username,
    };

    if (typeof isActive === 'boolean') data.isActive = isActive;

    // Solo admin puede cambiar farmacia y rol
    if (currentUserRole === 'ADMIN') {
      if (farmaciaId !== undefined) {
        data.farmacia = {
          connect: { id: Number(farmaciaId) },
        };
      }
      if (role !== undefined) {
        data.role = role;
      }
    }

    if (horario) {
      const { horaInicio, horaFin, ...dias } = horario;
      const scheduleData = {
        ...dias,
        horaInicio: new Date(`1970-01-01T${horaInicio}:00.000Z`),
        horaFin: new Date(`1970-01-01T${horaFin}:00.000Z`),
        userId: id,
      };
      await prisma.horario.upsert({
        where: { userId: id },
        update: scheduleData,
        create: scheduleData,
      });
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      include: { farmacia: true, horario: true },
    });

    logAudit({
      farmaciaId: user.farmaciaId || 0,
      usuarioId: currentUserId,
      accion: 'EDITAR',
      modulo: 'USUARIOS',
      descripcion: `Usuario editado: ${user.fullName} (ID: ${id})`
    });

    return res.json(sanitizeUser(user));
  } catch (err) {
    console.error(err);
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Ese nombre de usuario ya existe' });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    return res.status(500).json({ error: 'No se pudo actualizar el usuario' });
  }
});

// PUT /api/users/:id/password - Cambiar contraseña
// Un usuario puede cambiar su propia contraseña
// Admin puede cambiar cualquier contraseña
router.put('/:id/password', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'ID invalido' });

    const currentUserId = req.userId;
    const currentUserRole = req.userRole;
    const { password, currentPassword } = req.body || {};

    // Verificar permisos
    if (currentUserRole !== 'ADMIN' && id !== currentUserId) {
      return res.status(403).json({ error: 'No tienes permiso para cambiar esta contraseña' });
    }

    if (!password || password.length < 4) {
      return res.status(400).json({ error: 'La contraseña es obligatoria (minimo 4 caracteres)' });
    }

    // Si es el propio usuario (y no admin), verificar contraseña actual
    if (id === currentUserId && currentUserRole !== 'ADMIN') {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Debes proporcionar tu contraseña actual' });
      }

      const user = await prisma.user.findUnique({ where: { id } });
      const validPassword = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!validPassword) {
        return res.status(401).json({ error: 'Contraseña actual incorrecta' });
      }
    }

    const hash = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { id },
      data: { passwordHash: hash },
    });

    logAudit({
      farmaciaId: req.farmaciaId || 0,
      usuarioId: currentUserId,
      accion: 'CAMBIO_PASSWORD',
      modulo: 'USUARIOS',
      descripcion: `Contraseña cambiada para usuario ID: ${id}`
    });

    return res.json({ ok: true, message: 'Contraseña actualizada correctamente' });
  } catch (err) {
    console.error(err);
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    return res.status(500).json({ error: 'No se pudo actualizar la contraseña' });
  }
});

// DELETE /api/users/:id - Eliminar usuario (solo ADMIN)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'ID invalido' });

    const currentUserId = req.userId;

    // No permitir eliminarse a sí mismo
    if (id === currentUserId) {
      return res.status(400).json({ error: 'No puedes eliminarte a ti mismo' });
    }

    // Verificar que el usuario existe y obtener sus datos
    const user = await prisma.user.findUnique({
      where: { id },
      include: { farmacia: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // No permitir eliminar a otros admins
    if (user.role === 'ADMIN') {
      return res.status(403).json({ error: 'No puedes eliminar a otros administradores' });
    }

    await prisma.user.delete({ where: { id } });

    logAudit({
      farmaciaId: user.farmaciaId || 0,
      usuarioId: currentUserId,
      accion: 'ELIMINAR',
      modulo: 'USUARIOS',
      descripcion: `Usuario eliminado: ${user.fullName} (${user.username}) - Rol: ${user.role}`
    });

    return res.status(204).send();
  } catch (err) {
    console.error(err);
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    return res.status(500).json({ error: 'No se pudo eliminar el usuario' });
  }
});

module.exports = router;

const router = require('express').Router();
const prisma = require('../lib/prisma');

// GET /auditoria?farmaciaId=1&page=1&limit=50&modulo=VENTAS&accion=CREAR&desde=2026-01-01&hasta=2026-12-31
router.get('/', async (req, res) => {
  try {
    const farmaciaId = Number(req.query.farmaciaId);
    if (!farmaciaId) return res.status(400).json({ error: 'farmaciaId requerido' });

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const skip = (page - 1) * limit;

    const where = { farmaciaId };

    // Si es vendedor, solo ve las últimas 24 horas
    if (req.userRole === 'VENDEDOR') {
      where.fecha = {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
      };
    }

    if (req.query.modulo) {
      where.modulo = req.query.modulo.toUpperCase();
    }
    if (req.query.accion) {
      where.accion = req.query.accion.toUpperCase();
    }
    if (req.query.usuarioId) {
      where.usuarioId = Number(req.query.usuarioId);
    }
    if (req.query.desde || req.query.hasta) {
      where.fecha = {};
      if (req.query.desde) where.fecha.gte = new Date(req.query.desde);
      if (req.query.hasta) {
        const hasta = new Date(req.query.hasta);
        hasta.setHours(23, 59, 59, 999);
        where.fecha.lte = hasta;
      }
    }

    const [total, logs] = await Promise.all([
      prisma.auditoria.count({ where }),
      prisma.auditoria.findMany({
        where,
        orderBy: { fecha: 'desc' },
        skip,
        take: limit,
        include: {
          usuario: {
            select: { id: true, username: true, fullName: true, role: true },
          },
        },
      }),
    ]);

    return res.json({
      data: logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'No se pudo obtener el registro de auditoría' });
  }
});

// GET /auditoria/stats?farmaciaId=1
router.get('/stats', async (req, res) => {
  try {
    const farmaciaId = Number(req.query.farmaciaId);
    if (!farmaciaId) return res.status(400).json({ error: 'farmaciaId requerido' });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [totalHoy, porModulo, porAccion] = await Promise.all([
      prisma.auditoria.count({ where: { farmaciaId, fecha: { gte: today, lt: tomorrow } } }),
      prisma.auditoria.groupBy({
        by: ['modulo'],
        where: { farmaciaId },
        _count: true,
        orderBy: { _count: { modulo: 'desc' } },
        take: 10,
      }),
      prisma.auditoria.groupBy({
        by: ['accion'],
        where: { farmaciaId },
        _count: true,
        orderBy: { _count: { accion: 'desc' } },
        take: 10,
      }),
    ]);

    return res.json({
      totalHoy,
      porModulo: porModulo.map((m) => ({ modulo: m.modulo, count: m._count })),
      porAccion: porAccion.map((a) => ({ accion: a.accion, count: a._count })),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'No se pudieron obtener las estadísticas' });
  }
});

// POST /auditoria
router.post('/', async (req, res) => {
  try {
    const { farmaciaId, modulo, accion, descripcion, usuarioId } = req.body;

    if (!farmaciaId || !modulo || !accion || !descripcion) {
      return res.status(400).json({ error: 'Faltan campos obligatorios para la auditoría.' });
    }

    const log = await prisma.auditoria.create({
      data: {
        farmaciaId: Number(farmaciaId),
        usuarioId: usuarioId ? Number(usuarioId) : null,
        modulo: modulo.toUpperCase(),
        accion: accion.toUpperCase(),
        descripcion,
        ip: req.ip || '0.0.0.0',
        fecha: new Date(),
      },
    });

    return res.status(201).json(log);
  } catch (err) {
    console.error('Error creating audit log:', err);
    return res.status(500).json({ error: 'No se pudo crear el registro de auditoría.' });
  }
});

module.exports = router;

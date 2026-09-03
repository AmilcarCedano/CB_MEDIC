const router = require('express').Router();
const prisma = require('../lib/prisma');
const { requireAdmin } = require('../middleware/auth');

// GET /error-logs?limit=100 - Solo ADMIN.
// Errores técnicos recientes del servidor, persistidos en BD (no en docker logs,
// que se pierde cada vez que el contenedor se recrea en un deploy).
router.get('/', requireAdmin, async (req, res) => {
  try {
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 100));
    const logs = await prisma.errorlog.findMany({
      orderBy: { fecha: 'desc' },
      take: limit,
    });
    return res.json(logs);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'No se pudieron obtener los logs de error' });
  }
});

module.exports = router;

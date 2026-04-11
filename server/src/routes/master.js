const router = require('express').Router();
const prisma = require('../lib/prisma');
const { requireAdmin } = require('../middleware/auth');

router.get('/summary', async (_req, res) => {
  try {
    const [lastImport, totalProductos] = await Promise.all([
      prisma.masterimportlog.findFirst({
        orderBy: { createdAt: 'desc' },
      }),
      prisma.productomaestro.count(),
    ]);

    return res.json({
      lastImport,
      totalProductos,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'No se pudo obtener el resumen' });
  }
});

router.get('/products', async (req, res) => {
  try {
    const query = req.query.q;
    if (!query || query.length < 3) {
      return res.json([]);
    }
    const productos = await prisma.productomaestro.findMany({
      where: {
        nombre: { contains: query },
      },
      take: 15,
      orderBy: { nombre: 'asc' },
    });
    return res.json(productos);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'No se pudo buscar en la base maestra' });
  }
});

router.post('/import', requireAdmin, async (req, res) => {
  try {
    const { filename, importedBy, productos } = req.body || {};
    if (!filename || !importedBy) {
      return res.status(400).json({ error: 'filename e importedBy son obligatorios' });
    }

    if (Array.isArray(productos) && productos.length > 0) {
      await prisma.$transaction([
        prisma.productomaestro.deleteMany({}),
        prisma.productomaestro.createMany({
          data: productos.map((item) => ({
            productoDigemidId: item.productoDigemidId || null,
            nombre: item.nombre || 'Sin nombre',
            concentracion: item.concentracion || null,
            formaFarmaceutica: item.formaFarmaceutica || null,
            presentacion: item.presentacion || null,
            registroSanitario: item.registroSanitario || null,
            laboratorio: item.laboratorio || null,
            fabricante: item.fabricante || null,
            rubro: item.rubro || null,
            principioActivo: item.principioActivo || null,
            fraccion: item.fraccion || null,
            situacion: item.situacion || null,
          })),
        }),
      ]);
    }

    const log = await prisma.masterimportlog.create({
      data: {
        filename,
        importedBy,
        totalProductos: Array.isArray(productos) ? productos.length : 0,
      },
    });

    return res.status(201).json({ log });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'No se pudo registrar la importacion' });
  }
});

module.exports = router;

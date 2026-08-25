const router = require('express').Router();
const prisma = require('../lib/prisma');
const { requireAdmin } = require('../middleware/auth');

router.get('/', async (req, res) => {
  try {
    // Usar farmaciaId del query si es ADMIN, de lo contrario del JWT
    const farmaciaId = req.userRole === 'ADMIN' && req.query.farmaciaId
      ? Number(req.query.farmaciaId)
      : req.farmaciaId;
      
    if (!farmaciaId) return res.status(400).json({ error: 'farmaciaId no identificada. Se requiere farmaciaId.' });

    const categorias = await prisma.categoria.findMany({
      where: { farmaciaId },
      orderBy: { createdAt: 'asc' },
      include: { _count: { select: { producto: true } } },
    });

    const data = categorias.map((cat) => ({
      id: cat.id,
      nombre: cat.nombre,
      farmaciaId: cat.farmaciaId,
      isMaster: cat.isMaster,
      createdAt: cat.createdAt,
      productCount: cat._count.producto,
    }));

    return res.json(data);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'No se pudieron listar las categorias' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { nombre } = req.body || {};
    if (!nombre) {
      return res.status(400).json({ error: 'nombre es obligatorio' });
    }
    const farmaciaId = req.farmaciaId;
    const categoria = await prisma.categoria.create({
      data: {
        nombre: nombre.trim(),
        farmaciaId: farmaciaId,
      },
    });
    return res.status(201).json(categoria);
  } catch (err) {
    console.error(err);
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Ya existe una categoria con ese nombre' });
    }
    return res.status(500).json({ error: 'No se pudo crear la categoria' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'ID invalido' });
    const { nombre } = req.body || {};
    if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio' });
    
    // Verificar que la categoría pertenezca a la farmacia del usuario
    const categoria = await prisma.categoria.findUnique({ where: { id } });
    if (!categoria || categoria.farmaciaId !== req.farmaciaId) {
      return res.status(403).json({ error: 'Acceso denegado. Categoría no pertenece a tu farmacia.' });
    }
    
    const updated = await prisma.categoria.update({
      where: { id },
      data: { nombre: nombre.trim() },
    });
    return res.json(updated);
  } catch (err) {
    console.error(err);
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Ya existe una categoria con ese nombre' });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Categoria no encontrada' });
    }
    return res.status(500).json({ error: 'No se pudo actualizar la categoria' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'ID invalido' });

    const categoria = await prisma.categoria.findUnique({
      where: { id },
      include: { _count: { select: { productos: true } } },
    });
    if (!categoria) return res.status(404).json({ error: 'Categoria no encontrada' });
    
    // CRÍTICO: Validar que la categoría pertenezca a la farmacia del usuario
    if (categoria.farmaciaId !== req.farmaciaId) {
      return res.status(403).json({ error: 'Acceso denegado. Categoría no pertenece a tu farmacia.' });
    }
    
    if (categoria._count.productos > 0) {
      return res.status(409).json({ error: 'No se puede eliminar: hay productos asociados' });
    }
    await prisma.categoria.delete({ where: { id } });
    return res.status(204).end();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'No se pudo eliminar la categoria' });
  }
});

// POST /importar - Copiar categorías de OTRA farmacia hacia la farmacia actual (solo ADMIN)
// Omite las que ya existan en la farmacia actual con el mismo nombre.
router.post('/importar', requireAdmin, async (req, res) => {
  const currentFarmaciaId = req.farmaciaId;
  const { farmaciaOrigenId, categoriaIds } = req.body || {};
  const origenId = parseInt(farmaciaOrigenId);

  if (!Number.isFinite(origenId)) {
    return res.status(400).json({ error: 'Debes indicar la farmacia de origen' });
  }
  if (origenId === currentFarmaciaId) {
    return res.status(400).json({ error: 'La farmacia de origen no puede ser la misma que la actual' });
  }

  try {
    const origen = await prisma.farmacia.findUnique({ where: { id: origenId } });
    if (!origen) return res.status(404).json({ error: 'Farmacia de origen no encontrada' });

    const where = { farmaciaId: origenId };
    if (Array.isArray(categoriaIds) && categoriaIds.length > 0) {
      where.id = { in: categoriaIds.map(Number) };
    }

    const categoriasOrigen = await prisma.categoria.findMany({ where });
    if (categoriasOrigen.length === 0) {
      return res.status(400).json({ error: 'No hay categorías para importar' });
    }

    const categoriasDestino = await prisma.categoria.findMany({
      where: { farmaciaId: currentFarmaciaId },
      select: { nombre: true },
    });
    const nombresExistentes = new Set(categoriasDestino.map((c) => c.nombre.trim().toLowerCase()));

    let importadas = 0;
    let omitidas = 0;

    await prisma.$transaction(async (tx) => {
      for (const cat of categoriasOrigen) {
        const key = cat.nombre.trim().toLowerCase();
        if (nombresExistentes.has(key)) {
          omitidas++;
          continue;
        }
        await tx.categoria.create({
          data: { nombre: cat.nombre, farmaciaId: currentFarmaciaId, isMaster: false },
        });
        nombresExistentes.add(key);
        importadas++;
      }
    });

    res.json({ importadas, omitidas, total: categoriasOrigen.length });
  } catch (err) {
    console.error('Error importing categorias:', err);
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Alguna categoría ya existe en la farmacia actual' });
    }
    res.status(500).json({ error: 'No se pudieron importar las categorías' });
  }
});

module.exports = router;

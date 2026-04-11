const router = require('express').Router();
const prisma = require('../lib/prisma');

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

module.exports = router;

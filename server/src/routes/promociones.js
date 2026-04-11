const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');

// GET / - Listar todas las promociones con sus productos
router.get('/', async (req, res) => {
  try {
    const promociones = await prisma.promocion.findMany({
      where: { farmaciaId: req.farmaciaId },
      include: {
        items: {
          include: {
            producto: {
              select: {
                id: true,
                nombre: true,
                precioVenta: true,
                stockActual: true,
                codigoBarras: true,
                presentacion: true,
                fechaVencimiento: true,
                lote: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const serialized = promociones.map(p => ({
      ...p,
      precioPromo: parseFloat(p.precioPromo),
      items: p.items.map(item => ({
        ...item,
        producto: {
          ...item.producto,
          precioVenta: parseFloat(item.producto.precioVenta),
        },
      })),
    }));

    res.json(serialized);
  } catch (error) {
    console.error('Error fetching promociones:', error);
    res.status(500).json({ error: 'Error fetching promociones', details: error.message });
  }
});

// POST / - Crear nueva promoción
router.post('/', async (req, res) => {
  const { nombre, descripcion, precioPromo, activo, items } = req.body;

  if (!nombre?.trim()) return res.status(400).json({ error: 'El nombre es requerido.' });
  if (!precioPromo || parseFloat(precioPromo) <= 0) return res.status(400).json({ error: 'El precio promocional debe ser mayor a 0.' });
  if (!items || items.length === 0) return res.status(400).json({ error: 'Debes agregar al menos un producto.' });

  try {
    const promo = await prisma.promocion.create({
      data: {
        farmaciaId: req.farmaciaId,
        nombre: nombre.trim(),
        descripcion: descripcion?.trim() || null,
        precioPromo: parseFloat(precioPromo),
        activo: activo !== false,
        items: {
          create: items.map(item => ({
            productoId: parseInt(item.productoId),
            cantidad: parseInt(item.cantidad) || 1,
          })),
        },
      },
      include: {
        items: { include: { producto: true } },
      },
    });

    res.status(201).json({
      ...promo,
      precioPromo: parseFloat(promo.precioPromo),
    });
  } catch (error) {
    console.error('Error creating promocion:', error);
    res.status(500).json({ error: 'Error creando la promoción', details: error.message });
  }
});

// PUT /:id - Actualizar promoción
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { nombre, descripcion, precioPromo, activo, items } = req.body;

  try {
    // Verify ownership
    const existing = await prisma.promocion.findUnique({ where: { id: parseInt(id) } });
    if (!existing || existing.farmaciaId !== req.farmaciaId) {
      return res.status(404).json({ error: 'Promoción no encontrada.' });
    }

    // Delete old items and recreate
    await prisma.promocionitem.deleteMany({ where: { promocionId: parseInt(id) } });

    const updated = await prisma.promocion.update({
      where: { id: parseInt(id) },
      data: {
        nombre: nombre?.trim() || existing.nombre,
        descripcion: descripcion?.trim() || null,
        precioPromo: parseFloat(precioPromo) || existing.precioPromo,
        activo: activo !== undefined ? activo : existing.activo,
        items: {
          create: (items || []).map(item => ({
            productoId: parseInt(item.productoId),
            cantidad: parseInt(item.cantidad) || 1,
          })),
        },
      },
      include: {
        items: { include: { producto: true } },
      },
    });

    res.json({ ...updated, precioPromo: parseFloat(updated.precioPromo) });
  } catch (error) {
    console.error('Error updating promocion:', error);
    res.status(500).json({ error: 'Error actualizando la promoción', details: error.message });
  }
});

// DELETE /:id - Eliminar promoción
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const existing = await prisma.promocion.findUnique({ where: { id: parseInt(id) } });
    if (!existing || existing.farmaciaId !== req.farmaciaId) {
      return res.status(404).json({ error: 'Promoción no encontrada.' });
    }
    await prisma.promocion.delete({ where: { id: parseInt(id) } });
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting promocion:', error);
    res.status(500).json({ error: 'Error eliminando la promoción', details: error.message });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { DEFAULT_LOYALTY, getLoyaltyConfig } = require('../lib/loyalty');

const toBoolean = (value, fallback = true) => {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  return fallback;
};

const buildRulePayload = (body, farmaciaId, { includeFarmaciaId } = { includeFarmaciaId: true }) => {
  const triggerProductoId = Number(body.triggerProductoId ?? body.triggerId);
  const sugeridoProductoId = Number(body.sugeridoProductoId ?? body.sugerenciaId);
  const prioridad = Number(body.prioridad ?? 5);

  if (!Number.isFinite(triggerProductoId) || !Number.isFinite(sugeridoProductoId)) {
    throw new Error('IDs de producto inválidos.');
  }
  if (triggerProductoId === sugeridoProductoId) {
    throw new Error('El producto sugerido no puede ser el mismo que el disparador.');
  }

  const payload = {
    triggerProductoId,
    sugeridoProductoId,
    prioridad: Number.isFinite(prioridad) ? prioridad : 5,
    mensaje: body.mensaje?.trim() || 'Recuerda ofrecer este complemento al cliente.',
    activo: toBoolean(body.activo, true),
  };

  if (includeFarmaciaId) {
    payload.farmaciaId = farmaciaId;
  }

  return payload;
};

// Nota: farmaciaId se obtiene del JWT mediante el middleware authenticate en index.js
// NO usar req.headers['x-farmacia-id'] ya que pueden ser suplantados

router.get('/', async (req, res) => {
  try {
    const rules = await prisma.reglaVentaCruzada.findMany({
      where: {
        OR: [
          { farmaciaId: 0 },
          { farmaciaId: req.farmaciaId },
        ],
      },
      include: {
        triggerProducto: true,
        sugeridoProducto: true,
      },
      orderBy: { prioridad: 'desc' },
    });
    res.json(rules);
  } catch (error) {
    console.error('Error fetching sales rules:', error);
    res.status(500).json({ error: 'Error fetching sales rules', details: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const payload = buildRulePayload(req.body, req.farmaciaId);
    const newRule = await prisma.reglaVentaCruzada.create({
      data: payload,
      include: {
        triggerProducto: true,
        sugeridoProducto: true,
      },
    });
    res.status(201).json(newRule);
  } catch (error) {
    console.error('Error creating sales rule:', error);
    res.status(500).json({ error: error.message || 'Error creando la regla' });
  }
});

router.put('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const payload = buildRulePayload(req.body, req.farmaciaId, { includeFarmaciaId: false });
    const updatedRule = await prisma.reglaVentaCruzada.update({
      where: { id: parseInt(id) },
      data: payload,
      include: {
        triggerProducto: true,
        sugeridoProducto: true,
      },
    });
    res.json(updatedRule);
  } catch (error) {
    console.error('Error updating sales rule:', error);
    res.status(500).json({ error: error.message || 'Error actualizando la regla' });
  }
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.reglaVentaCruzada.delete({
      where: { id: parseInt(id) },
    });
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting sales rule:', error);
    res.status(500).json({ error: 'Error deleting sales rule', details: error.message });
  }
});

router.get('/productos', async (req, res) => {
  try {
    const productos = await prisma.producto.findMany({
      where: { farmaciaId: req.farmaciaId },
      select: {
        id: true,
        nombre: true,
        presentacion: true,
        codigoBarras: true,
        precioVenta: true,
        stockActual: true,
        principioActivo: true,
      },
      orderBy: { nombre: 'asc' },
      take: 500,
    });

    const serialized = productos.map((p) => ({
      ...p,
      precioVenta: parseFloat(p.precioVenta),
    }));

    res.json(serialized);
  } catch (error) {
    console.error('Error fetching productos para reglas:', error);
    res.status(500).json({ error: 'Error fetching products', details: error.message });
  }
});

router.get('/lealtad', async (req, res) => {
  try {
    const config = await getLoyaltyConfig(req.farmaciaId);
    res.json(config);
  } catch (error) {
    console.error('Error fetching loyalty settings:', error);
    res.status(500).json({ error: 'Error fetching loyalty settings', details: error.message });
  }
});

router.post('/lealtad', async (req, res) => {
  const { solesPorPunto, valorPorPunto, maxPuntosCanje, activo } = req.body;
  try {
    const data = {
      farmaciaId: req.farmaciaId,
      solesPorPunto: parseFloat(solesPorPunto ?? DEFAULT_LOYALTY.solesPorPunto),
      valorPorPunto: parseFloat(valorPorPunto ?? DEFAULT_LOYALTY.valorPorPunto),
      maxPuntosCanje: parseInt(maxPuntosCanje ?? DEFAULT_LOYALTY.maxPuntosCanje),
      activo: toBoolean(activo, true),
    };

    if (!Number.isFinite(data.solesPorPunto) || data.solesPorPunto <= 0) {
      return res.status(400).json({ error: 'solesPorPunto debe ser mayor a 0.' });
    }
    if (!Number.isFinite(data.valorPorPunto) || data.valorPorPunto <= 0) {
      return res.status(400).json({ error: 'valorPorPunto debe ser mayor a 0.' });
    }

    if (!prisma.configuracionLealtad) {
      return res.status(500).json({ error: 'El cliente de Prisma no está actualizado. Ejecuta "npx prisma generate".' });
    }

    const result = await prisma.configuracionLealtad.upsert({
      where: { farmaciaId: req.farmaciaId },
      update: data,
      create: data,
    });

    res.json({
      ...result,
      solesPorPunto: parseFloat(result.solesPorPunto),
      valorPorPunto: parseFloat(result.valorPorPunto),
      maxPuntosCanje: parseInt(result.maxPuntosCanje),
    });
  } catch (error) {
    console.error('Error updating loyalty settings:', error);
    res.status(500).json({ error: 'Error updating loyalty settings', details: error.message });
  }
});

module.exports = router;

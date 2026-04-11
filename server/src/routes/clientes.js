const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { logAudit } = require('../lib/audit');
const { requireAdmin } = require('../middleware/auth');

// GET all clients for the authenticated user's pharmacy
router.get('/', async (req, res) => {
  try {
    const farmaciaId = req.farmaciaId;

    const clients = await prisma.cliente.findMany({
      where: { farmaciaId },
    });
    res.json(clients);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching clients', details: error.message });
  }
});

router.get('/search', async (req, res) => {
  const farmaciaId = req.farmaciaId;

  if (!farmaciaId) {
    return res.status(400).json({ error: 'Farmacia no identificada' });
  }

  const numeroDoc = String(req.query.numeroDoc ?? '').trim();
  if (!numeroDoc) {
    return res.status(400).json({ error: 'numeroDoc es requerido para la búsqueda' });
  }

  const typeDoc = req.query.typeDoc;

  try {
    const where = {
      farmaciaId,
      numeroDoc: {
        startsWith: numeroDoc,
      },
    };

    if (typeDoc) {
      where.tipoDoc = typeDoc;
    }

    const clients = await prisma.cliente.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 6,
    });

    res.json(clients);
  } catch (error) {
    console.error('Error searching clients:', error);
    res.status(500).json({ error: 'Error searching clients', details: error.message });
  }
});

// GET a single client by ID for the authenticated user's pharmacy
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const farmaciaId = req.farmaciaId;

  try {
    const client = await prisma.cliente.findUnique({
      where: {
        id: parseInt(id),
        farmaciaId: farmaciaId,
      },
    });
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }
    res.json(client);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching client', details: error.message });
  }
});

// POST create a new client for the authenticated user's pharmacy
router.post('/', async (req, res) => {
  const { tipoDoc, numeroDoc, nombreRazon, direccion, telefono, email, puntosAcumulados, distrito, provincia, departamento } = req.body;

  const farmaciaId = req.farmaciaId;

  try {
    const newClient = await prisma.cliente.create({
      data: {
        farmaciaId: farmaciaId,
        tipoDoc,
        numeroDoc,
        nombreRazon,
        direccion,
        telefono,
        email,
        distrito,
        provincia,
        departamento,
        puntosAcumulados: puntosAcumulados || 0,
      },
    });

    logAudit({
      farmaciaId: farmaciaId,
      usuarioId: req.userId,
      accion: 'CREAR',
      modulo: 'CLIENTES',
      descripcion: `Cliente creado: ${nombreRazon} (${tipoDoc}: ${numeroDoc})`,
      detalles: { clienteId: newClient.id }
    });

    res.status(201).json(newClient);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Client with this document number already exists for this pharmacy.' });
    }
    res.status(500).json({ error: 'Error creating client', details: error.message });
  }
});

// PUT update a client for the authenticated user's pharmacy
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const farmaciaId = req.farmaciaId;
  const clientId = parseInt(id, 10);
  const { tipoDoc, numeroDoc, nombreRazon, direccion, telefono, email, puntosAcumulados, distrito, provincia, departamento } = req.body;

  try {
    const existingClient = await prisma.cliente.findUnique({
      where: { id: clientId },
    });

    if (!existingClient || existingClient.farmaciaId !== farmaciaId) {
      return res.status(404).json({ error: 'Client not found or does not belong to this pharmacy.' });
    }

    const updatedClient = await prisma.cliente.update({
      where: { id: clientId },
      data: {
        tipoDoc,
        numeroDoc,
        nombreRazon,
        direccion,
        telefono,
        email,
        distrito,
        provincia,
        departamento,
        puntosAcumulados: puntosAcumulados !== undefined ? parseInt(puntosAcumulados, 10) : undefined,
      },
    });

    logAudit({
      farmaciaId,
      usuarioId: req.userId,
      accion: 'EDITAR',
      modulo: 'CLIENTES',
      descripcion: `Cliente editado: ${nombreRazon} (ID: ${clientId})`,
      detalles: { clienteId: clientId }
    });

    res.json(updatedClient);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Client with this document number already exists for this pharmacy.' });
    }
    res.status(500).json({ error: 'Error updating client', details: error.message });
  }
});

// DELETE a client (solo ADMIN)
router.delete('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const farmaciaId = req.farmaciaId;
  const clientId = parseInt(id, 10);

  try {
    const existingClient = await prisma.cliente.findUnique({
      where: { id: clientId },
    });

    if (!existingClient || existingClient.farmaciaId !== farmaciaId) {
      return res.status(404).json({ error: 'Client not found or does not belong to this pharmacy.' });
    }

    await prisma.cliente.delete({
      where: { id: clientId },
    });

    logAudit({
      farmaciaId,
      usuarioId: req.userId,
      accion: 'ELIMINAR',
      modulo: 'CLIENTES',
      descripcion: `Cliente eliminado: ${existingClient.nombreRazon} (ID: ${clientId})`,
      detalles: { clienteId: clientId }
    });

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Error deleting client', details: error.message });
  }
});

// GET /api/clientes/:id/history - Obtiene el historial de compras de un cliente
router.get('/:id/history', async (req, res) => {
  const { id } = req.params;
  const farmaciaId = req.farmaciaId;
  const userRole = req.userRole;

  try {
    // Construir where clause según el rol
    const whereClause = {
      clienteId: parseInt(id, 10),
      farmaciaId: farmaciaId,
    };

    // Si es vendedor, aplicar filtro de 20 horas
    if (userRole === 'VENDEDOR') {
      whereClause.fecha_emision = {
        gte: new Date(Date.now() - 20 * 60 * 60 * 1000),
      };
    }

    const history = await prisma.comprobante.findMany({
      where: whereClause,
      include: {
        comprobanteitem: {
          include: {
            producto: true,
            servicio: true,
          },
        },
      },
      orderBy: { fecha_emision: 'desc' },
    });
    res.json(history);
  } catch (error) {
    console.error('Error fetching client history:', error);
    res.status(500).json({ error: 'Error fetching client history', details: error.message });
  }
});

// GET /api/clientes/:id/habituales - Obtiene los ítems marcados como habituales
// IMPORTANTE: Verificar que el cliente pertenezca a la farmacia del usuario
router.get('/:id/habituales', async (req, res) => {
  const { id } = req.params;
  const farmaciaId = req.farmaciaId;

  try {
    // Primero verificar que el cliente pertenezca a la farmacia del usuario
    const cliente = await prisma.cliente.findUnique({
      where: { id: parseInt(id, 10) },
    });

    if (!cliente || cliente.farmaciaId !== farmaciaId) {
      return res.status(404).json({ error: 'Cliente no encontrado o no pertenece a esta farmacia' });
    }

    const habituales = await prisma.recetahabitual.findMany({
      where: { 
        clienteId: parseInt(id, 10),
        farmaciaId: farmaciaId,  // CRÍTICO: Filtro por farmacia
      },
      include: {
        producto: true,
        servicio: true,
      },
    });
    res.json(habituales);
  } catch (error) {
    console.error('Error fetching habitual items:', error);
    res.status(500).json({ error: 'Error fetching habitual items', details: error.message });
  }
});

// POST /api/clientes/habitual - Toggle o añade un ítem como habitual
router.post('/habitual', async (req, res) => {
  const { clienteId, productoId, servicioId, cantidad, notas } = req.body;
  const farmaciaId = req.farmaciaId;

  try {
    // Verificar que el cliente pertenezca a la farmacia del usuario
    const cliente = await prisma.cliente.findUnique({
      where: { id: parseInt(clienteId, 10) },
    });

    if (!cliente || cliente.farmaciaId !== farmaciaId) {
      return res.status(403).json({ error: 'Cliente no válido para esta farmacia' });
    }

    const where = {
      farmaciaId: farmaciaId,  // CRÍTICO: Filtro por farmacia
      clienteId: parseInt(clienteId, 10),
      productoId: productoId ? parseInt(productoId, 10) : null,
      servicioId: servicioId ? parseInt(servicioId, 10) : null,
    };

    const existing = await prisma.recetahabitual.findFirst({
      where: where,
    });

    if (existing) {
      await prisma.recetahabitual.delete({
        where: { id: existing.id },
      });
      return res.json({ message: 'Item removido de habituales', action: 'removed' });
    } else {
      const newItem = await prisma.recetahabitual.create({
        data: {
          farmaciaId: farmaciaId,  // CRÍTICO: Incluir farmaciaId
          clienteId: parseInt(clienteId, 10),
          productoId: productoId ? parseInt(productoId, 10) : null,
          servicioId: servicioId ? parseInt(servicioId, 10) : null,
          cantidad: cantidad || 1,
          notas: notas || '',
        },
      });
      return res.status(201).json({ message: 'Item añadido a habituales', action: 'added', item: newItem });
    }
  } catch (error) {
    console.error('Error toggling habitual item:', error);
    res.status(500).json({ error: 'Error toggling habitual item', details: error.message });
  }
});

// DELETE /api/clientes/habitual/:id - Eliminar un habitual
router.delete('/habitual/:id', async (req, res) => {
  const { id } = req.params;
  const farmaciaId = req.farmaciaId;

  try {
    // Verificar que el habitual pertenezca a un cliente de la farmacia
    const habitual = await prisma.recetahabitual.findUnique({
      where: { id: parseInt(id, 10) },
      include: { cliente: true },
    });

    if (!habitual || habitual.cliente.farmaciaId !== farmaciaId) {
      return res.status(403).json({ error: 'Item no válido para esta farmacia' });
    }

    await prisma.recetahabitual.delete({
      where: { id: parseInt(id, 10) },
    });
    res.json({ message: 'Item habitual eliminado' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting habitual item', details: error.message });
  }
});

module.exports = router;

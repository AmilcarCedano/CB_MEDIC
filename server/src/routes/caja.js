const express = require('express');
const router = require('express').Router();
const prisma = require('../lib/prisma');
const bcrypt = require('bcryptjs');
const { logAudit } = require('../lib/audit');
const { requireAdmin } = require('../middleware/auth');

// SECURITY: farmaciaId, userId y userRole ya vienen del middleware authenticate (JWT verificado)
// NO usar req.headers['x-farmacia-id'] ya que pueden ser suplantados
// El middleware authenticate es responsable de validar y establecer estos valores

// GET /caja/turno-activo - Obtener turno activo de la farmacia
router.get('/turno-activo', async (req, res) => {
  try {
    const turno = await prisma.turnocaja.findFirst({
      where: {
        farmaciaId: req.farmaciaId,
        usuarioId: req.userId,
        estado: 'ABIERTO'
      },
      include: {
        usuario: {
          select: {
            id: true,
            username: true,
            fullName: true
          }
        },
        egresos: {
          orderBy: { fecha: 'desc' }
        }
      }
    });

    res.json(turno);
  } catch (error) {
    console.error('Error fetching turno activo:', error);
    res.status(500).json({ error: 'Error al obtener turno activo', details: error.message });
  }
});

// POST /caja/abrir-turno - Abrir nuevo turno
router.post('/abrir-turno', async (req, res) => {
  try {
    const { montoInicial } = req.body;

    if (montoInicial === undefined || parseFloat(montoInicial) < 0) {
      return res.status(400).json({ error: 'El monto inicial no puede ser negativo' });
    }

    // Verificar que el usuario no tenga otro turno abierto
    const turnoExistente = await prisma.turnocaja.findFirst({
      where: {
        farmaciaId: req.farmaciaId,
        usuarioId: req.userId,
        estado: 'ABIERTO'
      }
    });

    if (turnoExistente) {
      return res.status(400).json({ error: 'Usted ya tiene un turno abierto. Debe cerrarlo primero.' });
    }

    // Crear nuevo turno
    const turno = await prisma.turnocaja.create({
      data: {
        farmaciaId: req.farmaciaId,
        usuarioId: req.userId,
        montoInicial: parseFloat(montoInicial),
        estado: 'ABIERTO'
      },
      include: {
        usuario: {
          select: {
            id: true,
            username: true,
            fullName: true
          }
        }
      }
    });

    logAudit({ farmaciaId: req.farmaciaId, usuarioId: req.userId, accion: 'CREAR', modulo: 'CAJA', descripcion: `Turno de caja abierto con monto inicial S/ ${montoInicial}`, detalles: { turnoId: turno.id } });
    res.json(turno);
  } catch (error) {
    console.error('Error opening turno:', error);
    res.status(500).json({ error: 'Error al abrir turno', details: error.message });
  }
});

// POST /caja/cerrar-turno/:id - Cerrar un turno
router.post('/cerrar-turno/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { observaciones, password } = req.body;
    const { farmaciaId, userId } = req;

    if (isNaN(userId) || isNaN(farmaciaId)) {
      return res.status(401).json({ error: 'No se identificó al usuario o farmacia correctamente' });
    }

    // Validar contraseña del usuario
    if (!password) {
      return res.status(400).json({ error: 'Se requiere contraseña para cerrar el turno' });
    }

    const usuario = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!usuario) {
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }

    let passwordMatch = false;
    try {
      if (usuario.passwordHash) {
        passwordMatch = await bcrypt.compare(password, usuario.passwordHash);
      }
    } catch (bcryptError) {
      console.error('Error bcrypt match:', bcryptError);
    }

    // Fallback texto plano (solo para casos legados si existen)
    if (!passwordMatch && usuario.passwordHash === password) {
      passwordMatch = true;
    }

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Contraseña incorrecta' });
    }

    const turno = await prisma.turnocaja.findFirst({
      where: {
        id: parseInt(id),
        farmaciaId: farmaciaId
      }
    });

    if (!turno) {
      return res.status(404).json({ error: 'Turno no encontrado' });
    }

    if (turno.estado === 'CERRADO') {
      return res.status(400).json({ error: 'El turno ya está cerrado' });
    }

    // Usar los valores ya calculados en el turno (se actualizan en tiempo real)
    const montoVentas = Number(turno.montoVentas) || 0;
    const montoEgresos = Number(turno.montoEgresos) || 0;
    const montoFinal = Number(turno.montoInicial) + montoVentas - montoEgresos;

    const turnoCerrado = await prisma.turnocaja.update({
      where: { id: turno.id },
      data: {
        estado: 'CERRADO',
        fechaCierre: new Date(),
        montoFinal,
        observaciones: observaciones || null
      }
    });

    logAudit({ 
      farmaciaId, 
      usuarioId: userId, 
      accion: 'CERRAR', 
      modulo: 'CAJA', 
      descripcion: `Turno de caja cerrado por ${usuario.fullName}. Ventas: S/ ${montoVentas.toFixed(2)}, Egresos: S/ ${montoEgresos.toFixed(2)}, Final: S/ ${montoFinal.toFixed(2)}`, 
      detalles: { turnoId: turno.id } 
    });
    
    res.json(turnoCerrado);

  } catch (error) {
    console.error('Error al cerrar turno:', error);
    res.status(500).json({ error: 'Error al cerrar turno', details: error.message });
  }
});



// POST /caja/registrar-egreso - Registrar salida de dinero
router.post('/registrar-egreso', async (req, res) => {
  try {
    const { monto, motivo } = req.body;

    if (!monto || parseFloat(monto) <= 0) {
      return res.status(400).json({ error: 'El monto debe ser mayor a 0' });
    }

    if (!motivo || motivo.trim().length === 0) {
      return res.status(400).json({ error: 'El motivo es obligatorio' });
    }

    // Obtener turno activo
    const turnoActivo = await prisma.turnocaja.findFirst({
      where: {
        farmaciaId: req.farmaciaId,
        usuarioId: req.userId,
        estado: 'ABIERTO'
      }
    });

    if (!turnoActivo) {
      return res.status(400).json({ error: 'No hay un turno abierto' });
    }

    // Crear egreso y actualizar turno en transacción
    const result = await prisma.$transaction(async (tx) => {
      const egreso = await tx.egresocaja.create({
        data: {
          turnoId: turnoActivo.id,
          monto: parseFloat(monto),
          motivo: motivo.trim()
        }
      });

      const nuevoMontoEgresos = parseFloat(turnoActivo.montoEgresos) + parseFloat(monto);

      await tx.turnocaja.update({
        where: { id: turnoActivo.id },
        data: {
          montoEgresos: nuevoMontoEgresos
        }
      });

      return egreso;
    });

    logAudit({ farmaciaId: req.farmaciaId, usuarioId: req.userId, accion: 'CREAR', modulo: 'CAJA', descripcion: `Egreso de caja: S/ ${monto} - ${motivo}`, detalles: { egresoId: result.id } });
    res.json(result);
  } catch (error) {
    console.error('Error registering egreso:', error);
    res.status(500).json({ error: 'Error al registrar egreso', details: error.message });
  }
});

// PUT /caja/egreso/:id - Editar un egreso
router.put('/egreso/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { monto, motivo } = req.body;
    const farmaciaId = req.farmaciaId; // SECURITY: Del JWT verificado, no de headers

    // Buscar el egreso y verificar que pertenece a un turno de esta farmacia
    const egreso = await prisma.egresocaja.findFirst({
      where: { id: parseInt(id) },
      include: { turno: true }
    });

    if (!egreso || egreso.turno.farmaciaId !== farmaciaId) {
      return res.status(404).json({ error: 'Egreso no encontrado' });
    }

    if (egreso.turno.estado === 'CERRADO') {
      return res.status(400).json({ error: 'No se puede editar un egreso de un turno cerrado' });
    }

    const montoAnterior = parseFloat(egreso.monto);
    const montoNuevo = parseFloat(monto);
    const diferencia = montoNuevo - montoAnterior;

    const result = await prisma.$transaction(async (tx) => {
      const egresoActualizado = await tx.egresocaja.update({
        where: { id: parseInt(id) },
        data: {
          monto: montoNuevo,
          motivo: motivo.trim()
        }
      });

      await tx.turnocaja.update({
        where: { id: egreso.turnoId },
        data: {
          montoEgresos: parseFloat(egreso.turno.montoEgresos) + diferencia
        }
      });

      return egresoActualizado;
    });

    res.json(result);
  } catch (error) {
    console.error('Error updating egreso:', error);
    res.status(500).json({ error: 'Error al actualizar egreso', details: error.message });
  }
});

// DELETE /caja/egreso/:id - Eliminar un egreso
router.delete('/egreso/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const farmaciaId = req.farmaciaId; // SECURITY: Del JWT verificado, no de headers

    // Buscar el egreso y verificar que pertenece a un turno de esta farmacia
    const egreso = await prisma.egresocaja.findFirst({
      where: { id: parseInt(id) },
      include: { turno: true }
    });

    if (!egreso || egreso.turno.farmaciaId !== farmaciaId) {
      return res.status(404).json({ error: 'Egreso no encontrado' });
    }

    if (egreso.turno.estado === 'CERRADO') {
      return res.status(400).json({ error: 'No se puede eliminar un egreso de un turno cerrado' });
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.egresocaja.delete({
        where: { id: parseInt(id) }
      });

      await tx.turnocaja.update({
        where: { id: egreso.turnoId },
        data: {
          montoEgresos: parseFloat(egreso.turno.montoEgresos) - parseFloat(egreso.monto)
        }
      });
    });

    res.json({ message: 'Egreso eliminado correctamente' });
  } catch (error) {
    console.error('Error deleting egreso:', error);
    res.status(500).json({ error: 'Error al eliminar egreso', details: error.message });
  }
});

// GET /caja/historial - Historial de turnos cerrados
router.get('/historial', async (req, res) => {
  try {
    const turnos = await prisma.turnocaja.findMany({
      where: {
        farmaciaId: req.farmaciaId,
        estado: 'CERRADO',
        usuarioId: req.userRole === 'VENDEDOR' ? req.userId : undefined,
        fechaCierre: req.userRole === 'VENDEDOR' ? {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
        } : undefined
      },
      include: {
        usuario: {
          select: {
            id: true,
            username: true,
            fullName: true
          }
        },
        egresos: true
      },
      orderBy: {
        fechaCierre: 'desc'
      }
    });

    res.json(turnos);
  } catch (error) {
    console.error('Error fetching historial:', error);
    res.status(500).json({ error: 'Error al obtener historial', details: error.message });
  }
});

// GET /caja/egresos - Lista de todos los egresos
router.get('/egresos', async (req, res) => {
  try {
    const egresos = await prisma.egresocaja.findMany({
      where: {
        turno: {
          farmaciaId: req.farmaciaId,
          usuarioId: req.userRole === 'VENDEDOR' ? req.userId : undefined
        },
        fecha: req.userRole === 'VENDEDOR' ? {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
        } : undefined
      },
      include: {
        turno: {
          include: {
            usuario: {
              select: {
                id: true,
                username: true,
                fullName: true
              }
            }
          }
        }
      },
      orderBy: {
        fecha: 'desc'
      }
    });

    res.json(egresos);
  } catch (error) {
    console.error('Error fetching egresos:', error);
    res.status(500).json({ error: 'Error al obtener egresos', details: error.message });
  }
});

// GET /caja/monitor - Estado actual para vista admin
router.get('/monitor', async (req, res) => {
  try {
    if (req.userRole !== 'ADMIN') {
      return res.status(403).json({ error: 'Acceso denegado. Solo administradores pueden monitorear todas las cajas.' });
    }
    const turnosActivos = await prisma.turnocaja.findMany({
      where: {
        farmaciaId: req.farmaciaId,
        estado: 'ABIERTO'
      },
      include: {
        usuario: {
          select: { id: true, username: true, fullName: true }
        },
        egresos: {
          orderBy: { fecha: 'desc' }
        }
      }
    });

    const turnosWithBreakdown = await Promise.all(turnosActivos.map(async (t) => {
      const breakdown = await prisma.comprobante.groupBy({
        by: ['forma_pago'],
        where: {
          farmaciaId: req.farmaciaId,
          fecha_emision: { gte: t.fechaApertura },
          estado_sunat: { not: 'ANULADO' },
          usuarioId: t.usuarioId // Solo las ventas de este cajero en su turno
        },
        _sum: { total: true },
        _count: true,
      });

      return {
        ...t,
        desglosePagos: breakdown.map(b => ({
          metodo: b.forma_pago || 'Efectivo',
          total: Number(b._sum.total || 0),
          cantidad: b._count
        }))
      };
    }));

    res.json({
      turnosActivos: turnosWithBreakdown,
      hayTurnosAbiertos: turnosWithBreakdown.length > 0
    });
  } catch (error) {
    console.error('Error fetching monitor:', error);
    res.status(500).json({ error: 'Error al obtener estado', details: error.message });
  }
});

// PUT /caja/actualizar-ventas/:id - Actualizar monto de ventas (llamado desde POS)
router.put('/actualizar-ventas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { montoVenta } = req.body;

    const turno = await prisma.turnocaja.findUnique({
      where: { id: parseInt(id) }
    });

    if (!turno) {
      return res.status(404).json({ error: 'Turno no encontrado' });
    }

    if (turno.estado === 'CERRADO') {
      return res.status(400).json({ error: 'El turno está cerrado' });
    }

    const nuevoMontoVentas = parseFloat(turno.montoVentas) + parseFloat(montoVenta);

    const turnoActualizado = await prisma.turnocaja.update({
      where: { id: parseInt(id) },
      data: {
        montoVentas: nuevoMontoVentas
      }
    });

    res.json(turnoActualizado);
  } catch (error) {
    console.error('Error updating ventas:', error);
    res.status(500).json({ error: 'Error al actualizar ventas', details: error.message });
  }
});

// DELETE /caja/turno/:id - Eliminar un turno cerrado (Solo ADMIN)
router.delete('/turno/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body; // SECURITY: Contraseña en body, no en headers
    const farmaciaId = req.farmaciaId; // SECURITY: Del JWT verificado

    // Validar contraseña (debe ser la Master Password o la contraseña del ADMIN logueado)
    const ADMIN_PASSWORD = process.env.ADMIN_MASTER_PASSWORD;
    let isValid = false;

    if (password === ADMIN_PASSWORD) {
      isValid = true;
    } else {
      const usuario = await prisma.user.findUnique({
        where: { id: req.userId }
      });
      if (usuario && usuario.role === 'ADMIN') {
        isValid = await bcrypt.compare(password, usuario.passwordHash);
      }
    }

    if (!isValid) {
      return res.status(401).json({ error: 'Contraseña de administrador incorrecta' });
    }

    // Verificar que el turno existe y pertenece a la farmacia
    const turno = await prisma.turnocaja.findFirst({
      where: {
        id: parseInt(id),
        farmaciaId: farmaciaId
      }
    });

    if (!turno) {
      return res.status(404).json({ error: 'Turno no encontrado' });
    }

    // Solo permitir eliminar turnos cerrados
    if (turno.estado !== 'CERRADO') {
      return res.status(400).json({ error: 'Solo se pueden eliminar turnos cerrados' });
    }

    // Eliminar el turno (los egresos se eliminan en cascada)
    await prisma.turnocaja.delete({
      where: { id: parseInt(id) }
    });

    res.json({ message: 'Turno eliminado correctamente' });
  } catch (error) {
    console.error('Error deleting turno:', error);
    res.status(500).json({ error: 'Error al eliminar el turno' });
  }
});

module.exports = router;

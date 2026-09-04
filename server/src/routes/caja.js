const express = require('express');
const router = require('express').Router();
const prisma = require('../lib/prisma');
const bcrypt = require('bcryptjs');
const { logAudit } = require('../lib/audit');
const { requireAdmin } = require('../middleware/auth');
const { round2 } = require('../lib/money');

// Calcula ventas + resumen (medicamentos/servicios/promociones) de un turno, sin
// modificar nada. Se usa tanto para la vista previa (GET, antes de decidir cerrar)
// como para el cierre real (POST), así ambas siempre muestran el mismo número.
const calcularResumenTurno = async (turno) => {
  const comprobantesParaCierre = await prisma.comprobante.findMany({
    where: {
      farmaciaId: turno.farmaciaId,
      usuarioId: turno.usuarioId,
      fecha_emision: { gte: turno.fechaApertura },
      estado_sunat: { not: 'ANULADO' },
    },
    include: { devolucion: { select: { totalDevuelto: true } } },
  });
  const montoVentas = comprobantesParaCierre.reduce((sum, c) => {
    const devuelto = round2(c.devolucion.reduce((d, dev) => d + Number(dev.totalDevuelto || 0), 0));
    return round2(sum + Number(c.total) - devuelto);
  }, 0);
  const montoEgresos = round2(Number(turno.montoEgresos) || 0);
  const montoFinal = round2(Number(turno.montoInicial) + montoVentas - montoEgresos);

  // Resumen de lo vendido en el turno: cuántos medicamentos, servicios y
  // promociones, y el detalle de cada uno (qué se vendió, a qué precio).
  // Se cuenta por unidades (cantidad), no por líneas de comprobante, y sobre
  // las mismas comprobantes usadas para calcular montoVentas (no se netea
  // contra devoluciones — es un conteo de lo emitido en el turno).
  const itemsTurno = comprobantesParaCierre.length
    ? await prisma.comprobanteitem.findMany({
        where: { comprobanteId: { in: comprobantesParaCierre.map((c) => c.id) } },
        select: {
          cantidad: true,
          productoId: true,
          servicioId: true,
          codigo_producto: true,
          descripcion: true,
          precio_unitario: true,
          total: true,
          promoNombre: true,
          servicio: { select: { nombre: true } },
        },
      })
    : [];

  let medicamentosVendidos = 0;
  let serviciosRealizados = 0;
  let promocionesVendidas = 0;
  const medicamentosMap = new Map();
  const serviciosMap = new Map();
  const promocionesMap = new Map();

  for (const it of itemsTurno) {
    if (it.codigo_producto === 'DESC-PROMO') {
      promocionesVendidas += it.cantidad;
      const nombre = it.promoNombre || 'Promoción';
      promocionesMap.set(nombre, (promocionesMap.get(nombre) || 0) + it.cantidad);
    } else if (it.servicioId) {
      serviciosRealizados += it.cantidad;
      // Si el nombre facturado no coincide con el actual de la ficha, es porque
      // el cajero lo editó al vender (servicio "permite editar").
      const nombreOriginal = it.servicio && it.servicio.nombre !== it.descripcion ? it.servicio.nombre : null;
      const key = `${it.descripcion}|${nombreOriginal || ''}|${it.precio_unitario}`;
      const prev = serviciosMap.get(key);
      if (prev) {
        prev.cantidad += it.cantidad;
        prev.total += Number(it.total);
      } else {
        serviciosMap.set(key, {
          nombre: it.descripcion,
          nombreOriginal,
          // precio "grueso" (con IGV, el que ve el cajero) — precio_unitario en BD
          // guarda el neto sin IGV para el desglose SUNAT, no sirve para mostrar acá.
          precioUnitario: Number(it.total) / it.cantidad,
          cantidad: it.cantidad,
          total: Number(it.total),
        });
      }
    } else if (it.productoId) {
      medicamentosVendidos += it.cantidad;
      const key = `${it.descripcion}|${it.precio_unitario}|${it.promoNombre || ''}`;
      const prev = medicamentosMap.get(key);
      if (prev) {
        prev.cantidad += it.cantidad;
        prev.total += Number(it.total);
      } else {
        medicamentosMap.set(key, {
          nombre: it.descripcion,
          precioUnitario: Number(it.total) / it.cantidad,
          cantidad: it.cantidad,
          total: Number(it.total),
          promoNombre: it.promoNombre || null,
        });
      }
    }
  }

  return {
    montoVentas,
    montoEgresos,
    montoFinal,
    resumenVentas: { medicamentosVendidos, serviciosRealizados, promocionesVendidas },
    detalleMedicamentos: Array.from(medicamentosMap.values()).sort((a, b) => b.cantidad - a.cantidad),
    detalleServicios: Array.from(serviciosMap.values()).sort((a, b) => b.cantidad - a.cantidad),
    detallePromociones: Array.from(promocionesMap, ([nombre, cantidad]) => ({ nombre, cantidad })).sort((a, b) => b.cantidad - a.cantidad),
  };
};

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

    if (!turno) return res.json(turno);

    // Calcular montoVentas neto dinámicamente (ventas - devoluciones, excluye anuladas)
    const comprobantesDelTurno = await prisma.comprobante.findMany({
      where: {
        farmaciaId: turno.farmaciaId,
        usuarioId: turno.usuarioId,
        fecha_emision: { gte: turno.fechaApertura },
        estado_sunat: { not: 'ANULADO' },
      },
      include: { devolucion: { select: { totalDevuelto: true } } },
    });
    const montoVentasNeto = comprobantesDelTurno.reduce((sum, c) => {
      const devuelto = round2(c.devolucion.reduce((d, dev) => d + Number(dev.totalDevuelto || 0), 0));
      return round2(sum + Number(c.total) - devuelto);
    }, 0);

    res.json({ ...turno, montoVentas: montoVentasNeto });
  } catch (error) {
    console.error('Error fetching turno activo:', error);
    res.status(500).json({ error: 'Error al obtener turno activo' });
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
    res.status(500).json({ error: 'Error al abrir turno' });
  }
});

// GET /caja/turno/:id/resumen - Vista previa del resumen de cierre, SIN cerrar nada.
// Para que el cajero pueda ver cuánto lleva vendido antes de decidir si cierra la caja.
router.get('/turno/:id/resumen', async (req, res) => {
  try {
    const { id } = req.params;
    const { farmaciaId } = req;

    const turno = await prisma.turnocaja.findFirst({
      where: { id: parseInt(id), farmaciaId },
    });
    if (!turno) return res.status(404).json({ error: 'Turno no encontrado' });

    const resumen = await calcularResumenTurno(turno);
    return res.json(resumen);
  } catch (error) {
    console.error('Error al calcular resumen de turno:', error);
    res.status(500).json({ error: 'No se pudo calcular el resumen del turno' });
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

    if (!passwordMatch) {
      // 403, no 401: es una contraseña de negocio (cerrar turno), no la sesión —
      // un 401 acá dispara el interceptor global del frontend y cierra la sesión sola.
      return res.status(403).json({ error: 'Contraseña incorrecta' });
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

    const resumen = await calcularResumenTurno(turno);
    const { montoVentas, montoEgresos, montoFinal, resumenVentas } = resumen;
    const { medicamentosVendidos, serviciosRealizados, promocionesVendidas } = resumenVentas;

    const turnoCerrado = await prisma.turnocaja.update({
      where: { id: turno.id },
      data: {
        estado: 'CERRADO',
        fechaCierre: new Date(),
        montoFinal,
        montoVentas,
        observaciones: observaciones || null
      }
    });

    logAudit({
      farmaciaId,
      usuarioId: userId,
      accion: 'CERRAR',
      modulo: 'CAJA',
      descripcion: `Turno de caja cerrado por ${usuario.fullName}. Ventas: S/ ${montoVentas.toFixed(2)}, Egresos: S/ ${montoEgresos.toFixed(2)}, Final: S/ ${montoFinal.toFixed(2)}. Medicamentos: ${medicamentosVendidos}, Servicios: ${serviciosRealizados}, Promociones: ${promocionesVendidas}`,
      detalles: { turnoId: turno.id, ...resumenVentas }
    });

    res.json({ ...turnoCerrado, ...resumen });

  } catch (error) {
    console.error('Error al cerrar turno:', error);
    res.status(500).json({ error: 'Error al cerrar turno' });
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

      const nuevoMontoEgresos = round2(parseFloat(turnoActivo.montoEgresos) + parseFloat(monto));

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
    res.status(500).json({ error: 'Error al registrar egreso' });
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
          montoEgresos: round2(parseFloat(egreso.turno.montoEgresos) + diferencia)
        }
      });

      return egresoActualizado;
    });

    res.json(result);
  } catch (error) {
    console.error('Error updating egreso:', error);
    res.status(500).json({ error: 'Error al actualizar egreso' });
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
          montoEgresos: round2(parseFloat(egreso.turno.montoEgresos) - parseFloat(egreso.monto))
        }
      });
    });

    res.json({ message: 'Egreso eliminado correctamente' });
  } catch (error) {
    console.error('Error deleting egreso:', error);
    res.status(500).json({ error: 'Error al eliminar egreso' });
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
      },
      include: {
        usuario: {
          select: { id: true, username: true, fullName: true }
        },
        egresos: true
      },
      orderBy: { fechaCierre: 'desc' }
    });

    // Recalcular montoVentas dinámicamente para turnos que no lo tengan guardado
    const turnosEnriquecidos = await Promise.all(turnos.map(async (t) => {
      if (Number(t.montoVentas) > 0) return t; // ya tiene valor guardado
      const comprobantes = await prisma.comprobante.findMany({
        where: {
          farmaciaId: t.farmaciaId,
          usuarioId: t.usuarioId,
          fecha_emision: { gte: t.fechaApertura, ...(t.fechaCierre ? { lte: t.fechaCierre } : {}) },
          estado_sunat: { not: 'ANULADO' },
        },
        include: { devolucion: { select: { totalDevuelto: true } } },
      });
      const montoVentasNeto = comprobantes.reduce((sum, c) => {
        const devuelto = round2(c.devolucion.reduce((d, dev) => d + Number(dev.totalDevuelto || 0), 0));
        return round2(sum + Number(c.total) - devuelto);
      }, 0);
      return { ...t, montoVentas: montoVentasNeto };
    }));

    res.json(turnosEnriquecidos);
  } catch (error) {
    console.error('Error fetching historial:', error);
    res.status(500).json({ error: 'Error al obtener historial' });
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
    res.status(500).json({ error: 'Error al obtener egresos' });
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
      const [breakdown, comprobantesDelTurno] = await Promise.all([
        prisma.comprobante.groupBy({
          by: ['forma_pago'],
          where: {
            farmaciaId: req.farmaciaId,
            fecha_emision: { gte: t.fechaApertura },
            estado_sunat: { not: 'ANULADO' },
            usuarioId: t.usuarioId
          },
          _sum: { total: true },
          _count: true,
        }),
        prisma.comprobante.findMany({
          where: {
            farmaciaId: req.farmaciaId,
            usuarioId: t.usuarioId,
            fecha_emision: { gte: t.fechaApertura },
            estado_sunat: { not: 'ANULADO' },
          },
          include: { devolucion: { select: { totalDevuelto: true } } },
        }),
      ]);

      const montoVentasNeto = comprobantesDelTurno.reduce((sum, c) => {
        const devuelto = round2(c.devolucion.reduce((d, dev) => d + Number(dev.totalDevuelto || 0), 0));
        return round2(sum + Number(c.total) - devuelto);
      }, 0);

      return {
        ...t,
        montoVentas: montoVentasNeto,
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
    res.status(500).json({ error: 'Error al obtener estado' });
  }
});

// PUT /caja/actualizar-ventas/:id - Actualizar monto de ventas (llamado desde POS)
router.put('/actualizar-ventas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { montoVenta } = req.body;

    const monto = parseFloat(montoVenta);
    if (isNaN(monto) || monto < 0) {
      return res.status(400).json({ error: 'montoVenta inválido' });
    }

    const turno = await prisma.turnocaja.findUnique({
      where: { id: parseInt(id) }
    });

    if (!turno || turno.farmaciaId !== req.farmaciaId) {
      return res.status(404).json({ error: 'Turno no encontrado' });
    }

    if (turno.estado === 'CERRADO') {
      return res.status(400).json({ error: 'El turno está cerrado' });
    }

    const turnoActualizado = await prisma.turnocaja.update({
      where: { id: parseInt(id) },
      data: { montoVentas: { increment: monto } }
    });

    res.json(turnoActualizado);
  } catch (error) {
    console.error('Error updating ventas:', error);
    res.status(500).json({ error: 'Error al actualizar ventas' });
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
      // 403, no 401: contraseña de negocio, no la sesión.
      return res.status(403).json({ error: 'Contraseña de administrador incorrecta' });
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

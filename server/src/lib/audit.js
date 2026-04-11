const prisma = require('./prisma');

/**
 * Log an audit event.
 * @param {object} opts
 * @param {number}  opts.farmaciaId
 * @param {number|null} opts.usuarioId
 * @param {string}  opts.accion   – short verb: CREAR, EDITAR, ELIMINAR, CONFIRMAR, LOGIN, etc.
 * @param {string}  opts.modulo   – module: VENTAS, INVENTARIO, INGRESOS, USUARIOS, CAJA, CLIENTES, etc.
 * @param {string}  opts.descripcion – human-readable sentence
 * @param {object|string|null} opts.detalles – optional JSON blob or string
 * @param {string|null} opts.ip
 */
const logAudit = async ({ farmaciaId, usuarioId = null, accion, modulo, descripcion, detalles = null, ip = null }) => {
  try {
    // Para usuarios ADMIN sin farmacia asignada, usar farmaciaId = 1 (global)
    const finalFarmaciaId = farmaciaId && farmaciaId !== 0 ? farmaciaId : 1;
    
    await prisma.auditoria.create({
      data: {
        farmaciaId: finalFarmaciaId,
        usuarioId: usuarioId || null,
        accion: accion.substring(0, 100),
        modulo: modulo.substring(0, 50),
        descripcion,
        detalles: detalles ? (typeof detalles === 'string' ? detalles : JSON.stringify(detalles)) : null,
        ip,
      },
    });
  } catch (err) {
    // Audit logging must never break the main flow
    console.error('[AUDIT] Error logging audit event:', err.message);
  }
};

module.exports = { logAudit };

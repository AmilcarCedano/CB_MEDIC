const router = require('express').Router();
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const { requireAdmin, requireVendedorOrAdmin } = require('../middleware/auth');

router.get('/', requireVendedorOrAdmin, async (req, res) => {
  try {
    const farmacias = await prisma.farmacia.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return res.json(farmacias);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'No se pudieron listar las farmacias' });
  }
});

router.post('/', requireAdmin, async (req, res) => {
  try {
    const { nombre, direccion, ruc, telefono, email } = req.body || {};
    if (!nombre || !direccion || !ruc) {
      return res.status(400).json({ error: 'Nombre, direccion y RUC son obligatorios' });
    }

    const farmacia = await prisma.farmacia.create({
      data: {
        nombre,
        direccion,
        ruc,
        telefono: telefono || null,
        email: email || null,
      },
    });

    return res.status(201).json(farmacia);
  } catch (err) {
    console.error(err);
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Ya existe una farmacia con ese RUC' });
    }
    return res.status(500).json({ error: 'No se pudo crear la farmacia' });
  }
});

router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

    const { nombre, direccion, ruc, telefono, email } = req.body || {};
    if (!nombre || !direccion || !ruc) {
      return res.status(400).json({ error: 'Nombre, direccion y RUC son obligatorios' });
    }

    const updated = await prisma.farmacia.update({
      where: { id },
      data: {
        nombre,
        direccion,
        ruc,
        telefono: telefono || null,
        email: email || null,
      },
    });

    return res.json(updated);
  } catch (err) {
    console.error(err);
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Ya existe una farmacia con ese RUC' });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Farmacia no encontrada' });
    }
    return res.status(500).json({ error: 'No se pudo actualizar la farmacia' });
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'ID invalido' });

    const { adminUsername, adminPassword } = req.body || {};
    if (!adminUsername || !adminPassword) {
      return res.status(400).json({ error: 'Credenciales de administrador requeridas' });
    }

    const adminUser = await prisma.user.findUnique({ where: { username: adminUsername } });
    if (!adminUser || adminUser.role !== 'ADMIN') {
      return res.status(401).json({ error: 'Credenciales invalidas' });
    }

    let validPassword = false;
    try {
      validPassword = await bcrypt.compare(adminPassword, adminUser.passwordHash);
    } catch (bcryptErr) {
      if (adminUser.passwordHash === adminPassword) {
        console.warn(`[WARN] Usuario Admin ${adminUsername} tiene contraseña en texto plano.`);
        validPassword = true;
      }
    }
    if (!validPassword && adminUser.passwordHash === adminPassword) {
      console.warn(`[WARN] Usuario Admin ${adminUsername} validado con texto plano fallback.`);
      validPassword = true;
    }

    if (!validPassword) {
      console.log('DEBUG: Password validation failed for user:', adminUsername);
      return res.status(401).json({ error: 'Credenciales invalidas' });
    }

    // ELIMINACION MANUAL PROFUNDA (Bypass Cascade Issues)
    let currentStep = 'Iniciando limpieza';
    try {
      await prisma.$transaction(async (tx) => {
        // 1. Auditoria y Logs
        currentStep = 'Borrando auditoría y logs';
        console.log(`[DELETION] Paso: ${currentStep}`);
        await tx.auditoria.deleteMany({ where: { farmaciaId: id } });

        // 2. Financiero
        currentStep = 'Borrando egresos y turnos de caja';
        console.log(`[DELETION] Paso: ${currentStep}`);
        await tx.egresocaja.deleteMany({ where: { turno: { farmaciaId: id } } });
        await tx.turnocaja.deleteMany({ where: { farmaciaId: id } });
        
        currentStep = 'Borrando caja';
        console.log(`[DELETION] Paso: ${currentStep}`);
        await tx.caja.deleteMany({ where: { farmaciaId: id } });

        // 3. Ventas y Documentos (Productos)
        currentStep = 'Borrando ítems de comprobante y devoluciones';
        console.log(`[DELETION] Paso: ${currentStep}`);
        await tx.comprobanteitem.deleteMany({ where: { comprobante: { farmaciaId: id } } });
        await tx.devolucionitem.deleteMany({ where: { devolucion: { farmaciaId: id } } });
        await tx.devolucion.deleteMany({ where: { farmaciaId: id } });
        await tx.comprobante.deleteMany({ where: { farmaciaId: id } });

        // 4. Ventas y Documentos (Servicios)
        currentStep = 'Borrando comprobantes de servicio';
        console.log(`[DELETION] Paso: ${currentStep}`);
        await tx.comprobanteservicioitem.deleteMany({ where: { comprobante: { farmaciaId: id } } });
        await tx.comprobanteservicio.deleteMany({ where: { farmaciaId: id } });

        // 5. Inventario y Logística
        currentStep = 'Borrando envíos y promociones';
        console.log(`[DELETION] Paso: ${currentStep}`);
        await tx.envioitem.deleteMany({ where: { envio: { farmaciaId: id } } });
        await tx.envio.deleteMany({ where: { farmaciaId: id } });
        await tx.promocionitem.deleteMany({ where: { promocion: { farmaciaId: id } } });
        await tx.promocion.deleteMany({ where: { farmaciaId: id } });
        
        // 6. Productos y Categorías
        currentStep = 'Borrando productos y reglas';
        console.log(`[DELETION] Paso: ${currentStep}`);
        await tx.productoetiqueta.deleteMany({ where: { producto: { farmaciaId: id } } });
        await tx.recetahabitual.deleteMany({ where: { farmaciaId: id } });
        await tx.reglaVentaCruzada.deleteMany({ where: { farmaciaId: id } });
        await tx.regla.deleteMany({ where: { farmaciaId: id } });
        await tx.producto.deleteMany({ where: { farmaciaId: id } });
        await tx.categoria.deleteMany({ where: { farmaciaId: id } });
        await tx.servicio.deleteMany({ where: { farmaciaId: id } });
        await tx.categoriaservicio.deleteMany({ where: { farmaciaId: id } });

        // 7. Entidades y Configuración
        currentStep = 'Borrando clientes y configuraciones';
        console.log(`[DELETION] Paso: ${currentStep}`);
        await tx.cliente.deleteMany({ where: { farmaciaId: id } });
        await tx.configuracionLealtad.deleteMany({ where: { farmaciaId: id } });
        await tx.configuracionpago.deleteMany({ where: { farmaciaId: id } });
        await tx.configuracionpos.deleteMany({ where: { farmaciaId: id } });
        
        // 8. Usuarios (EXCLUIR al administrador que borra por seguridad)
        currentStep = 'Borrando usuarios';
        console.log(`[DELETION] Paso: ${currentStep}`);
        await tx.user.deleteMany({ 
          where: { 
            farmaciaId: id,
            id: { not: req.userId } // PROTECCIÓN: No borrar al administrador actual
          } 
        });

        // 9. FINAL
        currentStep = 'Borrando registro de farmacia';
        console.log(`[DELETION] Paso: ${currentStep}`);
        await tx.farmacia.delete({ where: { id } });
      });

      console.log(`[SUCCESS] Farmacia ID ${id} eliminada exitosamente.`);
      return res.status(204).end();
    } catch (txErr) {
      console.error(`[DELETE ERROR AT STEP: ${currentStep}]`, txErr);
      return res.status(500).json({ 
        error: 'No se pudo eliminar la farmacia debido a registros vinculados complejos.',
        step: currentStep,
        details: txErr.message 
      });
    }
  } catch (err) {
    console.error('[DELETE /farmacias/:id ERROR CRÍTICO]', err);
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Farmacia no encontrada' });
    }
    return res.status(500).json({ 
      error: 'Error interno de servidor.',
      details: err.message 
    });
  }
});

module.exports = router;

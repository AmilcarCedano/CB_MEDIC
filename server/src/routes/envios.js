const router = require('express').Router();
const prisma = require('../lib/prisma');
const bcrypt = require('bcryptjs');
const { logAudit } = require('../lib/audit');
const { requireAdmin } = require('../middleware/auth');

const ESTADOS = ['BORRADOR', 'COTIZADO', 'APLICADO'];

// Genera un número de lote en formato: LOT-YYYYMMDD-NNN
const generateLoteSerial = async (farmaciaId) => {
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
  const prefix = `LOT-${dateStr}-`;
  
  // Buscar el último lote con este prefijo
  const lastProduct = await prisma.producto.findFirst({
    where: {
      farmaciaId,
      lote: { startsWith: prefix }
    },
    orderBy: { lote: 'desc' }
  });
  
  let nextNum = 1;
  if (lastProduct?.lote) {
    const parts = lastProduct.lote.split('-');
    const lastNum = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastNum)) nextNum = lastNum + 1;
  }
  
  return `${prefix}${String(nextNum).padStart(3, '0')}`;
};

const sanitizePayload = (payload = {}) => ({
  codigoBarras: payload.codigoBarras?.trim() || '',
  nombre: payload.nombre?.trim() || '',
  descripcion: payload.descripcion?.trim() || '',
  principioActivo: payload.principioActivo?.trim() || '',
  concentracion: payload.concentracion?.trim() || '',
  laboratorio: payload.laboratorio?.trim() || '',
  presentacion: payload.presentacion?.trim() || '',
  precioCosto: Number(payload.precioCosto ?? 0),
  precioVenta: Number(payload.precioVenta ?? 0),
  stockActual: Number(payload.stockActual ?? 0),
  stockMinimo: Number(payload.stockMinimo ?? 0),
  lote: payload.lote?.trim() || '',
  fechaVencimiento: payload.fechaVencimiento || null,
  categoriaId: payload.categoriaId ? Number(payload.categoriaId) : null,
  productoId: payload.productoId ? Number(payload.productoId) : null,
});

const loadCategoria = async (tx, farmaciaId, categoriaId, cache) => {
  if (!categoriaId) throw new Error('Categoria obligatoria');
  if (cache.has(categoriaId)) return cache.get(categoriaId);
  const categoria = await tx.categoria.findUnique({ where: { id: categoriaId } });
  if (!categoria || categoria.farmaciaId !== farmaciaId) {
    throw new Error('La categoria no pertenece a la farmacia');
  }
  cache.set(categoriaId, categoria);
  return categoria;
};

const buildProductData = async (tx, farmaciaId, payload, cache) => {
  const data = sanitizePayload(payload);
  if (!data.nombre || data.categoriaId === null) {
    throw new Error('Datos del producto incompletos (nombre y categoría son obligatorios)');
  }
  const precio = Number(data.precioVenta);
  const stock = Number(data.stockActual);
  if (!Number.isFinite(precio) || !Number.isFinite(stock)) {
    throw new Error('Precio o stock invalidos');
  }
  await loadCategoria(tx, farmaciaId, data.categoriaId, cache);
  return {
    farmaciaId,
    categoriaId: data.categoriaId,
    codigoBarras: data.codigoBarras || null,
    nombre: data.nombre,
    descripcion: data.descripcion || null,
    principioActivo: data.principioActivo || null,
    concentracion: data.concentracion || null,
    laboratorio: data.laboratorio || null,
    presentacion: data.presentacion || null,
    precioCosto: data.precioCosto,
    precioVenta: precio,
    stockActual: stock,
    stockMinimo: data.stockMinimo,
    lote: data.lote || null,
    fechaVencimiento: data.fechaVencimiento ? new Date(data.fechaVencimiento) : null,
  };
};

// GET /api/envios - Listar ingresos/envíos
// Vendedores: solo ven los últimos 20 horas
// Admin: ven todos
router.get('/', async (req, res) => {
  try {
    const farmaciaId = req.farmaciaId;
    const userRole = req.userRole;
    const usuarioId = req.userId;

    if (!farmaciaId) return res.status(400).json({ error: 'Farmacia no identificada' });

    const estado = req.query.estado ? req.query.estado.toUpperCase() : null;
    if (estado && !ESTADOS.includes(estado)) {
      return res.status(400).json({ error: 'Estado invalido' });
    }

    // Construir where clause según el rol
    const whereClause = {
      farmaciaId,
      ...(estado ? { estado } : {}),
    };

    // Si es vendedor, aplicar filtro de 24 horas y solo sus ingresos
    if (userRole === 'VENDEDOR') {
      whereClause.usuarioId = usuarioId;
      whereClause.createdAt = {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 horas atrás
      };
    }

    const envios = await prisma.envio.findMany({
      where: whereClause,
      include: { envioitem: { include: { producto: { select: { id: true, codigoBarras: true } } } } },
      orderBy: { createdAt: 'desc' },
    });

    const serialized = envios.map((envio) => ({
      ...envio,
      items: envio.envioitem.map(item => ({
        ...item,
        currentBarcode: item.producto?.codigoBarras || null,
      })),
    }));

    return res.json(serialized);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'No se pudieron listar los envios' });
  }
});

// POST /api/envios - Crear nuevo ingreso (abierto a VENDEDOR y ADMIN)
router.post('/', async (req, res) => {
  try {
    const { titulo, items, applyDirect = false } = req.body || {};

    // Usar farmaciaId del usuario autenticado
    const parsedFarmaciaId = req.farmaciaId;
    const usuarioId = req.userId;

    if (!parsedFarmaciaId || !Array.isArray(items) || !items.length) {
      return res.status(400).json({ error: 'Datos insuficientes para registrar productos' });
    }

    if (applyDirect) {
      const cache = new Map();
      const result = await prisma.$transaction(async (tx) => {
        const envio = await tx.envio.create({
          data: {
            farmaciaId: parsedFarmaciaId,
            titulo: titulo?.trim() || `Ingreso Directo ${new Date().toLocaleString('es-PE')}`,
            estado: 'APLICADO',
            usuarioId: usuarioId,
            updatedAt: new Date(),
            appliedAt: new Date(),
          },
        });

        for (const payload of items) {
          let prodId = null;
          
          // Solo buscar existente si tiene código de barras
          let existing = null;
          if (payload.codigoBarras?.trim()) {
            existing = await tx.producto.findFirst({
              where: {
                farmaciaId: parsedFarmaciaId,
                codigoBarras: payload.codigoBarras,
                lote: payload.lote?.trim() || null,
                fechaVencimiento: payload.fechaVencimiento ? new Date(payload.fechaVencimiento) : null
              }
            });
          }

          if (existing) {
            // Si existe el lote exacto, incrementamos stock
            prodId = existing.id;
            const incrementalStock = Number(payload.stockActual) || 0;
            await tx.producto.update({
              where: { id: prodId },
              data: {
                stockActual: { increment: incrementalStock }
              }
            });
          } else {
            // Si NO existe el lote exacto, creamos un nuevo registro (lote independiente)
            const productData = await buildProductData(tx, parsedFarmaciaId, payload, cache);
            const producto = await tx.producto.create({ data: productData });
            prodId = producto.id;
          }

          await tx.envioitem.create({
            data: {
              envioId: envio.id,
              productoId: prodId,
              payload: sanitizePayload(payload),
              appliedAt: new Date(),
            }
          });
        }

        return tx.envio.findUnique({ where: { id: envio.id }, include: { envioitem: true } });
      });

      logAudit({
        farmaciaId: parsedFarmaciaId,
        usuarioId: usuarioId,
        accion: 'CREAR',
        modulo: 'INGRESOS',
        descripcion: `Ingreso directo aplicado: ${result.titulo} (${items.length} productos)`,
        detalles: { envioId: result.id, titulo: result.titulo, cantidadItems: items.length }
      });

      return res.status(201).json({ applied: true, result });
    }

    const envio = await prisma.envio.create({
      data: {
        farmaciaId: parsedFarmaciaId,
        titulo: titulo?.trim() || `Ingreso ${new Date().toLocaleString('es-PE')}`,
        estado: 'BORRADOR',
        usuarioId: usuarioId,
        updatedAt: new Date(),
        envioitem: {
          create: items.map((payload) => ({
            payload: sanitizePayload(payload),
          })),
        },
      },
      include: { envioitem: true },
    });

    const serialized = { ...envio, items: envio.envioitem };

    logAudit({
      farmaciaId: parsedFarmaciaId,
      usuarioId: usuarioId,
      accion: 'CREAR',
      modulo: 'INGRESOS',
      descripcion: `Ingreso pendiente creado: ${envio.titulo} (${items.length} productos)`,
      detalles: { envioId: envio.id, titulo: envio.titulo, cantidadItems: items.length }
    });

    return res.status(201).json(serialized);
  } catch (err) {
    console.error(err);
    const message = err?.message?.includes('categoria') ? err.message : 'No se pudo registrar el envio';
    return res.status(500).json({ error: message });
  }
});

router.post('/:id/quote', async (req, res) => {
  try {
    const envioId = Number(req.params.id);
    const farmaciaId = req.farmaciaId;
    const shippingCost = Number(req.body?.shippingCost);

    if (!envioId || Number.isNaN(shippingCost)) {
      return res.status(400).json({ error: 'Monto de envio invalido' });
    }

    const current = await prisma.envio.findUnique({ where: { id: envioId } });
    if (!current) return res.status(404).json({ error: 'Envio no encontrado' });

    // Verificar que el envío pertenezca a la farmacia del usuario
    if (current.farmaciaId !== farmaciaId) {
      return res.status(403).json({ error: 'No tienes acceso a este envío' });
    }

    if (current.estado !== 'BORRADOR') {
      return res.status(400).json({ error: 'Solo se pueden cotizar envios en borrador' });
    }

    const envio = await prisma.envio.update({
      where: { id: envioId },
      data: {
        shippingCost,
        estado: 'COTIZADO',
      },
      include: { envioitem: true },
    });

    return res.json({ ...envio, items: envio.envioitem });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'No se pudo registrar la cotizacion' });
  }
});

router.post('/:id/confirm', async (req, res) => {
  try {
    const envioId = Number(req.params.id);
    const farmaciaId = req.farmaciaId;

    if (!envioId) return res.status(400).json({ error: 'Envio invalido' });

    const envio = await prisma.envio.findUnique({
      where: { id: envioId },
      include: { envioitem: true },
    });

    if (!envio) return res.status(404).json({ error: 'Envio no encontrado' });

    // Verificar que el envío pertenezca a la farmacia del usuario
    if (envio.farmaciaId !== farmaciaId) {
      return res.status(403).json({ error: 'No tienes acceso a este envío' });
    }

    if (envio.estado !== 'BORRADOR') {
      return res.status(400).json({ error: 'El ingreso debe estar pendiente (borrador) antes de confirmar' });
    }

    const cache = new Map();
    const updatedEnvio = await prisma.$transaction(async (tx) => {
      for (const item of envio.envioitem) {
        // Solo buscar existente si tiene código de barras
        let existing = null;
        if (item.payload.codigoBarras?.trim()) {
          existing = await tx.producto.findFirst({
              where: {
                farmaciaId: envio.farmaciaId,
                codigoBarras: item.payload.codigoBarras,
                lote: item.payload.lote?.trim() || null,
                fechaVencimiento: item.payload.fechaVencimiento ? new Date(item.payload.fechaVencimiento) : null
              }
          });
        }

        if (existing) {
          const incrementalStock = Number(item.payload?.stockActual) || 0;
          await tx.producto.update({
            where: { id: existing.id },
            data: {
              stockActual: { increment: incrementalStock }
            }
          });

          await tx.envioitem.update({
            where: { id: item.id },
            data: { productoId: existing.id, appliedAt: new Date() },
          });
          continue;
        }

        const productData = await buildProductData(tx, envio.farmaciaId, item.payload, cache);
        const producto = await tx.producto.create({ data: productData });
        await tx.envioitem.update({
          where: { id: item.id },
          data: { productoId: producto.id, appliedAt: new Date() },
        });
      }

      await tx.envio.update({
        where: { id: envio.id },
        data: { estado: 'APLICADO', appliedAt: new Date() },
      });

      return tx.envio.findUnique({ where: { id: envio.id }, include: { envioitem: true } });
    });

    logAudit({
      farmaciaId: envio.farmaciaId,
      usuarioId: req.userId,
      accion: 'CONFIRMAR',
      modulo: 'INGRESOS',
      descripcion: `Ingreso confirmado y aplicado al stock: ${envio.titulo} (${envio.envioitem.length} productos)`,
      detalles: { envioId: envio.id }
    });

    return res.json({ ...updatedEnvio, items: updatedEnvio.envioitem });
  } catch (err) {
    console.error(err);
    const message = err?.message?.includes('categoria') ? err.message : 'No se pudo confirmar el envio';
    return res.status(500).json({ error: message });
  }
});

// DELETE /api/envios/:id - Eliminar ingreso (solo ADMIN)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const password = req.query.password || req.body?.password;
    const userRole = req.userRole;
    const userId = req.userId;

    if (!password) {
      return res.status(403).json({ error: 'Se requiere contraseña de administrador' });
    }

    // Verificar contraseña de admin
    const ADMIN_PASSWORD = process.env.ADMIN_MASTER_PASSWORD;
    if (!ADMIN_PASSWORD) {
      console.error('[CRITICAL] ADMIN_MASTER_PASSWORD no configurado');
      return res.status(500).json({ error: 'Error de configuración del servidor' });
    }

    // La contraseña debe coincidir con la variable de entorno O ser la contraseña hasheada de un admin
    let valid = false;

    if (password === ADMIN_PASSWORD) {
      valid = true;
    } else {
      // Verificar contra admins en DB
      const admins = await prisma.user.findMany({ where: { role: 'ADMIN', isActive: true } });
      for (const admin of admins) {
        try {
          if (await bcrypt.compare(password, admin.passwordHash)) {
            valid = true;
            break;
          }
        } catch (e) {}
        // Legacy: fallback a texto plano (eliminar en producción)
        if (admin.passwordHash === password) {
          console.warn(`[WARN] Admin ${admin.username} tiene contraseña en texto plano`);
          valid = true;
          break;
        }
      }
    }

    if (!valid) {
      return res.status(403).json({ error: 'Contraseña incorrecta' });
    }

    const envioId = Number(req.params.id);
    if (!envioId) return res.status(400).json({ error: 'Ingreso invalido' });

    const envio = await prisma.envio.findUnique({
      where: { id: envioId },
      include: { envioitem: true }
    });

    if (!envio) return res.status(404).json({ error: 'Ingreso no encontrado' });

    // Verificar que el ingreso pertenezca a la farmacia del usuario
    if (envio.farmaciaId !== req.farmaciaId) {
      return res.status(403).json({ error: 'No tienes acceso a este ingreso' });
    }

    // Si es vendedor, verificar que el ingreso sea reciente (menos de 24 horas)
    if (userRole === 'VENDEDOR') {
      const ingresoFecha = new Date(envio.createdAt);
      const hace24Horas = new Date(Date.now() - 24 * 60 * 60 * 1000);
      if (ingresoFecha < hace24Horas) {
        return res.status(403).json({
          error: 'No puedes eliminar ingresos con más de 24 horas de antigüedad. Contacta al administrador.'
        });
      }
    }

    await prisma.$transaction(async (tx) => {
      if (envio.estado === 'APLICADO') {
        for (const item of envio.envioitem) {
          let targetProductId = item.payload?.productoId || item.productoId;
          const currentBarcode = item.payload?.codigoBarras;

          if (!targetProductId && currentBarcode) {
            const productMatch = await tx.producto.findFirst({
              where: { farmaciaId: envio.farmaciaId, codigoBarras: currentBarcode }
            });
            if (productMatch) targetProductId = productMatch.id;
          }

          if (targetProductId) {
             const stockToRevert = Number(item.payload?.stockActual) || 0;
             await tx.producto.update({
               where: { id: Number(targetProductId) },
               data: { stockActual: { decrement: stockToRevert } }
             });
          }
        }
      }

      await tx.envioitem.deleteMany({ where: { envioId: envio.id } });
      await tx.envio.delete({ where: { id: envio.id } });
    });

    logAudit({
      farmaciaId: envio.farmaciaId,
      usuarioId: userId,
      accion: 'ELIMINAR',
      modulo: 'INGRESOS',
      descripcion: `Ingreso eliminado: ${envio.titulo} (estado: ${envio.estado}, ${envio.envioitem.length} items${envio.estado === 'APLICADO' ? ', stock revertido' : ''})`,
      detalles: { envioId: envio.id, estado: envio.estado }
    });

    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'No se pudo eliminar el ingreso' });
  }
});

// GET /api/envios/generate-lote - Generar siguiente número de lote
router.get('/generate-lote', async (req, res) => {
  try {
    const farmaciaId = req.farmaciaId;
    if (!farmaciaId) return res.status(400).json({ error: 'Farmacia no identificada' });
    const lote = await generateLoteSerial(farmaciaId);
    return res.json({ lote });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'No se pudo generar el número de lote' });
  }
});

// GET /api/envios/validate-barcode - Validar si un código de barras ya existe
router.get('/validate-barcode', async (req, res) => {
  try {
    const farmaciaId = req.farmaciaId;
    const barcode = req.query.code;
    if (!farmaciaId || !barcode) return res.json({ exists: false });
    
    const existing = await prisma.producto.findFirst({
      where: { farmaciaId, codigoBarras: barcode.trim() }
    });
    return res.json({ exists: !!existing, productName: existing?.nombre || null });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al validar código de barras' });
  }
});

module.exports = router;

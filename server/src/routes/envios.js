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

    // Misma validación que en /confirm: dos líneas con el mismo código+lote+vencimiento
    // apuntan al mismo producto y rompen la restricción única de EnvioItem.productoId.
    {
      const seenKeys = new Map();
      const duplicateNames = new Set();
      for (const payload of items) {
        const codigo = payload?.codigoBarras?.trim();
        if (!codigo) continue;
        const lote = payload?.lote?.trim() || '';
        const venc = payload?.fechaVencimiento || '';
        const key = `${codigo}|${lote}|${venc}`;
        if (seenKeys.has(key)) {
          duplicateNames.add(payload?.nombre || codigo);
        }
        seenKeys.set(key, true);
      }
      if (duplicateNames.size > 0) {
        return res.status(400).json({
          error: `Este ingreso tiene el mismo producto repetido dos veces con el mismo lote y vencimiento: ${[...duplicateNames].join(', ')}. Elimina o corrige la línea duplicada antes de continuar.`
        });
      }
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

// PUT /api/envios/:id - Editar un ingreso completo (agregar, editar o quitar líneas)
// Vendedor: solo si el ingreso tiene menos de 24h. Admin: siempre.
// Si el ingreso ya está APLICADO, cualquier línea con ventas o devoluciones registradas
// queda bloqueada (no se puede editar ni quitar) — solo se puede corregir manualmente
// desde Inventario. Todo cambio (agregado/editado/quitado) queda en la auditoría.
router.put('/:id', async (req, res) => {
  try {
    const envioId = Number(req.params.id);
    const farmaciaId = req.farmaciaId;
    const userRole = req.userRole;
    const userId = req.userId;
    const { titulo, items } = req.body || {};

    if (!envioId || !Array.isArray(items) || !items.length) {
      return res.status(400).json({ error: 'Datos insuficientes para editar el ingreso' });
    }

    const envio = await prisma.envio.findUnique({ where: { id: envioId }, include: { envioitem: true } });
    if (!envio) return res.status(404).json({ error: 'Ingreso no encontrado' });
    if (envio.farmaciaId !== farmaciaId) return res.status(403).json({ error: 'No tienes acceso a este ingreso' });

    if (userRole === 'VENDEDOR') {
      const hace24Horas = new Date(Date.now() - 24 * 60 * 60 * 1000);
      if (new Date(envio.createdAt) < hace24Horas) {
        return res.status(403).json({ error: 'No puedes editar ingresos con más de 24 horas de antigüedad. Contacta al administrador.' });
      }
    }

    // Detectar duplicados dentro de lo que se está guardando (mismo chequeo que confirm/applyDirect)
    {
      const seenKeys = new Map();
      const duplicateNames = new Set();
      for (const payload of items) {
        const codigo = payload?.codigoBarras?.trim();
        if (!codigo) continue;
        const lote = payload?.lote?.trim() || '';
        const venc = payload?.fechaVencimiento || '';
        const key = `${codigo}|${lote}|${venc}`;
        if (seenKeys.has(key)) duplicateNames.add(payload?.nombre || codigo);
        seenKeys.set(key, true);
      }
      if (duplicateNames.size > 0) {
        return res.status(400).json({
          error: `Hay productos repetidos con el mismo código, lote y vencimiento: ${[...duplicateNames].join(', ')}. Corrige antes de guardar.`
        });
      }
    }

    const existingById = new Map(envio.envioitem.map((i) => [i.id, i]));
    const submittedIds = new Set(items.filter((i) => i.id).map((i) => i.id));
    const toRemove = envio.envioitem.filter((i) => !submittedIds.has(i.id));

    try {
      const cache = new Map();
      const result = await prisma.$transaction(async (tx) => {
        const changes = { agregados: [], editados: [], quitados: [] };

        // 1. Quitar líneas que ya no están en la lista enviada
        for (const item of toRemove) {
          if (envio.estado === 'APLICADO' && item.productoId) {
            const [ventas, devoluciones] = await Promise.all([
              tx.comprobanteitem.count({ where: { productoId: item.productoId } }),
              tx.devolucionitem.count({ where: { productoId: item.productoId } }),
            ]);
            if (ventas > 0 || devoluciones > 0) {
              const e = new Error(`No se puede quitar "${item.payload?.nombre || 'este producto'}" porque ya tiene ventas o devoluciones registradas. Corrígelo manualmente desde Inventario.`);
              e.httpStatus = 409;
              throw e;
            }
            const stockToRevert = Number(item.payload?.stockActual) || 0;
            await tx.producto.update({ where: { id: item.productoId }, data: { stockActual: { decrement: stockToRevert } } });
          }
          await tx.envioitem.delete({ where: { id: item.id } });
          changes.quitados.push(item.payload?.nombre || `#${item.id}`);
        }

        // 2. Editar líneas existentes o crear las nuevas que se hayan agregado
        for (const payload of items) {
          const sanitized = sanitizePayload(payload);
          const existingItem = payload.id ? existingById.get(payload.id) : null;

          if (existingItem) {
            const sinCambios = JSON.stringify(sanitizePayload(existingItem.payload)) === JSON.stringify(sanitized);
            if (!sinCambios) {
              if (envio.estado === 'APLICADO' && existingItem.productoId) {
                const [ventas, devoluciones] = await Promise.all([
                  tx.comprobanteitem.count({ where: { productoId: existingItem.productoId } }),
                  tx.devolucionitem.count({ where: { productoId: existingItem.productoId } }),
                ]);
                if (ventas > 0 || devoluciones > 0) {
                  const e = new Error(`No se puede editar "${sanitized.nombre}" porque ya tiene ventas o devoluciones registradas. Corrígelo manualmente desde Inventario.`);
                  e.httpStatus = 409;
                  throw e;
                }
                const producto = await tx.producto.findUnique({ where: { id: existingItem.productoId } });
                if (producto) {
                  const oldStock = Number(existingItem.payload?.stockActual) || 0;
                  const delta = sanitized.stockActual - oldStock;
                  const stockResultante = producto.stockActual + delta;
                  if (stockResultante < 0) {
                    const e = new Error(`La cantidad de "${sanitized.nombre}" dejaría el stock del producto en negativo.`);
                    e.httpStatus = 400;
                    throw e;
                  }
                  await loadCategoria(tx, envio.farmaciaId, sanitized.categoriaId, cache);
                  await tx.producto.update({
                    where: { id: producto.id },
                    data: {
                      stockActual: stockResultante,
                      categoriaId: sanitized.categoriaId,
                      codigoBarras: sanitized.codigoBarras || null,
                      nombre: sanitized.nombre,
                      descripcion: sanitized.descripcion || null,
                      principioActivo: sanitized.principioActivo || null,
                      concentracion: sanitized.concentracion || null,
                      laboratorio: sanitized.laboratorio || null,
                      presentacion: sanitized.presentacion || null,
                      precioCosto: sanitized.precioCosto,
                      precioVenta: sanitized.precioVenta,
                      stockMinimo: sanitized.stockMinimo,
                      lote: sanitized.lote || null,
                      fechaVencimiento: sanitized.fechaVencimiento ? new Date(sanitized.fechaVencimiento) : null,
                    },
                  });
                }
              }
              changes.editados.push(sanitized.nombre);
            }
            await tx.envioitem.update({ where: { id: existingItem.id }, data: { payload: sanitized } });
          } else {
            // Línea nueva agregada durante la edición
            let productoId = null;
            if (envio.estado === 'APLICADO') {
              let existingProd = null;
              if (sanitized.codigoBarras) {
                existingProd = await tx.producto.findFirst({
                  where: {
                    farmaciaId: envio.farmaciaId,
                    codigoBarras: sanitized.codigoBarras,
                    lote: sanitized.lote || null,
                    fechaVencimiento: sanitized.fechaVencimiento ? new Date(sanitized.fechaVencimiento) : null,
                  },
                });
              }
              if (existingProd) {
                await tx.producto.update({ where: { id: existingProd.id }, data: { stockActual: { increment: sanitized.stockActual } } });
                productoId = existingProd.id;
              } else {
                const productData = await buildProductData(tx, envio.farmaciaId, sanitized, cache);
                const nuevo = await tx.producto.create({ data: productData });
                productoId = nuevo.id;
              }
            }
            await tx.envioitem.create({
              data: {
                envioId: envio.id,
                productoId,
                payload: sanitized,
                appliedAt: envio.estado === 'APLICADO' ? new Date() : null,
              },
            });
            changes.agregados.push(sanitized.nombre);
          }
        }

        await tx.envio.update({
          where: { id: envio.id },
          data: { titulo: titulo?.trim() || envio.titulo, updatedAt: new Date() },
        });

        return changes;
      });

      logAudit({
        farmaciaId,
        usuarioId: userId,
        accion: 'EDITAR',
        modulo: 'INGRESOS',
        descripcion: `Ingreso "${envio.titulo}" editado — agregados: ${result.agregados.join(', ') || 'ninguno'}; editados: ${result.editados.join(', ') || 'ninguno'}; quitados: ${result.quitados.join(', ') || 'ninguno'}`,
        detalles: result,
      });

      const updatedEnvio = await prisma.envio.findUnique({ where: { id: envio.id }, include: { envioitem: true } });
      return res.json({ ...updatedEnvio, items: updatedEnvio.envioitem });
    } catch (err) {
      const status = err.httpStatus || 500;
      if (status === 500) console.error(err);
      return res.status(status).json({ error: err.message || 'No se pudo editar el ingreso' });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'No se pudo editar el ingreso' });
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

    // Detectar líneas duplicadas (mismo código de barras + lote + vencimiento) antes de
    // aplicar. Dos líneas así terminan apuntando al mismo producto y rompen la restricción
    // única de EnvioItem.productoId a mitad de transacción con un error críptico de BD.
    const seenKeys = new Map();
    const duplicateNames = new Set();
    for (const item of envio.envioitem) {
      const codigo = item.payload?.codigoBarras?.trim();
      if (!codigo) continue; // sin código de barras no hay match automático, no puede colisionar
      const lote = item.payload?.lote?.trim() || '';
      const venc = item.payload?.fechaVencimiento || '';
      const key = `${codigo}|${lote}|${venc}`;
      if (seenKeys.has(key)) {
        duplicateNames.add(item.payload?.nombre || codigo);
      }
      seenKeys.set(key, true);
    }
    if (duplicateNames.size > 0) {
      return res.status(400).json({
        error: `Este ingreso tiene el mismo producto repetido dos veces con el mismo lote y vencimiento: ${[...duplicateNames].join(', ')}. Elimina o corrige la línea duplicada antes de confirmar.`
      });
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

// PUT /api/envios/:envioId/items/:itemId - Corregir la cantidad de una línea del ingreso
// Vendedor: solo si el ingreso sigue pendiente (BORRADOR/COTIZADO) y tiene menos de 24h.
// Admin: siempre, incluso si el ingreso ya fue APLICADO — pero se bloquea si ese producto
// ya tuvo una venta o devolución desde que se aplicó (ahí se corrige manual desde Inventario).
router.put('/:envioId/items/:itemId', async (req, res) => {
  try {
    const envioId = Number(req.params.envioId);
    const itemId = Number(req.params.itemId);
    const farmaciaId = req.farmaciaId;
    const userRole = req.userRole;
    const userId = req.userId;
    const newStock = Number(req.body?.stockActual);

    if (!envioId || !itemId) return res.status(400).json({ error: 'Ingreso o producto inválido' });
    if (!Number.isFinite(newStock) || newStock < 0) {
      return res.status(400).json({ error: 'La cantidad debe ser un número válido mayor o igual a 0' });
    }

    const envio = await prisma.envio.findUnique({ where: { id: envioId }, include: { envioitem: true } });
    if (!envio) return res.status(404).json({ error: 'Ingreso no encontrado' });
    if (envio.farmaciaId !== farmaciaId) return res.status(403).json({ error: 'No tienes acceso a este ingreso' });

    const item = envio.envioitem.find((i) => i.id === itemId);
    if (!item) return res.status(404).json({ error: 'Producto no encontrado en este ingreso' });

    if (envio.estado === 'APLICADO') {
      if (userRole === 'VENDEDOR') {
        const hace24Horas = new Date(Date.now() - 24 * 60 * 60 * 1000);
        if (new Date(envio.createdAt) < hace24Horas) {
          return res.status(403).json({ error: 'No puedes editar ingresos con más de 24 horas de antigüedad. Contacta al administrador.' });
        }
      }
      if (!item.productoId) {
        return res.status(400).json({ error: 'Este producto no quedó vinculado a un registro de inventario; no se puede editar aquí' });
      }

      try {
        const updatedItem = await prisma.$transaction(async (tx) => {
          const [ventas, devoluciones] = await Promise.all([
            tx.comprobanteitem.count({ where: { productoId: item.productoId } }),
            tx.devolucionitem.count({ where: { productoId: item.productoId } }),
          ]);
          if (ventas > 0 || devoluciones > 0) {
            const e = new Error('Ya se vendió o se registró una devolución de este producto desde que se aplicó el ingreso. Corrige la cantidad manualmente desde Inventario.');
            e.httpStatus = 409;
            throw e;
          }

          const producto = await tx.producto.findUnique({ where: { id: item.productoId } });
          if (!producto) {
            const e = new Error('El producto de esta línea ya no existe en el inventario');
            e.httpStatus = 404;
            throw e;
          }

          const oldStock = Number(item.payload?.stockActual) || 0;
          const delta = newStock - oldStock;
          const stockResultante = producto.stockActual + delta;
          if (stockResultante < 0) {
            const e = new Error('Esa cantidad dejaría el stock del producto en negativo');
            e.httpStatus = 400;
            throw e;
          }

          await tx.producto.update({ where: { id: producto.id }, data: { stockActual: stockResultante } });
          return tx.envioitem.update({
            where: { id: item.id },
            data: { payload: { ...item.payload, stockActual: newStock } },
          });
        });

        logAudit({
          farmaciaId,
          usuarioId: userId,
          accion: 'EDITAR',
          modulo: 'INGRESOS',
          descripcion: `Cantidad corregida en ingreso aplicado "${envio.titulo}": ${item.payload?.nombre || ''} → ${newStock} unidades`,
          detalles: { envioId, itemId, nuevoStock: newStock },
        });

        return res.json(updatedItem);
      } catch (err) {
        const status = err.httpStatus || 500;
        if (status === 500) console.error(err);
        return res.status(status).json({ error: err.message || 'No se pudo actualizar el producto' });
      }
    }

    // BORRADOR / COTIZADO: todavía no impacta el stock real
    if (userRole === 'VENDEDOR') {
      const hace24Horas = new Date(Date.now() - 24 * 60 * 60 * 1000);
      if (new Date(envio.createdAt) < hace24Horas) {
        return res.status(403).json({ error: 'No puedes editar ingresos con más de 24 horas de antigüedad. Contacta al administrador.' });
      }
    }

    const updatedItem = await prisma.envioitem.update({
      where: { id: item.id },
      data: { payload: { ...item.payload, stockActual: newStock } },
    });

    logAudit({
      farmaciaId,
      usuarioId: userId,
      accion: 'EDITAR',
      modulo: 'INGRESOS',
      descripcion: `Cantidad corregida en ingreso pendiente "${envio.titulo}": ${item.payload?.nombre || ''} → ${newStock} unidades`,
      detalles: { envioId, itemId, nuevoStock: newStock },
    });

    return res.json(updatedItem);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'No se pudo actualizar el producto' });
  }
});

// DELETE /api/envios/:envioId/items/:itemId - Quitar una línea duplicada/incorrecta de un
// ingreso que todavía no fue aplicado. Un ingreso ya APLICADO no permite quitar líneas aquí
// (usar Eliminar Ingreso, que revierte todo, o corregir la cantidad).
router.delete('/:envioId/items/:itemId', async (req, res) => {
  try {
    const envioId = Number(req.params.envioId);
    const itemId = Number(req.params.itemId);
    const farmaciaId = req.farmaciaId;
    const userRole = req.userRole;
    const userId = req.userId;

    if (!envioId || !itemId) return res.status(400).json({ error: 'Ingreso o producto inválido' });

    const envio = await prisma.envio.findUnique({ where: { id: envioId }, include: { envioitem: true } });
    if (!envio) return res.status(404).json({ error: 'Ingreso no encontrado' });
    if (envio.farmaciaId !== farmaciaId) return res.status(403).json({ error: 'No tienes acceso a este ingreso' });

    if (envio.estado === 'APLICADO') {
      return res.status(400).json({ error: 'No se puede quitar una línea de un ingreso ya aplicado. Usa Eliminar Ingreso o corrige la cantidad.' });
    }

    const item = envio.envioitem.find((i) => i.id === itemId);
    if (!item) return res.status(404).json({ error: 'Producto no encontrado en este ingreso' });

    if (userRole === 'VENDEDOR') {
      const hace24Horas = new Date(Date.now() - 24 * 60 * 60 * 1000);
      if (new Date(envio.createdAt) < hace24Horas) {
        return res.status(403).json({ error: 'No puedes editar ingresos con más de 24 horas de antigüedad. Contacta al administrador.' });
      }
    }

    if (envio.envioitem.length <= 1) {
      return res.status(400).json({ error: 'No puedes dejar el ingreso sin productos. Elimina el ingreso completo en su lugar.' });
    }

    await prisma.envioitem.delete({ where: { id: item.id } });

    logAudit({
      farmaciaId,
      usuarioId: userId,
      accion: 'ELIMINAR',
      modulo: 'INGRESOS',
      descripcion: `Línea quitada de ingreso pendiente "${envio.titulo}": ${item.payload?.nombre || ''}`,
      detalles: { envioId, itemId },
    });

    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'No se pudo quitar el producto' });
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

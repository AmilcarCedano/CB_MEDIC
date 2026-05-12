const router = require('express').Router();
const prisma = require('../lib/prisma');
const { logAudit } = require('../lib/audit');
const { requireAdmin } = require('../middleware/auth');

// GET /api/products - Listar productos de la farmacia del usuario
router.get('/', async (req, res) => {
  try {
    const farmaciaId = req.userRole === 'ADMIN' && req.query.farmaciaId
      ? Number(req.query.farmaciaId)
      : req.farmaciaId;

    if (!farmaciaId) {
      return res.status(400).json({ error: 'Farmacia no identificada. Se requiere farmaciaId.' });
    }

    const search = req.query.search;

    const productos = await prisma.producto.findMany({
      where: {
        farmaciaId,
        ...(search
          ? {
            OR: [
              { nombre: { contains: search } },
              { codigoBarras: { contains: search } },
            ],
          }
          : {}),
      },
      include: {
        categoria: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // REGLA: Vendedor no ve precio de costo
    if (req.userRole === 'VENDEDOR') {
      productos.forEach(p => {
        delete p.precioCosto;
      });
    }

    return res.json(productos);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'No se pudieron listar los productos' });
  }
});

// POST /api/products - Crear nuevo producto
router.post('/', async (req, res) => {
  try {
    const {
      categoriaId,
      codigoBarras,
      nombre,
      principioActivo,
      concentracion,
      laboratorio,
      presentacion,
      descripcion,
      precioCosto,
      precioVenta,
      stockActual,
      stockMinimo,
      lote,
      fechaVencimiento,
    } = req.body || {};

    // Usar farmaciaId del usuario autenticado (del JWT)
    const farmaciaId = req.farmaciaId;

    if (
      !farmaciaId ||
      !categoriaId ||
      !nombre ||
      precioVenta === undefined ||
      stockActual === undefined
    ) {
      return res.status(400).json({ error: 'Campos obligatorios faltantes' });
    }

    // Validar unicidad del código de barras si se proporcionó
    if (codigoBarras && codigoBarras.trim()) {
      const existingBarcode = await prisma.producto.findFirst({
        where: { farmaciaId: Number(farmaciaId), codigoBarras: codigoBarras.trim() }
      });
      if (existingBarcode) {
        return res.status(409).json({ error: `Ya existe un producto con el código de barras "${codigoBarras.trim()}"` });
      }
    }

    const categoria = await prisma.categoria.findUnique({ where: { id: Number(categoriaId) } });
    if (!categoria || categoria.farmaciaId !== Number(farmaciaId)) {
      return res.status(400).json({ error: 'La categoria no pertenece a la farmacia' });
    }

    const producto = await prisma.producto.create({
      data: {
        farmaciaId: Number(farmaciaId),
        categoriaId: Number(categoriaId),
        codigoBarras: codigoBarras?.trim() || null,
        nombre: nombre.trim(),
        principioActivo: principioActivo?.trim() || null,
        concentracion: concentracion?.trim() || null,
        laboratorio: laboratorio?.trim() || null,
        presentacion: presentacion?.trim() || null,
        descripcion: descripcion?.trim() || null,
        precioCosto: precioCosto !== undefined ? Number(precioCosto) : 0,
        precioVenta: Number(precioVenta),
        stockActual: Number(stockActual),
        stockMinimo: stockMinimo !== undefined ? Number(stockMinimo) : 0,
        lote: lote?.trim() || null,
        fechaVencimiento: fechaVencimiento ? new Date(fechaVencimiento) : null,
      },
    });

    logAudit({
      farmaciaId: Number(farmaciaId),
      usuarioId: req.userId,
      accion: 'CREAR',
      modulo: 'INVENTARIO',
      descripcion: `Producto creado: ${nombre} (${codigoBarras})`,
      detalles: { productoId: producto.id }
    });

    return res.status(201).json(producto);
  } catch (err) {
    console.error(err);
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Ya existe un producto con ese codigo de barras' });
    }
    return res.status(500).json({ error: 'No se pudo registrar el producto' });
  }
});

// PUT /api/products/:id - Actualizar producto
// REGLA CRÍTICA: Solo ADMIN puede disminuir stock. VENDEDOR solo puede AUMENTAR.
router.put('/:id', async (req, res) => {
  try {
    const productoId = Number(req.params.id);
    const body = req.body || {};

    const farmaciaId = req.farmaciaId;
    const userRole = req.userRole;

    const producto = await prisma.producto.findUnique({ where: { id: productoId } });
    if (!producto || producto.farmaciaId !== farmaciaId) {
      return res.status(404).json({ error: 'Producto no encontrado en esta farmacia' });
    }

    // 1. Validar STOCK (Solo aumentar para Vendedor)
    if (body.stockActual !== undefined) {
      const newStock = Number(body.stockActual || 0);
      const currentStock = Number(producto.stockActual || 0);

      if (newStock < currentStock && userRole !== 'ADMIN') {
        return res.status(403).json({
          error: `No tienes permiso para disminuir el stock. El stock actual es ${currentStock}. Solo administradores pueden reducirlo.`
        });
      }
    }

    // 2. Validar PRECIO (Solo aumentar para Vendedor)
    let descripcionPrecio = '';
    if (body.precioVenta !== undefined) {
      const newPrice = Number(body.precioVenta || 0);
      const currentPrice = Number(producto.precioVenta || 0);

      if (newPrice < currentPrice && userRole !== 'ADMIN') {
        return res.status(403).json({
          error: `No tienes permiso para bajar el precio. El precio actual es S/ ${currentPrice}. Solo puedes aumentarlo.`
        });
      }

      if (Math.abs(newPrice - currentPrice) > 0.001) {
        descripcionPrecio = ` (Cambio de precio: S/ ${currentPrice} -> S/ ${newPrice})`;
      }
    }

    // 3. Validar LOTE y FECHA (Solo ADMIN)
    if ((body.lote !== undefined || body.fechaVencimiento !== undefined) && userRole !== 'ADMIN') {
        const payloadLote = String(body.lote ?? '').trim();
        const currentLote = String(producto.lote ?? '').trim();
        
        const payloadFecha = body.fechaVencimiento ? new Date(body.fechaVencimiento).toISOString().split('T')[0] : '';
        const currentFecha = producto.fechaVencimiento ? new Date(producto.fechaVencimiento).toISOString().split('T')[0] : '';

        const changedLote = body.lote !== undefined && payloadLote !== currentLote;
        const changedFecha = body.fechaVencimiento !== undefined && payloadFecha !== currentFecha;
        
        if (changedLote || changedFecha) {
            return res.status(403).json({
                error: 'No tienes permiso para modificar el lote o la fecha de vencimiento. Solo los administradores pueden realizar estos cambios.'
            });
        }
    }

    // 4. Validar CODIGO DE BARRAS unicidad (si se está cambiando)
    let sanitizedBarcode = undefined;
    if (body.codigoBarras !== undefined) {
      sanitizedBarcode = body.codigoBarras?.trim() || null;
      const currentBarcode = producto.codigoBarras || null;
      
      if (sanitizedBarcode && sanitizedBarcode !== currentBarcode) {
        const existingBarcode = await prisma.producto.findFirst({
          where: {
            farmaciaId,
            codigoBarras: sanitizedBarcode,
            id: { not: productoId }
          }
        });
        if (existingBarcode) {
          return res.status(409).json({
            error: `Ya existe otro producto con el código de barras "${sanitizedBarcode}" (${existingBarcode.nombre})`
          });
        }
      }
    }

    // 5. Construir datos de actualización solo con campos válidos de Prisma
    const updateData = {};
    if (body.categoriaId !== undefined) updateData.categoriaId = Number(body.categoriaId);
    if (sanitizedBarcode !== undefined) updateData.codigoBarras = sanitizedBarcode;
    if (body.nombre !== undefined) updateData.nombre = body.nombre;
    if (body.principioActivo !== undefined) updateData.principioActivo = body.principioActivo || null;
    if (body.concentracion !== undefined) updateData.concentracion = body.concentracion || null;
    if (body.laboratorio !== undefined) updateData.laboratorio = body.laboratorio || null;
    if (body.presentacion !== undefined) updateData.presentacion = body.presentacion || null;
    if (body.descripcion !== undefined) updateData.descripcion = body.descripcion || null;
    if (body.precioCosto !== undefined) updateData.precioCosto = Number(body.precioCosto);
    if (body.precioVenta !== undefined) updateData.precioVenta = Number(body.precioVenta);
    if (body.stockActual !== undefined) updateData.stockActual = Number(body.stockActual);
    if (body.stockMinimo !== undefined) updateData.stockMinimo = Number(body.stockMinimo);
    if (body.lote !== undefined) updateData.lote = body.lote?.trim() || null;
    if (body.fechaVencimiento !== undefined) updateData.fechaVencimiento = body.fechaVencimiento ? new Date(body.fechaVencimiento) : null;

    const updatedProducto = await prisma.producto.update({
      where: { id: productoId },
      data: updateData,
    });

    logAudit({
      farmaciaId: updatedProducto.farmaciaId,
      usuarioId: req.userId,
      accion: 'EDITAR',
      modulo: 'INVENTARIO',
      descripcion: `Producto editado: ${updatedProducto.nombre}${descripcionPrecio}`,
      detalles: { productoId, data: updateData }
    });

    return res.json(updatedProducto);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'No se pudo actualizar el producto' });
  }
});

// DELETE /api/products/:id - Eliminar producto (solo ADMIN)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const productoId = Number(req.params.id);
    const farmaciaId = req.farmaciaId;

    const producto = await prisma.producto.findUnique({ where: { id: productoId } });
    if (!producto || producto.farmaciaId !== farmaciaId) {
      return res.status(404).json({ error: 'Producto no encontrado en esta farmacia' });
    }

    await prisma.producto.delete({ where: { id: productoId } });

    logAudit({
      farmaciaId: farmaciaId,
      usuarioId: req.userId,
      accion: 'ELIMINAR',
      modulo: 'INVENTARIO',
      descripcion: `Producto eliminado: ${producto.nombre} (${producto.codigoBarras})`,
      detalles: { productoId }
    });

    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'No se pudo eliminar el producto' });
  }
});

module.exports = router;

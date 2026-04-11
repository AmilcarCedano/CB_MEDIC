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
      !codigoBarras ||
      !nombre ||
      precioVenta === undefined ||
      stockActual === undefined
    ) {
      return res.status(400).json({ error: 'Campos obligatorios faltantes' });
    }

    const categoria = await prisma.categoria.findUnique({ where: { id: Number(categoriaId) } });
    if (!categoria || categoria.farmaciaId !== Number(farmaciaId)) {
      return res.status(400).json({ error: 'La categoria no pertenece a la farmacia' });
    }

    const producto = await prisma.producto.create({
      data: {
        farmaciaId: Number(farmaciaId),
        categoriaId: Number(categoriaId),
        codigoBarras: String(codigoBarras).trim(),
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
    const { categoriaId, categoria, ...dataToUpdate } = body;

    const farmaciaId = req.farmaciaId;
    const userRole = req.userRole;

    const producto = await prisma.producto.findUnique({ where: { id: productoId } });
    if (!producto || producto.farmaciaId !== farmaciaId) {
      return res.status(404).json({ error: 'Producto no encontrado en esta farmacia' });
    }

    // 1. Validar STOCK (Solo aumentar para Vendedor)
    if (dataToUpdate.stockActual !== undefined) {
      const newStock = Number(dataToUpdate.stockActual || 0);
      const currentStock = Number(producto.stockActual || 0);

      if (newStock < currentStock && userRole !== 'ADMIN') {
        return res.status(403).json({
          error: `No tienes permiso para disminuir el stock. El stock actual es ${currentStock}. Solo administradores pueden reducirlo.`
        });
      }
    }

    // 2. Validar PRECIO (Solo aumentar para Vendedor)
    let descripcionPrecio = '';
    if (dataToUpdate.precioVenta !== undefined) {
      const newPrice = Number(dataToUpdate.precioVenta || 0);
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
    // Comparamos como strings para evitar problemas de objetos Fecha/ISO inconsistentes
    if ((dataToUpdate.lote !== undefined || dataToUpdate.fechaVencimiento !== undefined) && userRole !== 'ADMIN') {
        const payloadLote = String(dataToUpdate.lote ?? '').trim();
        const currentLote = String(producto.lote ?? '').trim();
        
        const payloadFecha = dataToUpdate.fechaVencimiento ? new Date(dataToUpdate.fechaVencimiento).toISOString().split('T')[0] : '';
        const currentFecha = producto.fechaVencimiento ? new Date(producto.fechaVencimiento).toISOString().split('T')[0] : '';

        const changedLote = dataToUpdate.lote !== undefined && payloadLote !== currentLote;
        const changedFecha = dataToUpdate.fechaVencimiento !== undefined && payloadFecha !== currentFecha;
        
        if (changedLote || changedFecha) {
            return res.status(403).json({
                error: 'No tienes permiso para modificar el lote o la fecha de vencimiento. Solo los administradores pueden realizar estos cambios.'
            });
        }
    }

    const updatedProducto = await prisma.producto.update({
      where: { id: productoId },
      data: {
        ...dataToUpdate,
        categoriaId: categoriaId ? Number(categoriaId) : undefined,
        precioCosto: dataToUpdate.precioCosto !== undefined ? Number(dataToUpdate.precioCosto) : undefined,
        precioVenta: dataToUpdate.precioVenta !== undefined ? Number(dataToUpdate.precioVenta) : undefined,
        stockActual: dataToUpdate.stockActual !== undefined ? Number(dataToUpdate.stockActual) : undefined,
        stockMinimo: dataToUpdate.stockMinimo !== undefined ? Number(dataToUpdate.stockMinimo) : undefined,
        fechaVencimiento: dataToUpdate.fechaVencimiento ? new Date(dataToUpdate.fechaVencimiento) : undefined,
      },
    });

    logAudit({
      farmaciaId: updatedProducto.farmaciaId,
      usuarioId: req.userId,
      accion: 'EDITAR',
      modulo: 'INVENTARIO',
      descripcion: `Producto editado: ${updatedProducto.nombre}${descripcionPrecio}`,
      detalles: { productoId, data: dataToUpdate }
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

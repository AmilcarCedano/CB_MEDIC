const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { logAudit } = require('../lib/audit');
const { DEFAULT_LOYALTY, getLoyaltyConfig } = require('../lib/loyalty');
const { requireAdmin } = require('../middleware/auth');

// Helper para calcular totales (subtotal, igv, total)
const calculateTotals = (cartItems, discountFromPoints = 0) => {
  let currentTotal = cartItems.reduce((sum, item) => sum + parseFloat(item.precioUnitario) * item.cantidad, 0);

  currentTotal -= discountFromPoints;
  if (currentTotal < 0) currentTotal = 0;

  const subtotal = currentTotal / 1.18;
  const igv = currentTotal - subtotal;
  const total = currentTotal;

  return { subtotal, igv, total };
};

// GET /api/sales - Obtiene todos los comprobantes de una farmacia
// Los vendedores solo ven comprobantes de las últimas 20 horas
// Los admins ven todos los comprobantes
router.get('/', async (req, res) => {
  const currentFarmaciaId = req.farmaciaId;
  const currentUserRole = req.userRole;
  const currentUsuarioId = req.userId;

  try {
    // Construir where clause según el rol
    const whereClause = {
      farmaciaId: currentFarmaciaId,
    };

    // Si es vendedor, aplicar filtro de 24 horas y solo sus ventas
    if (currentUserRole === 'VENDEDOR') {
      whereClause.usuarioId = currentUsuarioId;
      whereClause.fecha_emision = {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 horas atrás
      };
    }

    const comprobantes = await prisma.comprobante.findMany({
      where: whereClause,
      include: {
        cliente: true,
        comprobanteitem: {
          include: {
            producto: true,
          },
        },
        devolucion: true,
      },
      orderBy: { fecha_emision: 'desc' },
    });

    const serialized = comprobantes.map((comp) => ({
      ...comp,
      items: comp.comprobanteitem,
      tieneDevolucion: comp.devolucion && comp.devolucion.length > 0,
    }));

    res.json(serialized);
  } catch (error) {
    console.error('Error fetching comprobantes:', error);
    res.status(500).json({ error: 'Error fetching comprobantes', details: error.message });
  }
});

// GET /api/sales/suggestions - Obtiene sugerencias inteligentes para el carrito
router.post('/suggestions', async (req, res) => {
  const { cart } = req.body;
  const currentFarmaciaId = req.farmaciaId;

  if (!cart || cart.length === 0) {
    return res.json({ promotions: [], recommendations: [] });
  }

  try {
    const cartProductIds = cart.map(item => item.productId);

    const cartProducts = await prisma.producto.findMany({
      where: {
        id: { in: cartProductIds },
        farmaciaId: currentFarmaciaId,
      },
      select: {
        id: true,
        nombre: true,
        principioActivo: true,
        presentacion: true,
      },
    });

    const productRules = await prisma.reglaVentaCruzada.findMany({
      where: {
        activo: true,
        triggerProductoId: { in: cartProductIds },
        OR: [
          { farmaciaId: 0 },
          { farmaciaId: currentFarmaciaId },
        ],
      },
      include: { sugeridoProducto: true },
      orderBy: { prioridad: 'desc' },
    });

    const recommendations = [];
    for (const rule of productRules) {
      const product = rule.sugeridoProducto;
      if (!product) continue;
      if (cartProductIds.includes(product.id)) continue;
      if (product.stockActual <= 0) continue;

      const triggerProduct = cartProducts.find(p => p.id === rule.triggerProductoId);
      const payloadProduct = {
        id: product.id,
        nombre: product.nombre,
        precioVenta: parseFloat(product.precioVenta),
        price: parseFloat(product.precioVenta),
        stockActual: product.stockActual,
        codigoBarras: product.codigoBarras,
        presentacion: product.presentacion,
      };

      const existingRec = recommendations.find(
        (r) => r.mensaje === rule.mensaje && r.triggerProductoId === rule.triggerProductoId
      );
      if (existingRec) {
        if (!existingRec.productos.some(p => p.id === product.id)) {
          existingRec.productos.push(payloadProduct);
        }
      } else {
        recommendations.push({
          id: rule.id,
          triggerProductoId: rule.triggerProductoId,
          triggerProductoNombre: triggerProduct?.nombre || null,
          mensaje: rule.mensaje,
          productos: [payloadProduct],
        });
      }
    }

    // 4. Sugerencias dinámicas por mismo principio activo
    const ingredientRecommendations = [];
    const ingredientMap = new Map();
    for (const product of cartProducts) {
      const active = product.principioActivo?.trim();
      if (!active) continue;
      const key = active.toLowerCase();
      const entry = ingredientMap.get(key) || { displayName: active, presentations: new Set() };
      if (product.presentacion?.trim()) {
        entry.presentations.add(product.presentacion.trim());
      }
      ingredientMap.set(key, entry);
    }

    const ingredientPromises = Array.from(ingredientMap.entries()).map(async ([ingredientKey, entry]) => {
      const excludePresentations = [...entry.presentations].filter(Boolean);
      const notFilters = [{ id: { in: cartProductIds } }];
      if (excludePresentations.length > 0) {
        notFilters.push({ presentacion: { in: excludePresentations } });
      }

      const ingredientFilter = entry.displayName
        ? {
          principioActivo: {
            contains: entry.displayName,
          },
        }
        : undefined;

      const candidates = await prisma.producto.findMany({
        where: {
          farmaciaId: currentFarmaciaId,
          stockActual: { gt: 0 },
          ...(ingredientFilter || {}),
          NOT: notFilters,
        },
        orderBy: { stockActual: 'desc' },
        take: 3,
        select: {
          id: true,
          nombre: true,
          precioVenta: true,
          stockActual: true,
          codigoBarras: true,
          presentacion: true,
        },
      });

      return { ingredientKey, entry, candidates };
    });

    const ingredientResults = await Promise.all(ingredientPromises);
    ingredientResults.forEach(({ ingredientKey, entry, candidates }) => {
      if (!candidates || candidates.length === 0) return;
      ingredientRecommendations.push({
        id: `ingredient-${ingredientKey}`,
        triggerProductoId: null,
        triggerProductoNombre: null,
        mensaje: `También tenemos otras presentaciones de ${entry.displayName} si necesita cambiar la forma farmacéutica.`,
        productos: candidates.map(p => ({
          id: p.id,
          nombre: p.nombre,
          precioVenta: parseFloat(p.precioVenta),
          price: parseFloat(p.precioVenta),
          stockActual: p.stockActual,
          codigoBarras: p.codigoBarras,
          presentacion: p.presentacion,
        })),
      });
    });

    const finalRecommendations = [...recommendations, ...ingredientRecommendations];

    res.json({ promotions: [], recommendations: finalRecommendations });

  } catch (error) {
    console.error('Error fetching suggestions:', error);
    res.status(500).json({ error: 'Error fetching suggestions', details: error.message });
  }
});


// POST /api/sales - Procesa la venta (checkout)
router.post('/', async (req, res) => {
  const { cart, clienteId, metodoPago, montoRecibido, canjePuntos, tipoComprobante } = req.body;
  const currentFarmaciaId = req.farmaciaId;
  const currentUsuarioId = req.userId;

  if (!cart || cart.length === 0) {
    return res.status(400).json({ error: 'El carrito no puede estar vacío.' });
  }

  const parsedMontoRecibido = parseFloat(montoRecibido ?? 0) || 0;
  const parsedClienteId = clienteId ? parseInt(clienteId, 10) : null;
  const requestedPoints = parseInt(canjePuntos ?? 0, 10);
  const loyaltyConfig = await getLoyaltyConfig(currentFarmaciaId);
  const loyaltyEnabled = loyaltyConfig.activo !== false;
  const valorPorPunto = Number.isFinite(loyaltyConfig.valorPorPunto)
    ? loyaltyConfig.valorPorPunto
    : DEFAULT_LOYALTY.valorPorPunto;
  const solesPorPunto = Number.isFinite(loyaltyConfig.solesPorPunto)
    ? loyaltyConfig.solesPorPunto
    : DEFAULT_LOYALTY.solesPorPunto;
  const appliedPoints = loyaltyEnabled && Number.isFinite(requestedPoints) && requestedPoints > 0 ? requestedPoints : 0;

  try {
    const result = await prisma.$transaction(async (tx) => {
      let client = null;
      if (parsedClienteId) {
        const foundClient = await tx.cliente.findUnique({
          where: { id: parsedClienteId },
        });
        if (!foundClient || foundClient.farmaciaId !== currentFarmaciaId) {
          throw new Error('Cliente no encontrado o no pertenece a esta farmacia.');
        }
        if (appliedPoints > 0 && foundClient.puntosAcumulados < appliedPoints) {
          throw new Error('El cliente no tiene suficientes puntos para canjear.');
        }
        client = foundClient;
      }

      if (appliedPoints > 0 && !client) {
        throw new Error('Debes seleccionar un cliente para canjear puntos.');
      }

      if (appliedPoints > 0 && !loyaltyEnabled) {
        throw new Error('El programa de lealtad está desactivado.');
      }

      // Separar items por tipo
      const productItems = cart.filter(item => !item.type || item.type === 'PRODUCT');
      const serviceItems = cart.filter(item => item.type === 'SERVICE');

      const productIds = productItems.map(item => item.productId);
      const serviceIds = serviceItems.map(item => item.productId);

      // Buscar datos en DB
      const productsInDb = productIds.length > 0 ? await tx.producto.findMany({
        where: { id: { in: productIds }, farmaciaId: currentFarmaciaId },
      }) : [];

      const servicesInDb = serviceIds.length > 0 ? await tx.servicio.findMany({
        where: { id: { in: serviceIds }, farmaciaId: currentFarmaciaId },
      }) : [];

      // Procesar items y unificarlos
      const processedItems = [];
      const stockMap = new Map();

      productsInDb.forEach(p => stockMap.set(p.id, p.stockActual));
      for (const item of productItems) {
        const dbProduct = productsInDb.find(p => p.id === item.productId);
        if (!dbProduct) throw new Error(`Producto con ID ${item.productId} no encontrado.`);

        const availableStock = stockMap.get(dbProduct.id);
        if (availableStock < item.quantity) {
          throw new Error(`Stock insuficiente para ${dbProduct.nombre}. Disponible: ${availableStock}, Solicitado: ${item.quantity}`);
        }
        stockMap.set(dbProduct.id, availableStock - item.quantity);
        processedItems.push({
          ...item,
          type: 'PRODUCT',
          dbId: dbProduct.id,
          nombre: dbProduct.nombre,
          codigo: dbProduct.codigoBarras,
          precioUnitario: parseFloat(dbProduct.precioVenta),
          quantity: item.quantity
        });
      }

      // Procesar Servicios
      for (const item of serviceItems) {
        const dbService = servicesInDb.find(s => s.id === item.productId);
        if (!dbService) throw new Error(`Servicio con ID ${item.productId} no encontrado.`);
        processedItems.push({
          ...item,
          type: 'SERVICE',
          dbId: dbService.id,
          nombre: dbService.nombre,
          codigo: dbService.codigoSunat || 'SERV',
          precioUnitario: parseFloat(dbService.precioVenta),
          quantity: item.quantity
        });
      }

      // Procesar Promociones
      const promoItems = cart.filter(item => item.type === 'PROMO');
      for (const item of promoItems) {
        const promo = await tx.promocion.findUnique({
          where: { id: item.productId },
          include: { items: { include: { producto: true } } },
        });
        if (!promo || promo.farmaciaId !== currentFarmaciaId) {
          throw new Error(`Promoción con ID ${item.productId} no encontrada.`);
        }
        if (!promo.activo) {
          throw new Error(`La promoción "${promo.nombre}" está inactiva.`);
        }
        const totalQty = item.quantity;
        for (const pi of promo.items) {
          if (!stockMap.has(pi.productoId)) {
            stockMap.set(pi.productoId, pi.producto.stockActual);
          }
          const availableStock = stockMap.get(pi.productoId);
          const needed = pi.cantidad * totalQty;
          if (availableStock < needed) {
            throw new Error(`Stock insuficiente para "${pi.producto.nombre}" en la promo "${promo.nombre}". Disponible: ${availableStock}, Necesario: ${needed}`);
          }
          stockMap.set(pi.productoId, availableStock - needed);
        }
        const precioNormal = promo.items.reduce((sum, pi) => sum + parseFloat(pi.producto.precioVenta) * pi.cantidad, 0);
        const precioPromo = parseFloat(promo.precioPromo);
        const descuentoPromo = Math.max(0, precioNormal - precioPromo);
        processedItems.push({
          type: 'PROMO',
          promoId: promo.id,
          promoNombre: promo.nombre,
          promoItems: promo.items,
          precioNormal,
          precioPromo,
          descuentoPromo,
          quantity: totalQty,
          precioUnitario: precioPromo,
        });
      }

      const igvRate = 0.18;
      const initialTotal = processedItems.reduce((sum, item) => {
        const itemPrice = Number(item.precioUnitario) || 0;
        const itemQty = Number(item.quantity) || 0;
        return sum + (itemPrice * itemQty);
      }, 0);

      const discountFromPoints = Number(appliedPoints) * Number(valorPorPunto);
      const total = Math.max(0, initialTotal - discountFromPoints);
      const subtotalAfterDiscount = total / (1 + igvRate);
      const igv = total - subtotalAfterDiscount;

      if (metodoPago === 'Efectivo' && parsedMontoRecibido < total) {
        throw new Error('El monto recibido es menor que el total.');
      }

      // --- Lógica de Serie y Número ---
      let serie, tipoComp, estadoSunat;

      if (tipoComprobante === 'Factura') {
        serie = 'F001';
        tipoComp = '01';
        estadoSunat = 'PENDIENTE';
      } else if (tipoComprobante === 'Boleta') {
        serie = 'B001';
        tipoComp = '03';
        estadoSunat = 'PENDIENTE';
      } else if (tipoComprobante === 'Nota de Venta') {
        serie = 'NV01';
        tipoComp = '00';
        estadoSunat = 'COMPLETO';
      } else {
        serie = 'B001';
        tipoComp = '03';
        estadoSunat = 'PENDIENTE';
      }

      if (tipoComprobante === 'Nota de Venta' && appliedPoints > 0) {
        throw new Error('No se pueden canjear puntos en una Nota de Venta.');
      }

      const lastComprobante = await tx.comprobante.findFirst({
        where: { farmaciaId: currentFarmaciaId, serie: serie },
        orderBy: { numero: 'desc' },
      });
      const numero = lastComprobante ? lastComprobante.numero + 1 : 1;

      const tipoDocClienteMap = {
        'DNI': '1',
        'RUC': '6',
      };

      let clienteDireccion = client?.direccion || '';
      const extras = [client?.distrito, client?.provincia, client?.departamento].filter(Boolean);
      if (extras.length > 0) {
        clienteDireccion = clienteDireccion ? `${clienteDireccion} | ${extras.join(' - ')}` : extras.join(' - ');
      }
      const newComprobante = await tx.comprobante.create({
        data: {
          farmaciaId: currentFarmaciaId,
          clienteId: client?.id,
          usuarioId: currentUsuarioId,
          tipo_comprobante: tipoComp,
          serie,
          numero,
          subtotal: subtotalAfterDiscount,
          igv,
          total,
          puntosCanjeados: appliedPoints,
          descuentoPuntos: discountFromPoints,
          forma_pago: metodoPago,
          montoRecibido: parsedMontoRecibido,
          vuelto: metodoPago === 'Efectivo' ? parsedMontoRecibido - total : 0,
          tipo_documento_cliente: client ? tipoDocClienteMap[client.tipoDoc] : null,
          numero_documento_cliente: client?.numeroDoc,
          nombre_razon_social: client?.nombreRazon,
          direccion_cliente: clienteDireccion,
          estado_sunat: estadoSunat,
        },
      });
      for (const item of processedItems) {
        if (item.type === 'PROMO') {
          for (const pi of item.promoItems) {
            const qty = pi.cantidad * item.quantity;
            const lineTotal = parseFloat(pi.producto.precioVenta) * qty;
            const lineSubtotal = lineTotal / (1 + igvRate);
            const lineIgv = lineTotal - lineSubtotal;
            await tx.comprobanteitem.create({
              data: {
                comprobanteId: newComprobante.id,
                productoId: pi.producto.id,
                codigo_producto: pi.producto.codigoBarras || 'PROMO',
                descripcion: pi.producto.nombre,
                cantidad: qty,
                precio_unitario: parseFloat(pi.producto.precioVenta) / (1 + igvRate),
                subtotal: lineSubtotal,
                igv: lineIgv,
                total: lineTotal,
              },
            });
            await tx.producto.update({
              where: { id: pi.producto.id },
              data: { stockActual: { decrement: qty } },
            });
          }
          const totalDescuento = item.descuentoPromo * item.quantity;
          if (totalDescuento > 0) {
            const discSubtotal = totalDescuento / (1 + igvRate);
            const discIgv = totalDescuento - discSubtotal;
            await tx.comprobanteitem.create({
              data: {
                comprobanteId: newComprobante.id,
                productoId: null,
                codigo_producto: 'DESC-PROMO',
                descripcion: `Descuento Promocional (${item.promoNombre})`,
                cantidad: item.quantity,
                precio_unitario: -(item.descuentoPromo / (1 + igvRate)),
                subtotal: -discSubtotal,
                igv: -discIgv,
                total: -totalDescuento,
              },
            });
          }
        } else {
          const itemTotal = item.precioUnitario * item.quantity;
          const itemSubtotal = itemTotal / (1 + igvRate);
          const itemIgv = itemTotal - itemSubtotal;

          await tx.comprobanteitem.create({
            data: {
              comprobanteId: newComprobante.id,
              productoId: item.type === 'PRODUCT' ? item.dbId : null,
              servicioId: item.type === 'SERVICE' ? item.dbId : null,
              codigo_producto: item.codigo,
              descripcion: item.nombre,
              cantidad: item.quantity,
              precio_unitario: item.precioUnitario / (1 + igvRate),
              subtotal: itemSubtotal,
              igv: itemIgv,
              total: itemTotal,
            },
          });

          if (item.type === 'PRODUCT') {
            await tx.producto.update({
              where: { id: item.dbId },
              data: { stockActual: { decrement: item.quantity } },
            });
          }
        }
      }

      if (client) {
        let updatedPoints = client.puntosAcumulados;
        if (appliedPoints > 0) {
          updatedPoints -= appliedPoints;
        }
        if (loyaltyEnabled && appliedPoints === 0) {
          const earnedPoints = Math.floor(subtotalAfterDiscount / solesPorPunto);
          updatedPoints += earnedPoints;
        }
        await tx.cliente.update({
          where: { id: client.id },
          data: { puntosAcumulados: Math.max(0, updatedPoints) },
        });

        // Automatización de Recetas Habituales
        for (const item of processedItems) {
          const prodId = item.type === 'PRODUCT' ? Number(item.dbId || item.productId) : null;
          const servId = item.type === 'SERVICE' ? Number(item.dbId || item.productId) : null;

          if ((prodId && !isNaN(prodId)) || (servId && !isNaN(servId))) {
            const totalPurchases = await tx.comprobanteitem.count({
              where: {
                comprobante: { clienteId: client.id },
                productoId: prodId || undefined,
                servicioId: servId || undefined,
              }
            });

            if (totalPurchases >= 3) {
              const existingHabitual = await tx.recetahabitual.findFirst({
                where: {
                  clienteId: client.id,
                  productoId: prodId || null,
                  servicioId: servId || null,
                }
              });

              if (!existingHabitual) {
                await tx.recetahabitual.create({
                  data: {
                    clienteId: client.id,
                    productoId: prodId || null,
                    servicioId: servId || null,
                    cantidad: item.quantity || 1,
                    notas: 'Auto-marcado por sistema (recurrencia >= 3 compras)'
                  }
                });
              }
            }
          }
        }
      }

      return await tx.comprobante.findUnique({
        where: { id: newComprobante.id },
        include: { comprobanteitem: true }
      });
    });

    const fullComprobante = {
      ...result,
      items: result.comprobanteitem
    };

    res.status(201).json({ message: 'Venta completada con éxito', comprobante: fullComprobante });
    logAudit({
      farmaciaId: currentFarmaciaId,
      usuarioId: currentUsuarioId,
      accion: 'CREAR',
      modulo: 'VENTAS',
      descripcion: `Venta registrada: ${result.tipo_comprobante} ${result.serie}-${result.numero} por S/ ${result.total}`,
      detalles: { comprobanteId: result.id, total: result.total }
    });

  } catch (error) {
    console.error('Error procesando la venta:', error);
    res.status(500).json({ error: 'Error procesando la venta', details: error.message });
  }
});

// POST /api/sales/return/:id - Procesar devolución (parcial o total)
router.post('/return/:id', async (req, res) => {
  console.log('RUTA DE DEVOLUCIÓN LLAMADA - ID:', req.params.id);
  const { id } = req.params;
  const { items, motivo } = req.body;
  const currentFarmaciaId = req.farmaciaId;
  const currentUsuarioId = req.userId;
  const currentUserRole = req.userRole;

  // Validaciones básicas
  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'Debe seleccionar al menos un producto para devolver' });
  }

  if (!motivo || motivo.trim().length === 0) {
    return res.status(400).json({ error: 'El motivo es obligatorio' });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Buscar comprobante con sus items
      const comprobante = await tx.comprobante.findUnique({
        where: { id: parseInt(id), farmaciaId: currentFarmaciaId },
        include: { comprobanteitem: true },
      });

      if (!comprobante) {
        throw new Error('Comprobante no encontrado o no pertenece a esta farmacia.');
      }

      // Si es vendedor, verificar que la venta sea de las últimas 24 horas
      if (currentUserRole === 'VENDEDOR') {
        const ventaFecha = new Date(comprobante.fecha_emision);
        const hace24Horas = new Date(Date.now() - 24 * 60 * 60 * 1000);
        if (ventaFecha < hace24Horas) {
          throw new Error('No puedes hacer devoluciones de ventas con más de 24 horas de antigüedad. Contacta al administrador.');
        }
      }

      if (comprobante.estado_sunat === 'ANULADO') {
        throw new Error('No se pueden hacer devoluciones de comprobantes anulados.');
      }

      // Verificar si ya existe una devolución para este comprobante
      const devolucionExistente = await tx.devolucion.findFirst({
        where: { comprobanteId: comprobante.id }
      });

      if (devolucionExistente) {
        throw new Error('Ya se realizó una devolución para este comprobante. No se permiten devoluciones múltiples.');
      }

      // 2. Validar que los productos pertenecen al comprobante y las cantidades
      let totalDevuelto = 0;
      const itemsToReturn = [];

      for (const returnItem of items) {
        const isService = returnItem.type === 'SERVICE';
        const targetId = returnItem.productId;

        const comprobanteItem = comprobante.comprobanteitem.find(
          ci => (isService ? ci.servicioId === targetId : ci.productoId === targetId)
        );

        if (!comprobanteItem) {
          throw new Error(`El ${isService ? 'servicio' : 'producto'} con ID ${targetId} no pertenece a este comprobante`);
        }

        if (returnItem.cantidad > comprobanteItem.cantidad || returnItem.cantidad <= 0) {
          throw new Error(`Cantidad inválida para ${isService ? 'servicio' : 'producto'} ${targetId}`);
        }

        const subtotal = parseFloat(comprobanteItem.precio_unitario) * returnItem.cantidad;
        totalDevuelto += subtotal;

        itemsToReturn.push({
          productoId: isService ? null : targetId,
          servicioId: isService ? targetId : null,
          cantidad: returnItem.cantidad,
          precioUnitario: comprobanteItem.precio_unitario,
          subtotal: subtotal,
          isService: isService
        });
      }

      // 3. Crear registro de devolución
      const devolucion = await tx.devolucion.create({
        data: {
          comprobanteId: comprobante.id,
          farmaciaId: currentFarmaciaId,
          usuarioId: currentUsuarioId,
          motivo: motivo.trim(),
          totalDevuelto: totalDevuelto,
        },
      });

      // 4. Crear items de devolución y devolver stock
      for (const item of itemsToReturn) {
        await tx.devolucionitem.create({
          data: {
            devolucionId: devolucion.id,
            productoId: item.productoId,
            servicioId: item.servicioId,
            cantidad: item.cantidad,
            precioUnitario: item.precioUnitario,
            subtotal: item.subtotal,
          },
        });

        // Devolver stock al inventario SOLO SI ES PRODUCTO
        if (!item.isService && item.productoId) {
          await tx.producto.update({
            where: { id: item.productoId },
            data: { stockActual: { increment: item.cantidad } },
          });
        }
      }

      return {
        devolucion,
        itemsDevueltos: itemsToReturn.length,
        totalDevuelto,
      };
    });

    res.status(201).json({
      success: true,
      message: 'Devolución procesada exitosamente',
      devolucion: result,
    });
    logAudit({
      farmaciaId: currentFarmaciaId,
      usuarioId: currentUsuarioId,
      accion: 'DEVOLUCION',
      modulo: 'VENTAS',
      descripcion: `Devolución procesada para comprobante #${id}. Motivo: ${motivo || 'No especificado'}`,
      detalles: { comprobanteId: parseInt(id), motivo }
    });

  } catch (error) {
    console.error('Error procesando devolución:', error);
    res.status(500).json({ error: 'Error procesando devolución', details: error.message });
  }
});

// DELETE /api/sales/:id - Anula un comprobante
// Solo ADMIN puede anular
router.delete('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { password } = req.body;
  const currentFarmaciaId = req.farmaciaId;
  const currentUsuarioId = req.userId;

  // Validar contraseña de administrador desde variable de entorno
  const ADMIN_PASSWORD = process.env.ADMIN_MASTER_PASSWORD;

  if (!ADMIN_PASSWORD) {
    console.error('[CRITICAL] ADMIN_MASTER_PASSWORD no configurado');
    return res.status(500).json({ error: 'Error de configuración del servidor' });
  }

  if (password !== ADMIN_PASSWORD) {
    return res.status(403).json({ error: 'Contraseña incorrecta' });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const comprobante = await tx.comprobante.findUnique({
        where: { id: parseInt(id), farmaciaId: currentFarmaciaId },
        include: { comprobanteitem: true },
      });

      if (!comprobante) {
        throw new Error('Comprobante no encontrado o no pertenece a esta farmacia.');
      }

      if (comprobante.estado_sunat === 'ANULADO') {
        throw new Error('Este comprobante ya ha sido anulado.');
      }

      // Revert stock for each item
      for (const item of comprobante.comprobanteitem) {
        if (item.productoId) {
          await tx.producto.update({
            where: { id: item.productoId },
            data: { stockActual: { increment: item.cantidad } },
          });
        }
      }

      // Mark comprobante as ANULADO
      const updatedComprobante = await tx.comprobante.update({
        where: { id: parseInt(id) },
        data: { estado_sunat: 'ANULADO' },
      });

      return updatedComprobante;
    });

    res.json({ message: 'Comprobante anulado con éxito', comprobante: result });
    logAudit({
      farmaciaId: currentFarmaciaId,
      usuarioId: currentUsuarioId,
      accion: 'ANULAR',
      modulo: 'VENTAS',
      descripcion: `Comprobante #${id} anulado y stock revertido`,
      detalles: { comprobanteId: parseInt(id) }
    });

  } catch (error) {
    console.error('Error anulando el comprobante:', error);
    res.status(500).json({ error: 'Error anulando el comprobante', details: error.message });
  }
});

// DELETE permanente (solo comprobantes anulados)
// Solo ADMIN puede eliminar permanentemente
router.delete('/:id/permanent', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const currentFarmaciaId = req.farmaciaId;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const comprobante = await tx.comprobante.findUnique({
        where: { id: parseInt(id), farmaciaId: currentFarmaciaId },
      });

      if (!comprobante) {
        throw new Error('Comprobante no encontrado o no pertenece a esta farmacia.');
      }

      if (comprobante.estado_sunat !== 'ANULADO') {
        throw new Error('Solo puedes eliminar permanentemente comprobantes que estén ANULADOS.');
      }

      await tx.comprobante.delete({
        where: { id: comprobante.id },
      });

      return comprobante;
    });

    res.json({ message: 'Comprobante eliminado permanentemente', comprobante: result });
  } catch (error) {
    console.error('Error eliminando el comprobante:', error);
    res.status(500).json({ error: 'No se pudo eliminar el comprobante', details: error.message });
  }
});

console.log('Rutas de Sales registradas:');
console.log('  - GET /');
console.log('  - POST /suggestions');
console.log('  - POST /');
console.log('  - POST /return/:id');
console.log('  - DELETE /:id (solo ADMIN)');
console.log('  - DELETE /:id/permanent (solo ADMIN)');

module.exports = router;

const router = require('express').Router();
const prisma = require('../lib/prisma');

// GET /dashboard/stats?farmaciaId=1&desde=2026-01-01&hasta=2026-12-31
router.get('/stats', async (req, res) => {
  try {
    const farmaciaId = Number(req.query.farmaciaId);
    if (!farmaciaId) return res.status(400).json({ error: 'farmaciaId requerido' });

    const desde = req.query.desde ? new Date(req.query.desde) : (() => { const d = new Date(); d.setDate(d.getDate() - 30); d.setHours(0,0,0,0); return d; })();
    const hasta = req.query.hasta ? (() => { const d = new Date(req.query.hasta); d.setHours(23,59,59,999); return d; })() : new Date();

    // --- KPIs Filtrados por Periodo ---
    const [totalProductos, productosStockBajo, totalClientes, periodVentasAgg] = await Promise.all([
      prisma.producto.count({ where: { farmaciaId } }),
      prisma.producto.count({ where: { farmaciaId, stockActual: { lte: 5 } } }),
      prisma.cliente.count({ where: { farmaciaId } }),
      prisma.comprobante.aggregate({
        where: { 
          farmaciaId, 
          fecha_emision: { gte: desde, lte: hasta },
          estado_sunat: { not: 'ANULADO' } 
        },
        _count: true,
        _sum: { total: true },
      }),
    ]);

    const totalVentasPeriodo = periodVentasAgg._count || 0;
    const totalRevenue = Number(periodVentasAgg._sum.total || 0);

    // --- Ventas detalladas (todas las ventas individuales) ---
    const ventas = await prisma.comprobante.findMany({
      where: { farmaciaId, fecha_emision: { gte: desde, lte: hasta }, estado_sunat: { not: 'ANULADO' } },
      select: { 
        id: true,
        fecha_emision: true, 
        total: true,
        serie: true,
        numero: true,
        forma_pago: true,
        cliente: { select: { nombreRazon: true } }
      },
      orderBy: { fecha_emision: 'asc' },
    });

    const ventasDiarias = ventas.map(v => ({
      id: v.id,
      fecha: v.fecha_emision.toISOString(),
      total: Number(v.total),
      comprobante: `${v.serie}-${v.numero}`,
      metodo: v.forma_pago || 'Efectivo',
      cliente: v.cliente?.nombreRazon || 'Público General'
    }));

    // --- Ventas por Metodo de Pago ---
    const ventasPorMetodo = await prisma.comprobante.groupBy({
      by: ['forma_pago'],
      where: { farmaciaId, fecha_emision: { gte: desde, lte: hasta }, estado_sunat: { not: 'ANULADO' } },
      _count: true,
      _sum: { total: true },
    });

    // --- Top productos más vendidos (All time) ---
    const topProductos = await prisma.comprobanteitem.groupBy({
      by: ['productoId'],
      where: {
        productoId: { not: null },
        comprobante: { 
          farmaciaId, 
          fecha_emision: { gte: desde, lte: hasta },
          estado_sunat: { not: 'ANULADO' } 
        },
      },
      _sum: { cantidad: true },
      orderBy: { _sum: { cantidad: 'desc' } },
      take: 10,
    });

    const topProductoIds = topProductos.map(t => t.productoId).filter(Boolean);
    const productosInfo = topProductoIds.length > 0
      ? await prisma.producto.findMany({ where: { id: { in: topProductoIds } }, select: { id: true, nombre: true, codigoBarras: true } })
      : [];
    const prodMap = Object.fromEntries(productosInfo.map(p => [p.id, p]));

    const topProductosData = topProductos.map(t => ({
      nombre: prodMap[t.productoId]?.nombre || `ID ${t.productoId}`,
      cantidad: t._sum.cantidad,
    }));

    // --- Productos próximos a vencer (30 días) ---
    const enTreintaDias = new Date();
    enTreintaDias.setDate(enTreintaDias.getDate() + 30);
    const proximosVencer = await prisma.producto.findMany({
      where: {
        farmaciaId,
        fechaVencimiento: { not: null, lte: enTreintaDias },
        stockActual: { gt: 0 },
      },
      select: { id: true, nombre: true, codigoBarras: true, fechaVencimiento: true, stockActual: true },
      orderBy: { fechaVencimiento: 'asc' },
      take: 10,
    });

    // --- Productos con stock bajo ---
    const stockBajo = await prisma.producto.findMany({
      where: {
        farmaciaId,
        stockActual: { lte: 5 },
      },
      select: { id: true, nombre: true, codigoBarras: true, stockActual: true, stockMinimo: true },
      orderBy: { stockActual: 'asc' },
      take: 10,
    });

    // --- Clientes más frecuentes (All time) ---
    const topClientes = await prisma.comprobante.groupBy({
      by: ['clienteId'],
      where: {
        farmaciaId,
        clienteId: { not: null },
        fecha_emision: { gte: desde, lte: hasta },
        estado_sunat: { not: 'ANULADO' },
      },
      _count: true,
      _sum: { total: true },
      orderBy: { _count: { clienteId: 'desc' } },
      take: 5,
    });

    const clienteIds = topClientes.map(c => c.clienteId).filter(Boolean);
    const clientesInfo = clienteIds.length > 0
      ? await prisma.cliente.findMany({ where: { id: { in: clienteIds } }, select: { id: true, nombreRazon: true, numeroDoc: true } })
      : [];
    const clienteMap = Object.fromEntries(clientesInfo.map(c => [c.id, c]));

    const topClientesData = topClientes.map(c => ({
      nombre: clienteMap[c.clienteId]?.nombreRazon || 'Sin nombre',
      doc: clienteMap[c.clienteId]?.numeroDoc || '',
      compras: c._count,
      total: Number(c._sum.total || 0),
    }));

    // --- Ventas hoy ---
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const manana = new Date(hoy);
    manana.setDate(manana.getDate() + 1);

    const ventasHoyAgg = await prisma.comprobante.aggregate({
      where: { farmaciaId, fecha_emision: { gte: hoy, lt: manana }, estado_sunat: { not: 'ANULADO' } },
      _sum: { total: true },
      _count: true,
    });

    return res.json({
      kpis: {
        totalProductos,
        productosStockBajo,
        totalClientes,
        totalVentasPeriodo,
        totalRevenue,
        ventasHoy: Number(ventasHoyAgg._sum.total || 0),
        ventasHoyCount: ventasHoyAgg._count || 0,
      },
      ventasDiarias,
      ventasPorMetodo: ventasPorMetodo.map(v => ({
        metodo: v.forma_pago || 'Desconocido',
        cantidad: v._count,
        total: Number(v._sum.total || 0),
      })),
      topProductos: topProductosData,
      proximosVencer,
      stockBajo,
      topClientes: topClientesData,
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    return res.status(500).json({ error: 'Error al generar estadísticas del dashboard' });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { requireAdmin } = require('../middleware/auth');

// SECURITY: farmaciaId y usuarioId vienen del middleware authenticate (JWT verificado)
// NO usar req.headers ya que pueden ser suplantados
// El middleware authenticate en index.js es responsable de validar y establecer estos valores

// ========== CATEGORÍAS DE SERVICIOS ==========

// GET /categorias - Listar categorías
router.get('/categorias', async (req, res) => {
    const currentFarmaciaId = parseInt(req.farmaciaId);
    try {
        const categorias = await prisma.categoriaservicio.findMany({
            where: { farmaciaId: currentFarmaciaId, activo: true },
            include: {
                _count: {
                    select: { servicios: true }
                }
            },
            orderBy: { nombre: 'asc' }
        });
        res.json(categorias);
    } catch (error) {
        console.error('Error fetching categorías:', error);
        res.status(500).json({ error: 'Error fetching categorías' });
    }
});

// POST /categorias - Crear categoría
router.post('/categorias', async (req, res) => {
    const currentFarmaciaId = parseInt(req.farmaciaId);
    const { nombre, icono } = req.body;

    try {
        const categoria = await prisma.categoriaservicio.create({
            data: {
                nombre,
                icono: icono || 'Stethoscope',
                farmaciaId: currentFarmaciaId
            }
        });
        res.json(categoria);
    } catch (error) {
        console.error('Error creating categoría:', error);
        res.status(500).json({ error: 'Error creating categoría' });
    }
});

// PUT /categorias/:id - Actualizar categoría
router.put('/categorias/:id', async (req, res) => {
    const { id } = req.params;
    const { nombre, icono } = req.body;
    const currentFarmaciaId = parseInt(req.farmaciaId);

    try {
        // CRÍTICO: Validar que la categoría pertenezca a esta farmacia
        const existing = await prisma.categoriaservicio.findUnique({ where: { id: parseInt(id) } });
        if (!existing || existing.farmaciaId !== currentFarmaciaId) {
            return res.status(404).json({ error: 'Categoría no encontrada' });
        }

        const categoria = await prisma.categoriaservicio.update({
            where: { id: parseInt(id) },
            data: { nombre, icono }
        });
        res.json(categoria);
    } catch (error) {
        console.error('Error updating categoría:', error);
        res.status(500).json({ error: 'Error updating categoría' });
    }
});

// DELETE /categorias/:id - Eliminar categoría
router.delete('/categorias/:id', async (req, res) => {
    const { id } = req.params;
    const currentFarmaciaId = parseInt(req.farmaciaId);

    try {
        // CRÍTICO: Validar que la categoría pertenezca a esta farmacia
        const existing = await prisma.categoriaservicio.findUnique({ where: { id: parseInt(id) } });
        if (!existing || existing.farmaciaId !== currentFarmaciaId) {
            return res.status(404).json({ error: 'Categoría no encontrada' });
        }

        await prisma.categoriaservicio.update({
            where: { id: parseInt(id) },
            data: { activo: false }
        });
        res.json({ message: 'Categoría eliminada' });
    } catch (error) {
        console.error('Error deleting categoría:', error);
        res.status(500).json({ error: 'Error deleting categoría' });
    }
});

// ========== SERVICIOS ==========

// GET / - Listar servicios
// ?farmaciaId= : solo ADMIN puede pedir explicitamente los servicios de OTRA
// farmacia (se usa para previsualizar antes de importar); cualquier otro rol
// siempre ve solo los suyos, sin excepcion.
router.get('/', async (req, res) => {
    const { categoriaId, activo, farmaciaId: queryFarmaciaId } = req.query;
    const currentFarmaciaId = (req.userRole === 'ADMIN' && queryFarmaciaId)
        ? parseInt(queryFarmaciaId)
        : parseInt(req.farmaciaId);

    try {
        const where = { farmaciaId: currentFarmaciaId };
        if (categoriaId) where.categoriaId = parseInt(categoriaId);
        if (activo !== undefined) where.activo = activo === 'true';

        const servicios = await prisma.servicio.findMany({
            where,
            include: {
                categoria: true
            },
            orderBy: { nombre: 'asc' }
        });
        res.json(servicios);
    } catch (error) {
        console.error('Error fetching servicios:', error);
        res.status(500).json({ error: 'Error fetching servicios' });
    }
});

// GET /:id - Obtener servicio por ID
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    const currentFarmaciaId = parseInt(req.farmaciaId);

    try {
        const servicio = await prisma.servicio.findUnique({
            where: { id: parseInt(id) },
            include: { categoria: true }
        });
        if (!servicio || servicio.farmaciaId !== currentFarmaciaId) {
            return res.status(404).json({ error: 'Servicio no encontrado' });
        }
        res.json(servicio);
    } catch (error) {
        console.error('Error fetching servicio:', error);
        res.status(500).json({ error: 'Error fetching servicio' });
    }
});

// POST / - Crear servicio
router.post('/', async (req, res) => {
    const currentFarmaciaId = parseInt(req.farmaciaId);
    const {
        nombre,
        codigoSunat,
        categoriaId,
        proveedorTipo,
        proveedorNombre,
        costoInterno,
        costoExterno,
        precioVenta
    } = req.body;

    try {
        // CRÍTICO: La categoría debe pertenecer a esta farmacia
        const categoria = await prisma.categoriaservicio.findUnique({ where: { id: parseInt(categoriaId) } });
        if (!categoria || categoria.farmaciaId !== currentFarmaciaId) {
            return res.status(400).json({ error: 'La categoría no pertenece a esta farmacia' });
        }

        // Calcular costoTotal y utilidad
        const costoTotalCalc = parseFloat(costoInterno || 0) + parseFloat(costoExterno || 0);
        const utilidadCalc = parseFloat(precioVenta) - costoTotalCalc;

        const servicio = await prisma.servicio.create({
            data: {
                nombre,
                codigoSunat,
                categoriaId: parseInt(categoriaId),
                proveedorTipo: proveedorTipo || 'INTERNO',
                proveedorNombre,
                costoInterno: parseFloat(costoInterno || 0),
                costoExterno: parseFloat(costoExterno || 0),
                costoTotal: costoTotalCalc,
                precioVenta: parseFloat(precioVenta),
                utilidad: utilidadCalc,
                farmaciaId: currentFarmaciaId
            },
            include: { categoria: true }
        });

        res.json(servicio);
    } catch (error) {
        console.error('Error creating servicio:', error);
        res.status(500).json({ error: 'Error creating servicio' });
    }
});

// PUT /:id - Actualizar servicio
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const currentFarmaciaId = parseInt(req.farmaciaId);
    const {
        nombre,
        codigoSunat,
        categoriaId,
        proveedorTipo,
        proveedorNombre,
        costoInterno,
        costoExterno,
        precioVenta
    } = req.body;

    try {
        // CRÍTICO: Validar que el servicio pertenezca a esta farmacia
        const existing = await prisma.servicio.findUnique({ where: { id: parseInt(id) } });
        if (!existing || existing.farmaciaId !== currentFarmaciaId) {
            return res.status(404).json({ error: 'Servicio no encontrado' });
        }

        // Si se cambia la categoría, validar que también pertenezca a esta farmacia
        if (categoriaId !== undefined) {
            const categoria = await prisma.categoriaservicio.findUnique({ where: { id: parseInt(categoriaId) } });
            if (!categoria || categoria.farmaciaId !== currentFarmaciaId) {
                return res.status(400).json({ error: 'La categoría no pertenece a esta farmacia' });
            }
        }

        // Calcular costoTotal y utilidad
        const costoTotalCalc = parseFloat(costoInterno || 0) + parseFloat(costoExterno || 0);
        const utilidadCalc = parseFloat(precioVenta) - costoTotalCalc;

        const servicio = await prisma.servicio.update({
            where: { id: parseInt(id) },
            data: {
                nombre,
                codigoSunat,
                categoriaId: parseInt(categoriaId),
                proveedorTipo,
                proveedorNombre,
                costoInterno: parseFloat(costoInterno || 0),
                costoExterno: parseFloat(costoExterno || 0),
                costoTotal: costoTotalCalc,
                precioVenta: parseFloat(precioVenta),
                utilidad: utilidadCalc
            },
            include: { categoria: true }
        });

        res.json(servicio);
    } catch (error) {
        console.error('Error updating servicio:', error);
        res.status(500).json({ error: 'Error updating servicio' });
    }
});

// DELETE /:id - Eliminar servicio
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    const currentFarmaciaId = parseInt(req.farmaciaId);

    try {
        // CRÍTICO: Validar que el servicio pertenezca a esta farmacia
        const existing = await prisma.servicio.findUnique({ where: { id: parseInt(id) } });
        if (!existing || existing.farmaciaId !== currentFarmaciaId) {
            return res.status(404).json({ error: 'Servicio no encontrado' });
        }

        await prisma.servicio.update({
            where: { id: parseInt(id) },
            data: { activo: false }
        });
        res.json({ message: 'Servicio eliminado' });
    } catch (error) {
        console.error('Error deleting servicio:', error);
        res.status(500).json({ error: 'Error deleting servicio' });
    }
});

// POST /importar - Copiar servicios de OTRA farmacia hacia la farmacia actual (solo ADMIN)
// Crea las categorías destino que falten (buscando por nombre) y evita duplicar
// servicios que ya existan en la farmacia actual con el mismo nombre.
router.post('/importar', requireAdmin, async (req, res) => {
    const currentFarmaciaId = parseInt(req.farmaciaId);
    const { farmaciaOrigenId, servicioIds } = req.body || {};
    const origenId = parseInt(farmaciaOrigenId);

    if (!Number.isFinite(origenId)) {
        return res.status(400).json({ error: 'Debes indicar la farmacia de origen' });
    }
    if (origenId === currentFarmaciaId) {
        return res.status(400).json({ error: 'La farmacia de origen no puede ser la misma que la actual' });
    }

    try {
        const origen = await prisma.farmacia.findUnique({ where: { id: origenId } });
        if (!origen) return res.status(404).json({ error: 'Farmacia de origen no encontrada' });

        const where = { farmaciaId: origenId, activo: true };
        if (Array.isArray(servicioIds) && servicioIds.length > 0) {
            where.id = { in: servicioIds.map(Number) };
        }

        const serviciosOrigen = await prisma.servicio.findMany({
            where,
            include: { categoria: true },
        });

        if (serviciosOrigen.length === 0) {
            return res.status(400).json({ error: 'No hay servicios para importar' });
        }

        const categoriasDestino = await prisma.categoriaservicio.findMany({ where: { farmaciaId: currentFarmaciaId } });
        const categoriaCache = new Map(categoriasDestino.map(c => [c.nombre.trim().toLowerCase(), c]));

        const serviciosDestino = await prisma.servicio.findMany({
            where: { farmaciaId: currentFarmaciaId },
            select: { nombre: true },
        });
        const nombresExistentes = new Set(serviciosDestino.map(s => s.nombre.trim().toLowerCase()));

        let importados = 0;
        let omitidos = 0;
        let categoriasCreadas = 0;

        await prisma.$transaction(async (tx) => {
            for (const servicio of serviciosOrigen) {
                const nombreKey = servicio.nombre.trim().toLowerCase();
                if (nombresExistentes.has(nombreKey)) {
                    omitidos++;
                    continue;
                }

                const catNombreOrigen = servicio.categoria?.nombre || 'General';
                const catNombreKey = catNombreOrigen.trim().toLowerCase();
                let categoriaDestino = categoriaCache.get(catNombreKey);
                if (!categoriaDestino) {
                    categoriaDestino = await tx.categoriaservicio.create({
                        data: {
                            nombre: catNombreOrigen,
                            icono: servicio.categoria?.icono || 'Stethoscope',
                            farmaciaId: currentFarmaciaId,
                        },
                    });
                    categoriaCache.set(catNombreKey, categoriaDestino);
                    categoriasCreadas++;
                }

                await tx.servicio.create({
                    data: {
                        nombre: servicio.nombre,
                        codigoSunat: servicio.codigoSunat,
                        categoriaId: categoriaDestino.id,
                        proveedorTipo: servicio.proveedorTipo,
                        proveedorNombre: servicio.proveedorNombre,
                        costoInterno: servicio.costoInterno,
                        costoExterno: servicio.costoExterno,
                        costoTotal: servicio.costoTotal,
                        precioVenta: servicio.precioVenta,
                        utilidad: servicio.utilidad,
                        farmaciaId: currentFarmaciaId,
                    },
                });
                nombresExistentes.add(nombreKey);
                importados++;
            }
        });

        res.json({ importados, omitidos, categoriasCreadas, total: serviciosOrigen.length });
    } catch (error) {
        console.error('Error importing servicios:', error);
        res.status(500).json({ error: 'No se pudieron importar los servicios' });
    }
});

// GET /estadisticas - Estadísticas de rentabilidad
router.get('/estadisticas/rentabilidad', async (req, res) => {
    const currentFarmaciaId = parseInt(req.farmaciaId);

    try {
        const servicios = await prisma.servicio.findMany({
            where: { farmaciaId: currentFarmaciaId, activo: true },
            select: {
                costoTotal: true,
                precioVenta: true,
                utilidad: true
            }
        });

        const totalServicios = servicios.length;
        const utilidadTotal = servicios.reduce((sum, s) => sum + parseFloat(s.utilidad), 0);
        const utilidadPromedio = totalServicios > 0 ? utilidadTotal / totalServicios : 0;
        const serviciosRentables = servicios.filter(s => parseFloat(s.utilidad) > 0).length;

        res.json({
            totalServicios,
            utilidadTotal,
            utilidadPromedio,
            serviciosRentables,
            porcentajeRentables: totalServicios > 0 ? (serviciosRentables / totalServicios) * 100 : 0
        });
    } catch (error) {
        console.error('Error fetching estadísticas:', error);
        res.status(500).json({ error: 'Error fetching estadísticas' });
    }
});

module.exports = router;

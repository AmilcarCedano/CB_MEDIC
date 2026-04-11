const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');

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
        res.status(500).json({ error: 'Error fetching categorías', details: error.message });
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
        res.status(500).json({ error: 'Error creating categoría', details: error.message });
    }
});

// PUT /categorias/:id - Actualizar categoría
router.put('/categorias/:id', async (req, res) => {
    const { id } = req.params;
    const { nombre, icono } = req.body;

    try {
        const categoria = await prisma.categoriaservicio.update({
            where: { id: parseInt(id) },
            data: { nombre, icono }
        });
        res.json(categoria);
    } catch (error) {
        console.error('Error updating categoría:', error);
        res.status(500).json({ error: 'Error updating categoría', details: error.message });
    }
});

// DELETE /categorias/:id - Eliminar categoría
router.delete('/categorias/:id', async (req, res) => {
    const { id } = req.params;

    try {
        await prisma.categoriaservicio.update({
            where: { id: parseInt(id) },
            data: { activo: false }
        });
        res.json({ message: 'Categoría eliminada' });
    } catch (error) {
        console.error('Error deleting categoría:', error);
        res.status(500).json({ error: 'Error deleting categoría', details: error.message });
    }
});

// ========== SERVICIOS ==========

// GET / - Listar servicios
router.get('/', async (req, res) => {
    const currentFarmaciaId = parseInt(req.farmaciaId);
    const { categoriaId, activo } = req.query;

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
        res.status(500).json({ error: 'Error fetching servicios', details: error.message });
    }
});

// GET /:id - Obtener servicio por ID
router.get('/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const servicio = await prisma.servicio.findUnique({
            where: { id: parseInt(id) },
            include: { categoria: true }
        });
        res.json(servicio);
    } catch (error) {
        console.error('Error fetching servicio:', error);
        res.status(500).json({ error: 'Error fetching servicio', details: error.message });
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
        res.status(500).json({ error: 'Error creating servicio', details: error.message });
    }
});

// PUT /:id - Actualizar servicio
router.put('/:id', async (req, res) => {
    const { id } = req.params;
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
        res.status(500).json({ error: 'Error updating servicio', details: error.message });
    }
});

// DELETE /:id - Eliminar servicio
router.delete('/:id', async (req, res) => {
    const { id } = req.params;

    try {
        await prisma.servicio.update({
            where: { id: parseInt(id) },
            data: { activo: false }
        });
        res.json({ message: 'Servicio eliminado' });
    } catch (error) {
        console.error('Error deleting servicio:', error);
        res.status(500).json({ error: 'Error deleting servicio', details: error.message });
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
        res.status(500).json({ error: 'Error fetching estadísticas', details: error.message });
    }
});

module.exports = router;

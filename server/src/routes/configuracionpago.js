const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const prisma = require('../lib/prisma');

// Multer storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '../../uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'pago-' + req.body.metodo + '-' + uniqueSuffix + ext);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten imágenes'));
        }
    }
});

// GET configs
router.get('/', async (req, res) => {
    try {
        const farmaciaId = req.farmaciaId;  // Del JWT, no del header
        if (!farmaciaId) return res.status(400).json({ error: 'Farmacia no identificada' });

        const configs = await prisma.configuracionpago.findMany({
            where: { farmaciaId }
        });

        res.json(configs);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al obtener configuraciones' });
    }
});

// PUT config
router.put('/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { nombre, activo, imagenUrl, color, texto, zoom } = req.body;
        const farmaciaId = req.farmaciaId;  // Del JWT, no del header

        if (!farmaciaId) return res.status(400).json({ error: 'Farmacia no identificada' });
        
        // CRÍTICO: Validar que la configuración pertenezca a esta farmacia
        const config = await prisma.configuracionpago.findUnique({ where: { id } });
        if (!config || config.farmaciaId !== farmaciaId) {
          return res.status(403).json({ error: 'Acceso denegado. Configuración no válida para tu farmacia.' });
        }

        // Update model
        const updated = await prisma.configuracionpago.update({
            where: { id },
            data: { 
                nombre, 
                activo, 
                imagenUrl, 
                color,
                texto,
                zoom: zoom ? parseFloat(zoom) : 1
            }
        });

        res.json(updated);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al actualizar configuración' });
    }
});

// POST to create default if not exists (helpful initialization)
router.post('/init', async (req, res) => {
    try {
        const farmaciaId = req.farmaciaId;  // Del JWT, no del header
        if (!farmaciaId) return res.status(400).json({ error: 'Farmacia no identificada' });

        const methods = [
            { metodo: 'Tarjeta', nombre: 'Instrucciones TPV/Plin' },
            { metodo: 'Yape', nombre: 'QR de Yape 📱' },
            { metodo: 'Transferencia', nombre: 'Datos Bancarios 💰' }
        ];

        for (const m of methods) {
            await prisma.configuracionpago.upsert({
                where: { farmaciaId_metodo: { farmaciaId, metodo: m.metodo } },
                update: {},
                create: {
                    farmaciaId,
                    metodo: m.metodo,
                    nombre: m.nombre,
                    activo: true
                }
            });
        }

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al inicializar métodos' });
    }
});

// POST upload image
router.post('/upload', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No se subió ningún archivo' });
        }
        
        const fileUrl = `/uploads/${req.file.filename}`;
        
        return res.json({
            imageUrl: fileUrl
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Error al subir imagen' });
    }
});

// POST to create custom method
router.post('/', async (req, res) => {
    try {
        const farmaciaId = req.farmaciaId;  // Del JWT, no del header
        if (!farmaciaId) return res.status(400).json({ error: 'Farmacia no identificada' });

        const { metodo, nombre, color } = req.body;
        if (!metodo || !nombre) return res.status(400).json({ error: 'Faltan datos' });

        const created = await prisma.configuracionpago.create({
            data: {
                farmaciaId,
                metodo,
                nombre,
                color,
                activo: true
            }
        });

        res.json(created);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al crear método' });
    }
});

// DELETE config
router.delete('/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const farmaciaId = req.farmaciaId;  // Del JWT, no del header

        if (!farmaciaId) return res.status(400).json({ error: 'Farmacia no identificada' });

        await prisma.configuracionpago.delete({
            where: { id }
        });

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al eliminar configuración' });
    }
});

module.exports = router;

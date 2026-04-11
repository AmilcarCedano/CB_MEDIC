const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const prisma = require('../lib/prisma');

// Configure storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '../../uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Always save as 'logo.png' (or keep extension if needed, but simple overwrite is easier for consistency)
        // We'll use the original extension but simpler is just 'logo.png' if we enforce PNG, 
        // but better to keep extension or just force 'system-logo' + ext
        const ext = path.extname(file.originalname);
        cb(null, 'system-logo' + ext);
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

// Endpoint to upload logo
router.post('/logo', upload.single('logo'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No se subió ningún archivo' });
        }

        // Return the URL path to access the file
        // We'll serve 'uploads' directory as '/uploads'
        const fileUrl = `/uploads/${req.file.filename}`;

        // We could store this URL in DB Config table if we had one, but for now 
        // frontend can try to fetch it or we return it here.

        // Also consider deleting old logos if name changes, but here we iterate names.
        // Ideally we rename to 'logo.png' always to avoid accumulation, but browser cache is tricky.
        // Let's stick to returning the filename and frontend handles it.

        return res.json({
            message: 'Logo actualizado correctamente',
            logoUrl: fileUrl
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Error al subir el logo' });
    }
});

// Endpoint to get current logo info (optional, mainly if stored in DB)
router.get('/logo', (req, res) => {
    // Check if 'system-logo.png' or similar exists in uploads
    const uploadDir = path.join(__dirname, '../../uploads');
    // Try to find any file starting with system-logo
    try {
        const files = fs.readdirSync(uploadDir);
        const logoFile = files.find(f => f.startsWith('system-logo'));

        if (logoFile) {
            return res.json({ logoUrl: `/uploads/${logoFile}` });
        }
        return res.json({ logoUrl: null });
    } catch (e) {
        return res.json({ logoUrl: null });
    }
});

// --- POS Configuration ---

// Get POS config
router.get('/pos', async (req, res) => {
    const farmaciaId = req.farmaciaId;  // Del JWT, no del header
    if (!farmaciaId) return res.status(400).json({ error: 'Farmacia no identificada' });

    try {
        let config = await prisma.configuracionpos.findUnique({
            where: { farmaciaId }
        });

        // Initialize if not exists
        if (!config) {
            config = await prisma.configuracionpos.create({
                data: { farmaciaId }
            });
        }

        return res.json(config);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Error al obtener configuración POS' });
    }
});

// Update POS config
router.put('/pos', async (req, res) => {
    const farmaciaId = req.farmaciaId;  // Del JWT, no del header
    if (!farmaciaId) return res.status(400).json({ error: 'Farmacia no identificada' });

    const { igvPercent, autoDownloadTicket, margenVencimientoMeses } = req.body;

    try {
        const config = await prisma.configuracionpos.upsert({
            where: { farmaciaId },
            update: {
                igvPercent: igvPercent !== undefined ? parseFloat(igvPercent) : undefined,
                autoDownloadTicket: autoDownloadTicket !== undefined ? !!autoDownloadTicket : undefined,
                margenVencimientoMeses: margenVencimientoMeses !== undefined ? Number(margenVencimientoMeses) : undefined
            },
            create: {
                farmaciaId,
                igvPercent: igvPercent !== undefined ? parseFloat(igvPercent) : 18.00,
                autoDownloadTicket: autoDownloadTicket !== undefined ? !!autoDownloadTicket : true,
                margenVencimientoMeses: margenVencimientoMeses !== undefined ? Number(margenVencimientoMeses) : 3
            }
        });

        return res.json(config);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Error al guardar configuración POS' });
    }
});

module.exports = router;

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const { authenticate } = require('./middleware/auth');

const healthRouter = require('./routes/health');
const reniecRouter = require('./routes/reniec');
const authRouter = require('./routes/auth');
const cajaRouter = require('./routes/caja');
const farmaciasRouter = require('./routes/farmacias');
const categoriesRouter = require('./routes/categories');
const productsRouter = require('./routes/products');
const masterRouter = require('./routes/master');
const usersRouter = require('./routes/users');
const enviosRouter = require('./routes/envios');
// --- NUEVOS ROUTERS ---
const clientesRouter = require('./routes/clientes');
const ofertasRouter = require('./routes/ofertas');
const salesRouter = require('./routes/sales');
const serviciosRouter = require('./routes/servicios');
const comprobantesServiciosRouter = require('./routes/comprobantes-servicios');
const auditoriaRouter = require('./routes/auditoria');
const promocionesRouter = require('./routes/promociones');

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('dev'));

// Rutas públicas (no requieren autenticación)
app.use('/health', healthRouter);
app.use('/reniec', reniecRouter);
app.use('/auth', authRouter);

// Rutas protegidas (requieren autenticación JWT)
app.use('/caja', authenticate, cajaRouter);
app.use('/farmacias', authenticate, farmaciasRouter);
app.use('/categories', authenticate, categoriesRouter);
app.use('/products', authenticate, productsRouter);
app.use('/master', authenticate, masterRouter);
app.use('/users', authenticate, usersRouter);
app.use('/envios', authenticate, enviosRouter);
// --- USO DE NUEVOS ROUTERS ---
app.use('/clientes', authenticate, clientesRouter);
app.use('/ofertas', authenticate, ofertasRouter);
app.use('/sales', authenticate, salesRouter);
app.use('/servicios', authenticate, serviciosRouter);
app.use('/comprobantes-servicios', authenticate, comprobantesServiciosRouter);
// Nueva ruta de configuracion
const configRouter = require('./routes/config');
app.use('/config', authenticate, configRouter);

const configuracionPagoRouter = require('./routes/configuracionpago');
app.use('/configuracion-pago', authenticate, configuracionPagoRouter);
app.use('/auditoria', authenticate, auditoriaRouter);
app.use('/promociones', authenticate, promocionesRouter);
const dashboardRouter = require('./routes/dashboard');
app.use('/dashboard', authenticate, dashboardRouter);

// Servir archivos estáticos (uploads)
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

const PORT = 4000;
const server = app.listen(PORT, '0.0.0.0', () => console.log(`API escuchando en http://localhost:${PORT}`));

// Capturar errores no manejados para evitar cierres silenciosos
process.on('unhandledRejection', (reason, promise) => {
    console.error(' [FATAL] Rechazo no manejado en:', promise, 'razón:', reason);
    // No cerrar para permitir diagnóstico, pero en prod se debería reiniciar
});

process.on('uncaughtException', (err) => {
    console.error(' [FATAL] Excepción no capturada:', err);
    // En errores graves, podrías querer cerrar el servidor: process.exit(1)
});
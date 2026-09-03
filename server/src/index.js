const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const { authenticate } = require('./middleware/auth');
const { requestContext } = require('./lib/requestContext');
const { logError } = require('./lib/errorLog');

// Guarda en BD cualquier console.error del proyecto (todas las rutas ya usan este
// patrón en sus catch), para que sobreviva a que el contenedor se recree en cada
// deploy — docker logs empieza vacío en cada contenedor nuevo.
const originalConsoleError = console.error.bind(console);
console.error = (...args) => {
  originalConsoleError(...args);
  const errorArg = args.find((a) => a instanceof Error);
  const textoArgs = args.filter((a) => typeof a === 'string').join(' ');
  const mensaje = textoArgs || errorArg?.message || 'Error sin mensaje';
  logError(mensaje, errorArg?.stack).catch(() => {});
};

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
app.set('trust proxy', 1);

const DEFAULT_ORIGINS = ['https://cbmedic.duckdns.org', 'http://localhost:5173', 'http://localhost:5174', 'http://localhost:4173'];
const allowedOrigins = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
const origins = allowedOrigins.length ? allowedOrigins : DEFAULT_ORIGINS;
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);            // curl / same-origin / server-to-server
    if (origins.includes(origin)) return cb(null, true);
    return cb(null, false);                        // deny without throwing (no 500s)
  },
  credentials: true,
}));
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('dev'));

// Guarda método+ruta de la request actual para que errorLog.js sepa dónde ocurrió
// un error sin tener que pasarlo manualmente por cada catch del proyecto.
app.use((req, res, next) => {
  requestContext.run({ method: req.method, path: req.originalUrl }, next);
});

// Rate limiting
const rateLimit = require('express-rate-limit');
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Intenta nuevamente en unos instantes.' },
});
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de inicio de sesión. Intenta nuevamente en 15 minutos.' },
});
app.use(globalLimiter);
app.use('/auth/login', loginLimiter);

// Rutas públicas (no requieren autenticación)
app.use('/health', healthRouter);
app.use('/auth', authRouter);

// Rutas protegidas (requieren autenticación JWT)
app.use('/reniec', authenticate, reniecRouter);
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
const errorLogsRouter = require('./routes/error-logs');
app.use('/error-logs', authenticate, errorLogsRouter);
app.use('/promociones', authenticate, promocionesRouter);
const dashboardRouter = require('./routes/dashboard');
app.use('/dashboard', authenticate, dashboardRouter);

const whatsappSendRouter = require('./routes/whatsapp-send');
app.use('/whatsapp', authenticate, whatsappSendRouter);

// Descarga de tickets temporales — público (sin auth), token de 64 hex chars
const { router: ticketDownloadRouter } = require('./routes/ticket-download');
app.use('/ticket', ticketDownloadRouter);

// Servir archivos estáticos (uploads)
// Son imágenes públicas (logos, QRs de pago). Se exponen con CORS abierto para
// que el frontend pueda leerlas vía canvas (logo en PDFs con crossOrigin=anonymous)
// desde cualquier origen donde corra la app (dev cross-port, IP de LAN, dominio).
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, '../uploads'), {
    setHeaders: (res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    }
}));

// Red de seguridad: si una ruta deja pasar un error sin capturarlo (next(err) o
// throw sin try/catch), esto lo registra en vez de dejar la request colgada.
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

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
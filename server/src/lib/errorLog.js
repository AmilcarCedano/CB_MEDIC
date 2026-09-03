const prisma = require('./prisma');
const { requestContext } = require('./requestContext');

// Persiste errores técnicos en BD. A diferencia de docker logs, esto sobrevive
// a que el contenedor se recree en cada deploy, así que es lo único confiable
// para revisar errores intermitentes que ocurrieron entre una sesión y otra.
//
// IMPORTANTE: nunca usar console.error acá dentro — console.error está parcheado
// en index.js para llamar a logError, y hacerlo entraría en loop infinito si la
// propia escritura a BD fallara.
const logError = async (mensaje, stack) => {
  try {
    await prisma.errorlog.create({
      data: {
        mensaje: String(mensaje ?? 'Error sin mensaje').slice(0, 5000),
        stack: stack ? String(stack).slice(0, 5000) : null,
        ruta: requestContext.getStore()?.path?.slice(0, 255) || null,
        metodo: requestContext.getStore()?.method || null,
      },
    });
  } catch (e) {
    process.stderr.write(`[errorLog] no se pudo guardar en BD: ${e.message}\n`);
  }
};

module.exports = { logError };

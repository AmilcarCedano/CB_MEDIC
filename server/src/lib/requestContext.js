const { AsyncLocalStorage } = require('node:async_hooks');

// Permite que errorLog.js sepa en qué ruta/método ocurrió un error sin tener
// que pasar esa info manualmente por cada catch del proyecto.
const requestContext = new AsyncLocalStorage();

module.exports = { requestContext };

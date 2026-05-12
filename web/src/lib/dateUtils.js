/**
 * Utilidades para manejo seguro de fechas sin problemas de timezone.
 * 
 * Problema: `new Date("2027-01-01")` crea medianoche UTC.
 * En UTC-5 (Perú), eso se muestra como 31/12/2026 con toLocaleDateString().
 * 
 * Solución: Extraer la fecha directamente del string ISO sin pasar por Date.
 */

/**
 * Formatea una fecha ISO a DD/MM/YYYY sin conversión de timezone.
 * @param {string} isoStr - Fecha en formato ISO (ej: "2027-01-01T00:00:00.000Z")
 * @returns {string} Fecha formateada (ej: "01/01/2027") o "N/A"
 */
export function formatDateSafe(isoStr) {
  if (!isoStr) return 'N/A';
  const dateStr = typeof isoStr === 'string' ? isoStr : String(isoStr);
  const parts = dateStr.substring(0, 10).split('-');
  if (parts.length !== 3) return 'N/A';
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

/**
 * Extrae YYYY-MM-DD de un ISO string para usar en inputs type="date".
 * @param {string} isoStr - Fecha en formato ISO
 * @returns {string} Fecha en formato YYYY-MM-DD o ""
 */
export function toDateInputValue(isoStr) {
  if (!isoStr) return '';
  return typeof isoStr === 'string' ? isoStr.substring(0, 10) : '';
}

/**
 * Convierte una fecha YYYY-MM-DD del input a ISO con mediodía UTC
 * para evitar que el timezone la mueva al día anterior.
 * @param {string} dateStr - Fecha del input type="date" (YYYY-MM-DD)
 * @returns {string|null} ISO string con hora mediodía UTC, o null
 */
export function toNoonUTC(dateStr) {
  if (!dateStr) return null;
  return `${dateStr}T12:00:00.000Z`;
}

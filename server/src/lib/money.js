// Redondeo consistente a 2 decimales para todo cálculo monetario.
// Evita que sumas/restas de floats en JS (ej. 2.29/5 + 2.54) dejen
// céntimos residuales al comparar contra columnas Decimal(10,2) en MySQL.
function round2(value) {
  const n = Number(value) || 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

module.exports = { round2 };

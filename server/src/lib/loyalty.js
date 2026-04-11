const prisma = require('./prisma');

const DEFAULT_LOYALTY = {
  solesPorPunto: 10,
  valorPorPunto: 0.1,
  maxPuntosCanje: 0,
  activo: true,
};

const getLoyaltyConfig = async (farmaciaId) => {
  const fallback = {
    ...DEFAULT_LOYALTY,
    farmaciaId: Number.isFinite(farmaciaId) ? farmaciaId : null,
  };

  if (!Number.isFinite(farmaciaId) || !prisma.configuracionLealtad) {
    return fallback;
  }

  const config = await prisma.configuracionLealtad.findUnique({
    where: { farmaciaId },
  });

  if (!config) {
    return fallback;
  }

  return {
    farmaciaId: config.farmaciaId,
    solesPorPunto: parseFloat(config.solesPorPunto),
    valorPorPunto: parseFloat(config.valorPorPunto),
    maxPuntosCanje: parseInt(config.maxPuntosCanje || 0),
    activo: config.activo,
    updatedAt: config.updatedAt,
  };
};

module.exports = {
  DEFAULT_LOYALTY,
  getLoyaltyConfig,
};

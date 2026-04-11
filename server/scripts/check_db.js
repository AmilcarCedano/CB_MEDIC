const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function verifyDatabase() {
  const output = [];
  output.push('\n========== VERIFICACIÓN DE BASE DE DATOS ==========\n');

  try {
    const reglas = await prisma.reglaVentaCruzada.findMany({
      include: {
        triggerProducto: true,
        sugeridoProducto: true,
      },
    });
    output.push(`✅ Total de Reglas de Venta Cruzada (producto → producto): ${reglas.length}`);
    reglas.slice(0, 5).forEach((r, i) => {
      output.push(
        `   ${i + 1}. "${r.triggerProducto?.nombre || 'N/A'}" → "${r.sugeridoProducto?.nombre || 'N/A'}" | Prioridad ${r.prioridad}`
      );
    });

    const productosCount = await prisma.producto.count();
    const productosConPrincipioActivo = await prisma.producto.count({
      where: { principioActivo: { not: null } },
    });
    output.push(`\n✅ Total de Productos: ${productosCount}`);
    output.push(`✅ Productos con Principio Activo: ${productosConPrincipioActivo}`);

    const productosEjemplo = await prisma.producto.findMany({
      take: 5,
      select: {
        nombre: true,
        principioActivo: true,
        presentacion: true,
        stockActual: true,
      },
    });
    if (productosEjemplo.length) {
      output.push('\n📋 Productos registrados:');
      productosEjemplo.forEach((p) => {
        output.push(
          `   - ${p.nombre} (${p.presentacion || 'N/A'}) • Principio: ${p.principioActivo || 'N/A'} • Stock: ${p.stockActual}`
        );
      });
    }

    if (prisma.configuracionLealtad) {
      const loyalty = await prisma.configuracionLealtad.findMany();
      output.push(`\n✅ Configuraciones de Lealtad: ${loyalty.length}`);
      loyalty.forEach((c) => {
        output.push(
          `   - Farmacia ${c.farmaciaId}: 1 punto cada S/ ${parseFloat(c.solesPorPunto)} • Punto = S/ ${parseFloat(c.valorPorPunto)}`
        );
      });
    }

    output.push('\n✅ ¡Base de datos verificada exitosamente!\n');
  } catch (error) {
    console.error('❌ Error al verificar base de datos:', error.message);
    output.push(`❌ Error: ${error.message}`);
  } finally {
    await prisma.$disconnect();
  }

  const resultFile = 'db_verification_result.txt';
  fs.writeFileSync(resultFile, output.join('\n'));
  console.log(output.join('\n'));
  console.log(`\nResultados guardados en: ${resultFile}`);
}

verifyDatabase();

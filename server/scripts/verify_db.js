const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function verifyDatabase() {
  console.log('\n========== VERIFICACIÓN DE BASE DE DATOS ==========\n');

  try {
    const reglasCount = await prisma.reglaVentaCruzada.count();
    console.log(`✅ Total de Reglas de Venta Cruzada (producto → producto): ${reglasCount}`);

    if (reglasCount > 0) {
      const reglas = await prisma.reglaVentaCruzada.findMany({
        take: 5,
        include: {
          triggerProducto: true,
          sugeridoProducto: true,
        },
      });
      console.log('\n📋 Ejemplos de reglas:');
      reglas.forEach((r, i) => {
        console.log(
          `   ${i + 1}. Si agrega "${r.triggerProducto?.nombre || 'N/A'}" sugiere "${r.sugeridoProducto?.nombre || 'N/A'}" (Prioridad ${r.prioridad})`
        );
      });
    }

    const productosCount = await prisma.producto.count();
    const productosConPrincipioActivo = await prisma.producto.count({
      where: { principioActivo: { not: null } },
    });
    console.log(`\n✅ Total de Productos: ${productosCount}`);
    console.log(`✅ Productos con Principio Activo: ${productosConPrincipioActivo}`);

    if (productosCount > 0) {
      const productos = await prisma.producto.findMany({
        take: 5,
        select: {
          nombre: true,
          principioActivo: true,
          presentacion: true,
          stockActual: true,
        },
      });
      console.log('\n📋 Productos registrados:');
      productos.forEach((p) => {
        console.log(
          `   - ${p.nombre} (${p.presentacion || 'sin presentación'}) • Principio activo: ${p.principioActivo || 'N/A'} • Stock: ${p.stockActual}`
        );
      });
    }

    if (prisma.configuracionLealtad) {
      const loyalty = await prisma.configuracionLealtad.findMany({ take: 3 });
      console.log(`\n✅ Configuraciones de Lealtad registradas: ${loyalty.length}`);
      loyalty.forEach((c) => {
        console.log(
          `   - Farmacia ${c.farmaciaId}: S/ ${parseFloat(c.solesPorPunto)} para 1 punto • Cada punto vale S/ ${parseFloat(c.valorPorPunto)}`
        );
      });
    }

    console.log('\n✅ ¡Base de datos verificada exitosamente!\n');
  } catch (error) {
    console.error('❌ Error al verificar base de datos:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

verifyDatabase();

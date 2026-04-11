const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkHealth() {
    console.log('--- Health Check de Base de Datos ---');
    try {
        const farmaciaCount = await prisma.farmacia.count();
        const productoCount = await prisma.producto.count();
        const clienteCount = await prisma.cliente.count();
        const ventaCount = await prisma.comprobante.count();
        const configCount = await prisma.configuracionpos.count();

        console.log(`Farmacias: ${farmaciaCount}`);
        console.log(`Productos: ${productoCount}`);
        console.log(`Clientes: ${clienteCount}`);
        console.log(`VentasTotales: ${ventaCount}`);
        console.log(`Configuraciones: ${configCount}`);

        if (configCount === 0) {
            console.warn('⚠️ ADVERTENCIA: No hay configuración POS registrada. Se usarán valores por defecto (IGV 18%, No auto-descarga).');
        }

        // Verificar si hay ventas con ítems (integridad)
        const itemsCount = await prisma.comprobanteitem.count();
        console.log(`Items de venta: ${itemsCount}`);
        
        if (ventaCount > 0 && itemsCount === 0) {
            console.error('❌ ERROR CRÍTICO: Hay ventas registradas pero no tienen ítems.');
        } else {
            console.log('✅ Integridad de ventas: OK');
        }

    } catch (e) {
        console.error('❌ Error conectando a la base de datos:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}

checkHealth();

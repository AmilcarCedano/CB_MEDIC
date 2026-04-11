const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const f = await prisma.farmacia.findFirst();
        const p = await prisma.producto.findFirst({ where: { stockActual: { gt: 0 } } });
        console.log(JSON.stringify({ 
            farmaciaId: f ? f.id : null, 
            productId: p ? p.id : null, 
            stock: p ? p.stockActual : null 
        }));
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();

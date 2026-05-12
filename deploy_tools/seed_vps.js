const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  // Crear farmacia principal
  const farmacia = await prisma.farmacia.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, nombre: 'Farmacia Principal', isActive: true }
  });
  console.log('Farmacia creada:', farmacia.nombre);

  // Crear usuarios
  const adminHash = await bcrypt.hash('adminPass', 10);
  const vendHash = await bcrypt.hash('123', 10);

  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: { username: 'admin', fullName: 'Administrador', passwordHash: adminHash, role: 'ADMIN' }
  });

  await prisma.user.upsert({
    where: { username: 'vendedor' },
    update: {},
    create: { username: 'vendedor', fullName: 'Vendedor Demo', passwordHash: vendHash, role: 'VENDEDOR', farmaciaId: 1 }
  });

  console.log('Usuarios creados: admin / adminPass y vendedor / 123');
}

main().catch(console.error).finally(() => prisma.$disconnect());

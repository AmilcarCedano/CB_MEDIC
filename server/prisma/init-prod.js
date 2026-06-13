/**
 * Inicialización idempotente para producción.
 * Garantiza que exista el usuario administrador global SIN sobrescribir nada
 * si ya existe (preserva la contraseña que el usuario haya cambiado).
 *
 * Se ejecuta automáticamente en el arranque del contenedor (ver docker-entrypoint.sh),
 * después de `prisma db push`. No inserta datos de demo (farmacias/productos):
 * esos se crean desde la propia aplicación.
 */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.user.findUnique({ where: { username: 'admin' } });

  if (existing) {
    console.log('[init] Usuario admin ya existe — sin cambios (contraseña preservada).');
    return;
  }

  const passwordHash = await bcrypt.hash('adminPass', 10);
  await prisma.user.create({
    data: {
      username: 'admin',
      fullName: 'Administrador Global',
      passwordHash,
      role: 'ADMIN',
      isActive: true,
    },
  });

  console.log('[init] Usuario admin creado → usuario: admin / contraseña: adminPass');
  console.log('[init] IMPORTANTE: cambia esta contraseña inmediatamente tras el primer ingreso.');
}

main()
  .catch((err) => {
    console.error('[init] Error inicializando el usuario admin:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

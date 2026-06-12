// Script independiente: detecta usuarios con contraseña en texto plano (sin hash bcrypt).
// Uso: desde la carpeta server/ ejecutar  node scripts/check-plaintext-passwords.js
// NO modifica datos; solo lista los usuarios afectados para que un admin los corrija.

require('dotenv').config();
const prisma = require('../src/lib/prisma');

(async () => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        role: true,
        farmaciaId: true,
        passwordHash: true,
      },
    });

    const plaintext = users.filter((u) => !(u.passwordHash || '').startsWith('$2'));

    if (plaintext.length === 0) {
      console.log('OK: todos los usuarios tienen contraseña hasheada con bcrypt.');
    } else {
      console.log(`ATENCION: ${plaintext.length} usuario(s) con contraseña en texto plano:\n`);
      console.table(
        plaintext.map((u) => ({
          id: u.id,
          username: u.username,
          role: u.role,
          farmaciaId: u.farmaciaId,
        }))
      );
      console.log('Corrige estas contraseñas desde el panel de administración (cambio de contraseña) antes de desplegar.');
    }

    process.exit(plaintext.length === 0 ? 0 : 1);
  } catch (err) {
    console.error('Error consultando usuarios:', err);
    process.exit(2);
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
})();

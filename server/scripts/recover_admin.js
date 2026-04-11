const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function recover() {
  const username = 'Almi_Gamer';
  const password = 'admin'; // Contraseña original
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  console.log(`Recreando administrador: ${username}...`);

  try {
    const user = await prisma.user.upsert({
      where: { username },
      update: {
        passwordHash,
        role: 'ADMIN',
        isActive: true,
        farmaciaId: null // Global admin para evitar auto-borrado
      },
      create: {
        username,
        fullName: 'Administrador Principal',
        passwordHash,
        role: 'ADMIN',
        isActive: true,
        farmaciaId: null
      }
    });
    console.log('Usuario recuperado exitosamente:', JSON.stringify(user));
  } catch (error) {
    console.error('Error al recuperar usuario:', error);
  } finally {
    await prisma.$disconnect();
  }
}

recover();

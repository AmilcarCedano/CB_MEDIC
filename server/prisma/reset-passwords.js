/**
 * Password Reset Script for CB Medic
 * Run with: node prisma/reset-passwords.js
 * 
 * This script resets passwords for:
 * - Admin Global: admin / adminPass
 * - All vendedores: uses password "vendedor123"
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    console.log('=== CB Medic - Password Reset Script ===\n');

    // Reset Admin password
    const adminPassword = 'adminPass';
    const adminHash = await bcrypt.hash(adminPassword, 10);

    const adminUser = await prisma.user.findUnique({
        where: { username: 'admin' }
    });

    if (adminUser) {
        await prisma.user.update({
            where: { id: adminUser.id },
            data: { passwordHash: adminHash }
        });
        console.log('✅ Admin Global password reset:');
        console.log(`   Usuario: admin`);
        console.log(`   Contraseña: ${adminPassword}\n`);
    } else {
        // Create admin if doesn't exist
        await prisma.user.create({
            data: {
                username: 'admin',
                fullName: 'Administrador Global',
                passwordHash: adminHash,
                role: 'ADMIN',
                isActive: true
            }
        });
        console.log('✅ Admin Global created:');
        console.log(`   Usuario: admin`);
        console.log(`   Contraseña: ${adminPassword}\n`);
    }

    // Reset all vendedor passwords
    const vendedorPassword = 'vendedor123';
    const vendedorHash = await bcrypt.hash(vendedorPassword, 10);

    const vendedores = await prisma.user.findMany({
        where: { role: 'VENDEDOR' },
        include: { farmacia: true }
    });

    if (vendedores.length > 0) {
        console.log('✅ Vendedores encontrados y sus contraseñas reseteadas:\n');

        for (const vendedor of vendedores) {
            await prisma.user.update({
                where: { id: vendedor.id },
                data: { passwordHash: vendedorHash }
            });

            console.log(`   Usuario: ${vendedor.username}`);
            console.log(`   Nombre: ${vendedor.fullName}`);
            console.log(`   Farmacia: ${vendedor.farmacia?.nombre || 'Sin asignar'}`);
            console.log(`   Contraseña: ${vendedorPassword}`);
            console.log('');
        }
    } else {
        console.log('ℹ️  No se encontraron vendedores en el sistema.\n');
    }

    console.log('=== Resumen de Credenciales ===\n');
    console.log('🔐 ADMIN GLOBAL:');
    console.log('   Usuario: admin');
    console.log(`   Contraseña: ${adminPassword}\n`);

    if (vendedores.length > 0) {
        console.log('🔐 VENDEDORES:');
        vendedores.forEach(v => {
            console.log(`   Usuario: ${v.username}`);
        });
        console.log(`   Contraseña (todos): ${vendedorPassword}\n`);
    }

    console.log('✅ Proceso completado exitosamente!');
}

main()
    .catch((err) => {
        console.error('❌ Error:', err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

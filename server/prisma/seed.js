const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const farmacia = await prisma.farmacia.upsert({
    where: { ruc: '20541234567' },
    update: {},
    create: {
      nombre: 'Farmacia Central - Trujillo',
      ruc: '20541234567',
      direccion: 'Av. Espana 100',
      telefono: '999999999',
      email: 'central@cbmedic.pe',
    },
  });

  const adminPlain = 'adminPass';
  const adminPass = await bcrypt.hash(adminPlain, 10);
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {
      fullName: 'Administrador Global',
      passwordHash: adminPass,
      role: 'ADMIN',
      isActive: true,
    },
    create: {
      username: 'admin',
      fullName: 'Administrador Global',
      passwordHash: adminPass,
      role: 'ADMIN',
      isActive: true,
    },
  });

  const vendedorPlain = '123';
  const vendedorPass = await bcrypt.hash(vendedorPlain, 10);
  await prisma.user.upsert({
    where: { username: 'vendedor' },
    update: {
      fullName: 'Vendedor Demo',
      passwordHash: vendedorPass,
      role: 'VENDEDOR',
      isActive: true,
      farmaciaId: farmacia.id,
    },
    create: {
      username: 'vendedor',
      fullName: 'Vendedor Demo',
      passwordHash: vendedorPass,
      role: 'VENDEDOR',
      isActive: true,
      farmaciaId: farmacia.id,
    },
  });

  const defaultCategories = [
    { nombre: 'Medicamentos', farmaciaId: farmacia.id, isMaster: true },
    { nombre: 'Cuidado Personal', farmaciaId: farmacia.id, isMaster: true },
    { nombre: 'Suplementos', farmaciaId: farmacia.id, isMaster: true },
  ];

  await prisma.categoria.createMany({
    data: defaultCategories,
    skipDuplicates: true,
  });

  const masterProducts = [
    {
      productoDigemidId: 'DIG-0001',
      nombre: 'Dolo-Neurobion Forte',
      concentracion: '50mg/50mg/1mg/50mg',
      formaFarmaceutica: 'Tableta',
      presentacion: 'Caja x 30',
      registroSanitario: 'NSK-345',
      laboratorio: 'Merck',
      fabricante: 'Merck',
      rubro: 'Farmaceutico',
      principioActivo: 'Diclofenaco',
      fraccion: 'Caja',
      situacion: 'Activo',
    },
    {
      productoDigemidId: 'DIG-0002',
      nombre: 'Amoxicilina 500mg',
      concentracion: '500mg',
      formaFarmaceutica: 'Capsula',
      presentacion: 'Caja x 100',
      registroSanitario: 'ABC-123',
      laboratorio: 'Laboratorios ACME',
      fabricante: 'ACME Labs',
      rubro: 'Farmaceutico',
      principioActivo: 'Amoxicilina',
      fraccion: 'Caja',
      situacion: 'Activo',
    },
    {
      productoDigemidId: 'DIG-0003',
      nombre: 'Paracetamol 500mg',
      concentracion: '500mg',
      formaFarmaceutica: 'Tableta',
      presentacion: 'Blister x 10',
      registroSanitario: 'XYZ-789',
      laboratorio: 'Genericos SA',
      fabricante: 'Genericos SA',
      rubro: 'Farmaceutico',
      principioActivo: 'Paracetamol',
      fraccion: 'Blister',
      situacion: 'Activo',
    },
  ];

  await prisma.productoMaestro.createMany({
    data: masterProducts,
    skipDuplicates: true,
  });

    // Las reglas de venta cruzada se configuran directamente en la interfaz utilizando productos.

console.log('Seed listo');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

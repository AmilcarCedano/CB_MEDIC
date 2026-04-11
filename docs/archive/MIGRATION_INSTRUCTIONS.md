# 🔄 Instrucciones de Migración - Agregar farmaciaId a recetahabitual

## Paso 1: Generar Migración de Prisma

Ejecuta desde la carpeta `server/`:

```bash
cd server
npx prisma migrate dev --name add_farmacia_id_to_recetahabitual
```

Este comando:
1. Crea un archivo de migración en `server/prisma/migrations/`
2. Ejecuta la migración en tu base de datos local
3. Regenera el cliente de Prisma

## Paso 2: Revisar la Migración

Se creará un archivo similar a: `server/prisma/migrations/[timestamp]_add_farmacia_id_to_recetahabitual/migration.sql`

**Contenido esperado:**
```sql
-- AddColumn farmaciaId a recetahabitual
ALTER TABLE recetahabitual ADD COLUMN farmaciaId INT NOT NULL DEFAULT 1;
ALTER TABLE recetahabitual ADD CONSTRAINT FK_recetahabitual_farmacia 
  FOREIGN KEY (farmaciaId) REFERENCES farmacia(id) ON DELETE CASCADE;

-- Agregar índice
CREATE INDEX idx_recetahabitual_farmacia ON recetahabitual(farmaciaId);

-- Agregar unique constraint
ALTER TABLE recetahabitual ADD UNIQUE KEY ux_recetahabitual_unique 
  (farmaciaId, clienteId, productoId, servicioId);
```

## Paso 3: Verificar Resultados

```bash
# Ver estado de migraciones
npx prisma migrate status

# Vista previa de cambios (sin aplicar)
npx prisma migrate diff

# Conectar a DB y verificar tabla
mysql -u cbmedic_user -p
mysql> USE cbmedic;
mysql> DESCRIBE recetahabitual;
```

Deberías ver:
- Nueva columna: `farmaciaId INT`
- Relación: FK a `farmacia(id)`
- Índice en `farmaciaId`
- Unique constraint

## Paso 4: Migración en Staging/Producción

### Opción A: Usando Prisma (Recomendado)
```bash
npx prisma migrate deploy
```

### Opción B: SQL Manual (Si necesitas control fino)
```bash
# Exportar la migración
cat server/prisma/migrations/[timestamp]_add_farmacia_id_to_recetahabitual/migration.sql

# Ejecutar en BD staging/prod
mysql -u admin -p < migration.sql
```

## Paso 5: Verificar Datos Existentes

```javascript
// Script para asignar farmaciaId a recetas sin ella
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrateRecetasHabituales() {
  try {
    // Obtener recetas sin farmaciaId (o con default)
    const recetas = await prisma.recetahabitual.findMany({
      where: { farmaciaId: 1 },  // Si todas tienen default = 1
      include: { cliente: true }
    });

    console.log(`Encontradas ${recetas.length} recetas para migrar`);

    // Actualizar cada receta con farmaciaId correcta del cliente
    for (const receta of recetas) {
      if (receta.cliente && receta.cliente.farmaciaId) {
        await prisma.recetahabitual.update({
          where: { id: receta.id },
          data: { farmaciaId: receta.cliente.farmaciaId }
        });
        console.log(`✅ Receta ${receta.id} actualizada a farmacia ${receta.cliente.farmaciaId}`);
      }
    }

    console.log('🎉 Migración completada');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// node script.js
migrateRecetasHabituales();
```

## Paso 6: Testing Post-Migración

```bash
# 1. Reiniciar servidor
npm run dev

# 2. Verificar que GET /clientes/:id/habituales funciona
curl -H "Authorization: Bearer YOUR_JWT" \
  http://localhost:4000/clientes/1/habituales

# 3. Verificar que SELECT funciona
npx prisma studio
# Navega a recetahabitual y verifica que tiene farmaciaId

# 4. Test de aislamiento
# Intenta acceder a receta de otro cliente/farmacia - debe fallar o retornar []
```

## ⚠️ Rollback (Si algo sale mal)

```bash
# Ver historial de migraciones
npx prisma migrate status

# Rollback a migración anterior (CUIDADO - elimina datos)
npx prisma migrate resolve --rolled-back [timestamp]

# O manual:
npx prisma migrate reset  # ⚠️ Borra y recrea toda la BD
```

## ✅ Checklist de Migración

- [ ] Schema actualizado en `server/prisma/schema.prisma`
- [ ] Migración ejecutada localmente sin errores
- [ ] `recetahabitual` tiene columna `farmaciaId`
- [ ] Datos existentes tienen `farmaciaId` correcto
- [ ] GET `/clientes/:id/habituales` funciona
- [ ] POST `/clientes/habitual` crea con `farmaciaId`
- [ ] Tests de seguridad (no acceso a otra farmacia)
- [ ] Commit de migraciones en control de versiones

---

**Tiempo estimado:** 5-10 minutos en localhost | 15-30 en BD remota

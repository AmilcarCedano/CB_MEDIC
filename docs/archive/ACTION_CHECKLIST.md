# ⚡ CHECKLIST DE ACCIONES INMEDIATAS

**CRÍTICO:** Las correcciones de seguridad están implementadas pero NO funcionarán hasta que hagas esto.

---

## 🚨 PASO 1: Ejecutar Migración de Base de Datos (5 min)

```bash
cd server

# Generar e ejecutar migración
npx prisma migrate dev --name add_farmacia_id_to_recetahabitual

# Output esperado:
# ✔ Successfully created migrations/[timestamp]
# ✔ Your database is now in sync with your schema
```

**Si algo falla:**
```bash
# Rollback
npx prisma migrate resolve --rolled-back

# O reset completo (⚠️ borra datos)
npx prisma migrate reset
```

---

## 🔑 PASO 2: Configurar .env (10 min)

```bash
# Ver si existe
cat server/.env

# Si no existe, crear desde .env.example
cp server/.env.example server/.env

# Editar Y llenar con valores REALES
nano server/.env
# O
code server/.env
```

**Variables críticas que DEBES cambiar:**

```env
# 🔴 CRÍTICO - Generar con: openssl rand -base64 32
JWT_SECRET="TU_CLAVE_SECRETA_AQUI_MINIMO_32_CARACTERES"

# 🔴 CRÍTICO - Contraseña fuerte (16+ caracteres, letras+números+símbolos)
ADMIN_MASTER_PASSWORD="TuContrasenaMaestra#123"

# Tu base de datos real
DATABASE_URL="mysql://usuario:password@localhost:3306/cbmedic"
```

**No olvides:**
- [ ] Guardar cambios
- [ ] NO hacer commit del .env a git
- [ ] \`.env` debe estar en `.gitignore`

---

## ✅ PASO 3: Validar que Funciona (5 min)

```bash
# Iniciar servidor
cd server
npm run dev

# En otra terminal, hacer requests de prueba:

# 1. Health check (sin autenticación)
curl http://localhost:4000/health

# 2. Login fallido (sin credenciales)
curl http://localhost:4000/auth/login

# 3. Acceso sin JWT (debe fallar con 401)
curl http://localhost:4000/clientes

# Output esperado: {"error":"Token de autenticación requerido"}
```

**Si algo está mal:**
- [ ] ¿Hay errores en la consola del servidor?
- [ ] ¿Qué puerto está escuchando? (por defecto 4000)
- [ ] ¿La BD está corriendo?

---

## 🧪 PASO 4: Test Básico de Seguridad (10 min)

```bash
# 1. Login como admin
TOKEN=$(curl -s -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"adminPass"}' \
  | jq -r '.token')

echo "Token: $TOKEN"

# 2. Decodificar JWT para verificar que tiene farmaciaId
echo $TOKEN | jq -R 'split(".")[1] | @base64d | fromjson'

# Esperado:
# {
#   \"sub\": 1,
#   \"role\": \"ADMIN\",
#   \"farmaciaId\": 1,
#   \"iat\": ...,
#   \"exp\": ...
# }

# 3. Llamar endpoint protegido
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:4000/clientes \
  | jq

# Esperado: Array de clientes ([] si no hay)
```

---

## 📚 PASO 5: Leer Documentación (15 min)

**En este orden:**

1. **SECURITY_EXECUTIVE_SUMMARY.md** ← EMPIEZA AQUÍ
   - Resumen rápido (2 min)
   - Qué se corrigió (3 min)

2. **SECURITY_FIXES_SUMMARY.md** ← Lee los detalles
   - Técnica detrás de cada corrección (10 min)

3. **TESTING_SECURITY.md** ← Cuando necesites validar
   - 12 test cases listos para usar

4. **MIGRATION_INSTRUCTIONS.md** ← Si tienes problemas
   - Guía detallada de migraciones

---

## ⚠️ PASO 6: Verificar Base de Datos (5 min)

```bash
# Conectar a BD
mysql -u cbmedic_user -p

# Ver que migración se aplicó
mysql> USE cbmedic;
mysql> DESCRIBE recetahabitual;

# Esperado: Nueva columna 'farmaciaId' INT
```

**Si farmaciaId no existe:**
- Ejecuta nuevamente: `npx prisma migrate deploy`

---

## 🔒 PASO 7: Asegurar Archivo .env (2 min)

```bash
# Verificar que NO está en git
cd server
git status

# Si aparece .env, eliminar del tracking
git rm --cached .env
git commit -m "remove .env from tracking"

# Verificar .gitignore incluye .env
echo ".env" >> .gitignore
git add .gitignore
git commit -m "ensure .env in gitignore"
```

---

## 📋 PASO 8: Documentar Setup (5 min)

Crea un archivo `SETUP.md` en root del proyecto:

```markdown
# Setup del Proyecto CBMedic

## Requisitos
- Node.js 16+
- MySQL 8.0+

## Setup Local

1. Clonar repo
2. \`npm install\` en raíz
3. \`cd server && npm install\`
4. \`cp .env.example .env\` y llenar variables
5. \`npx prisma migrate deploy\`
6. \`npm run dev\`

## Variables de Entorno Requeridas
- JWT_SECRET (32+ chars)
- ADMIN_MASTER_PASSWORD (16+ chars)
- DATABASE_URL

## Testing
Ver TESTING_SECURITY.md
```

---

## ✅ CHECKLIST FINAL

Marca cuando completes cada paso:

- [ ] **PASO 1:** Migración de BD ejecutada
- [ ] **PASO 2:** .env configurado con valores reales
- [ ] **PASO 3:** Servidor inicia sin errores
- [ ] **PASO 4:** JWT contiene farmaciaId
- [ ] **PASO 5:** Leído SECURITY_EXECUTIVE_SUMMARY.md
- [ ] **PASO 6:** recetahabitual tiene farmaciaId en BD
- [ ] **PASO 7:** .env no está en git
- [ ] **PASO 8:** SETUP.md creado

---

## 🚀 CUÁNDO ESTÉS LISTO PARA PRODUCCIÓN

- [ ] Completado TODO en este checklist
- [ ] Completado `TESTING_SECURITY.md` (todos los 12 tests)
- [ ] .env tiene valores FUERTES y únicos
- [ ] Database está backupeada
- [ ] Team está capacitado en seguridad
- [ ] Documentación compartida con equipo

---

## 🆘 SI ALGO SALE MAL

1. **No inicia servidor:**
   ```bash
   npm run dev 2>&1 | head -50
   ```
   Busca errores de sintaxis o BD

2. **JWT no tiene farmaciaId:**
   ```bash
   # Verificar DB que usuario tiene farmaciaId
   SELECT id, username, farmaciaId FROM user WHERE id=1;
   ```

3. **Migración falla:**
   ```bash
   npm prisma migrate status
   npx prisma db push --force-reset
   ```

4. **Contraseña de BD incorrecta:**
   ```bash
   # Resetear en MySQL
   GRANT ALL ON cbmedic.* TO 'cbmedic_user'@'localhost';
   FLUSH PRIVILEGES;
   ```

---

## 📞 PREGUNTAS FRECUENTES

**P: ¿Se pierden datos al correr la migración?**  
R: No. `farmaciaId` se agrega con valor default = 1. Los datos existentes permanecen.

**P: ¿Qué es el `.env`?**  
R: Archivo con variables de entorno (credenciales, claves, URLs). No se sube a git por seguridad.

**P: ¿Debo cambiar todas las contraseñas?**  
R: No necesario. Las nuevas contraseñas serán hasheadas. Las antiguas pueden tener fallback (temporal).

**P: ¿Puedo saltarme la migración?**  
R: No. Sin `farmaciaId` en recetahabitual, habría brecha de seguridad.

**P: ¿Cuánto tiempo toma todo?**  
R: ~30 minutos en total (si todo va bien)

---

**Estado:** 🟢 LISTO PARA EJECUTAR  
**Criticidad:** 🔴 DEBE HACERSE HOY  
**Tiempo estimado:** 30-45 minutos

**¿Comenzamos? ⬇️**

```bash
cd server
npx prisma migrate dev --name add_farmacia_id_to_recetahabitual
```

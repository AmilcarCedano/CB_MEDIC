# ✅ Testing de Seguridad - CBMedic

**Objetivo:** Verificar que todas las correcciones de seguridad funcionan correctamente.

---

## 🧪 Test 1: JWT Validation

### Escenario: Intentar acceso sin JWT
```bash
# ❌ Debe retornar 401
curl http://localhost:4000/clientes

# Respuesta esperada:
# {\"error\":\"Token de autenticación requerido\"}
```

### Escenario: JWT válido
```bash
# ✅ Debe funcionar
curl -H "Authorization: Bearer YOUR_VALID_JWT" \
  http://localhost:4000/clientes
```

---

## 🧪 Test 2: farmaciaId Isolation

### Prerequisito:
- 2 farmacias en BD (Farmacia A id=1, Farmacia B id=2)
- 2 usuarios: user_a (farmacia 1), user_b (farmacia 2)

### Escenario: Usuario de Farmacia A intentando acceder a datos de Farmacia B
```bash
# 1. Login como user_a (farmacia 1)
JWT_A=$(curl -s -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"user_a","password":"pass_a"}' | jq -r '.token')

# 2. Intentar listar clientes de farmacia B
curl -H "Authorization: Bearer $JWT_A" \
  "http://localhost:4000/clientes?farmaciaId=2"

# ❌ Debe IGNORAR el query param farmaciaId y retornar solo clientes de farmacia 1
# ✅ Debe filtrar por req.farmaciaId del JWT (que es 1)
```

---

## 🧪 Test 3: Recetas Habituales Isolation

### Escenario: Acceso a recetas de clientes de otra farmacia
```bash
# 1. Como admin/user de farmacia 1
JWT_1=$(curl -s -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"adminPass"}' | jq -r '.token')

# 2. Intentar ver recetas del cliente 5 (que pertenece a farmacia 2)
curl -H "Authorization: Bearer $JWT_1" \
  http://localhost:4000/clientes/5/habituales

# ❌ ANTES (VULNERABLE): Retornaba recetas del cliente
# ✅ DESPUÉS (SEGURO): {\"error\":\"Cliente no encontrado o no pertenece a esta farmacia\"}
```

---

## 🧪 Test 4: Headers No Son Suplantables

### Escenario: Intentar cambiar farmaciaId por header
```bash
# ❌ ANTES: Header podía cambiar la farmacia de acceso
JWT=$(curl -s -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"vendedor","password":"123"}' | jq -r '.token')

curl -H "Authorization: Bearer $JWT" \
  -H "x-farmacia-id: 2" \
  http://localhost:4000/config/pos

# ✅ DESPUÉS: Ignora header y usa req.farmaciaId del JWT (del vendedor)
# Respuesta: Configuración POS de la farmacia del vendedor (la del JWT)
```

---

## 🧪 Test 5: requireAdmin Protection

### Escenario: VENDEDOR intentando crear farmacia
```bash
JWT_VENDEDOR=$(curl -s -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"vendedor","password":"123"}' | jq -r '.token')

curl -X POST http://localhost:4000/farmacias \
  -H "Authorization: Bearer $JWT_VENDEDOR" \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Farmacia Pirata","ruc":"99999999"}'

# ❌ DEBE RETORNAR: 403 Forbidden - \"Acceso denegado. Se requiere rol de Administrador.\"
```

### Escenario: ADMIN creando farmacia
```bash
JWT_ADMIN=$(curl -s -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"adminPass"}' | jq -r '.token')

curl -X POST http://localhost:4000/farmacias \
  -H "Authorization: Bearer $JWT_ADMIN" \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Farmacia Nueva","ruc":"20000000000"}'

# ✅ DEBE RETORNAR: 201 Created + datos de nueva farmacia
```

---

## 🧪 Test 6: 24-Hour Timer para Vendedores

### Escenario: VENDEDOR listando envios
```bash
JWT_VENDEDOR=$(curl -s -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"vendedor","password":"123"}' | jq -r '.token')

curl -H "Authorization: Bearer $JWT_VENDEDOR" \
  http://localhost:4000/envios

# Respuesta: Solo envios del último 24h
# Si hay envios más antiguos de ese vendedor, NO deben aparecer
```

### Verificar en BD:
```sql
SELECT id, titulo, createdAt FROM envio 
WHERE usuarioId = 2 AND farmaciaId = 1
ORDER BY createdAt DESC;
```

---

## 🧪 Test 7: Contraseña Hasheada con bcrypt

### Verificar en BD:
```bash
# Conectar a BD
mysql -u cbmedic_user -p cbmedic

# Ver contraseña de usuario
SELECT id, username, passwordHash FROM user LIMIT 5;

# ✅ DEBE VERSE: Hash largo (ej: $2a$10$...)
# ❌ NO DEBE VERSE: Texto plano (ej: "password123")
```

### Probar cambiar contraseña:
```bash
# POST /users/:id/change-password
curl -X PUT http://localhost:4000/users/2 \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"password":"nuevaPass123"}'

# Verificar BD que está hasheada
```

---

## 🧪 Test 8: Master Import Solo Admin

### Escenario: VENDEDOR intentando importar base maestra
```bash
JWT_VENDEDOR=$(curl -s -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"vendedor","password":"123"}' | jq -r '.token')

curl -X POST http://localhost:4000/master/import \
  -H "Authorization: Bearer $JWT_VENDEDOR" \
  -H "Content-Type: application/json" \
  -d '{"filename":"productos.csv","importedBy":"vendedor","productos":[]}'

# ❌ DEBE RETORNAR: 403 Forbidden
```

### Escenario: ADMIN importando
```bash
# ✅ DEBE FUNCIONAR y retornar 201 Created
```

---

## 🧪 Test 9: Categorías - Validación de Propiedad

### Escenario: Intentar modificar categoría de otra farmacia
```bash
JWT_1=$(curl -s -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin_farm1","password":"pass"}' | jq -r '.token')

# ID 5 es categoría de farmacia 2
curl -X PUT http://localhost:4000/categories/5 \
  -H "Authorization: Bearer $JWT_1" \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Categoría Hackeada"}'

# ❌ DEBE RETORNAR: 403 Forbidden - \"Acceso denegado. Categoría no pertenece a tu farmacia.\"
```

---

## 🧪 Test 10: Envios - requireAdmin en DELETE

### Escenario: VENDEDOR intentando eliminar envío
```bash
JWT_VENDEDOR=$(curl -s -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"vendedor","password":"123"}' | jq -r '.token')

curl -X DELETE http://localhost:4000/envios/10 \
  -H "Authorization: Bearer $JWT_VENDEDOR" \
  -H "Content-Type: application/json" \
  -d '{"password":"admin123"}'

# ❌ DEBE RETORNAR: 403 Forbidden - \"Acceso denegado. Se requiere rol de Administrador.\"
```

---

## 🧪 Test 11: Config/POS No Usa Headers

### Escenario: Cambiar x-farmacia-id header en GET /config/pos
```bash
JWT=$(curl -s -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin_farm1","password":"pass"}' | jq -r '.token')

# Intenta obtener config de farmacia 2
curl -H "Authorization: Bearer $JWT" \
  -H "x-farmacia-id: 2" \
  http://localhost:4000/config/pos

# ✅ DEBE RETORNAR: Config POS de farmacia 1 (del JWT, no del header)
```

---

## 🧪 Test 12: ConfiguracionPago Usa JWT

### Escenario: Cambiar x-farmacia-id header en GET /configuracion-pago
```bash
curl -H "Authorization: Bearer $JWT" \
  -H "x-farmacia-id: 999" \
  http://localhost:4000/configuracion-pago

# ✅ DEBE RETORNAR: Métodos de pago de farmacia del JWT, no 999
```

---

## 📋 Checklist de Testing

### Antes de Producción:

- [ ] **JWT Validation**
  - [ ] Sin token = 401
  - [ ] Con token válido = OK
  - [ ] Con token inválido = 401

- [ ] **Isolación por Farmacia**
  - [ ] Usuario A no ve datos de Farmacia B
  - [ ] Usuario B no puede editar datos de Farmacia A
  - [ ] recetahabitual filtrada correctamente

- [ ] **Headers No Controlables**
  - [ ] x-farmacia-id en header es ignorado
  - [ ] Solo se usa req.farmaciaId del JWT

- [ ] **requireAdmin**
  - [ ] VENDEDOR no puede crear farmacias
  - [ ] VENDEDOR no puede importar base maestra
  - [ ] VENDEDOR no puede eliminar envios
  - [ ] ADMIN sí puede hacer todo

- [ ] **Timers**
  - [ ] VENDEDOR solo ve últimas 24h de envios
  - [ ] ADMIN ve todos los envios

- [ ] **Contraseñas**
  - [ ] Nuevas contraseñas están hasheadas
  - [ ] Login funciona
  - [ ] No hay contraseñas en texto plano nuevo

- [ ] **Categorías**
  - [ ] No se puede editar categoría de otra farmacia
  - [ ] Validación de propiedad funciona

- [ ] **Cálculos**
  - [ ] JWT expira en 10h
  - [ ] Filtro de 24h es exacto (no 20h)

---

## 🚨 Problemas Comunes

### \"Token de autenticación requerido\"
- [ ] ¿Estás pasando Authorization header?
- [ ] ¿El JWT es válido y no expirado?
- [ ] ¿La ruta está protegida con middleware `authenticate`?

### \"Acceso denegado. Se requiere rol de Administrador.\"
- [ ] ¿Eres ADMIN?
- [ ] ¿El endpoint tiene `requireAdmin` middleware?

### \"Categoría no pertenece a tu farmacia\"
- [ ] ¿La categoría pertenece a tu farmacia?
- [ ] ¿Tu JWT tiene la farmaciaId correcta?

### \"farmaciaId no identificada\"
- [ ] ¿El usuario tiene farmaciaId asignado en BD?
- [ ] ¿El JWT incluye farmaciaId (claim 'farmaciaId')?

---

## 📊 Reporte de Testing

**Recomendado:** Completar todos los 12 tests y documentar:
- [ ] Test iniciado
- [ ] Resultado (✅ Pass / ❌ Fail)
- [ ] Observaciones
- [ ] Fecha de ejecución

---

**Tiempo estimado:** 30-45 minutos completar todos los tests

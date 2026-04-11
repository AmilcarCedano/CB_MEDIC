# 🚀 Guía de Despliegue CBMedic en Dokploy

---

## 📋 Arquitectura del Sistema

```
Internet (solo Puerto 80)
       │
       ▼
┌─────────────────────────────────┐
│  FRONTEND (Nginx + React)       │
│  Puerto público: 80             │
│  Proxy reverso → backend:4000   │
└──────────────┬──────────────────┘
               │ (red interna Docker)
┌──────────────▼──────────────────┐
│  BACKEND (Node.js + Prisma)     │
│  Puerto interno: 4000           │
│  NO expuesto al público         │
└──────────────┬──────────────────┘
               │
┌──────────────▼──────────────────┐
│  MYSQL 8.x                      │
│  Puerto interno: 3306           │
└─────────────────────────────────┘
```

---

## 🗄️ SERVICIO 1: MySQL

### Crear en Dokploy
- **Tipo**: Database → MySQL
- **Nombre**: `cbmedic-mysql`

### Variables de Entorno

```env
MYSQL_ROOT_PASSWORD=TuPasswordSeguraAqui123
MYSQL_DATABASE=cbmedic
```

### Post-creación
- Si tienes backup: importar `deploy_tools/cbmedic_backup.sql`
- Si es nueva: dejar vacía, luego ejecutar migraciones + seed

---

## ⚙️ SERVICIO 2: Backend (API)

### Crear en Dokploy
- **Tipo**: Application → Docker (GitHub)
- **Repositorio**: `AmilcarCedano/CB_MEDIC`
- **Rama**: `master`
- **Dockerfile Path**: `server/Dockerfile`
- **Build Context**: `./server`
- **Dominio**: NO asignar (no necesita ser público)

### Variables de Entorno

```env
DATABASE_URL=mysql://root:TuPasswordSeguraAqui123@cbmedic-mysql:3306/cbmedic
JWT_SECRET=clave_secreta_larga_minimo_32_caracteres_ejemplo_xyz789
PORT=4000
NODE_ENV=production
ADMIN_MASTER_PASSWORD=ClaveAdminSegura2026

# === API RENIEC (consulta DNI/RUC) ===
RENIEC_API_URL=https://api.apis.net.pe/v2
RENIEC_API_TOKEN=tu_token_de_apis_net_pe
```

### Tabla de Variables del Backend

| Variable | Requerida | Descripción | Ejemplo |
|:---|:---:|:---|:---|
| `DATABASE_URL` | ✅ | Conexión MySQL. Host = nombre del servicio MySQL en Dokploy | `mysql://root:pass@cbmedic-mysql:3306/cbmedic` |
| `JWT_SECRET` | ✅ | Clave para tokens de sesión. Mínimo 32 caracteres | `cbmedic_jwt_x7k9m2p_2026_prod` |
| `PORT` | ✅ | Puerto interno del API | `4000` |
| `NODE_ENV` | ✅ | Modo del servidor | `production` |
| `ADMIN_MASTER_PASSWORD` | ✅ | Clave maestra para eliminar ventas/ingresos | La que decidas |
| `RENIEC_API_URL` | ⚠️ | URL base de la API de documentos | `https://api.apis.net.pe/v2` |
| `RENIEC_API_TOKEN` | ⚠️ | Token para consultar DNI/RUC | Lo obtienes en apis.net.pe |

> **Nota sobre RENIEC**: Si no configuras estas variables, el sistema funciona normalmente pero la búsqueda de DNI/RUC no estará disponible. Puedes agregar o cambiar el token en cualquier momento desde Dokploy sin redesplegar.

### 🔄 Cambiar el Token RENIEC (cuando generes uno nuevo)

1. En Dokploy → Servicio **Backend** → **Medio Ambiente**
2. Busca `RENIEC_API_TOKEN` y cambia el valor al nuevo token
3. Haz clic en **Guardar**
4. **Reiniciar** el servicio backend (NO necesitas reconstruir)
5. Listo, el nuevo token está activo inmediatamente

---

## 🌐 SERVICIO 3: Frontend (Web)

### Crear en Dokploy
- **Tipo**: Application → Docker (GitHub)
- **Repositorio**: `AmilcarCedano/CB_MEDIC`
- **Rama**: `master`
- **Dockerfile Path**: `web/Dockerfile`
- **Build Context**: `./web`

### Variables de Entorno

#### Sección "Medio Ambiente" (Environment):
```env
NODE_ENV=production
```

#### Sección "Argumentos de Construcción" (Build Arguments):
```env
VITE_API_URL=
```

> ⚠️ **`VITE_API_URL` DEBE estar VACÍO** (sin valor después del `=`). El proxy Nginx se encarga de conectar al backend.

### Dominio
- **Con dominio propio**: `farmacia.tudominio.com` → DNS apuntar al IP del VPS
- **Sin dominio**: `http://IP-DE-TU-VPS` (puerto 80 directo)
- **Con sslip.io**: `cbmedic.72.60.13.187.sslip.io`

### Puerto
- Puerto externo: `80` (marcar como público)

---

## 📝 Resumen Rápido (Copiar/Pegar)

### MySQL:
```env
MYSQL_ROOT_PASSWORD=TuPasswordSeguraAqui123
MYSQL_DATABASE=cbmedic
```

### Backend:
```env
DATABASE_URL=mysql://root:TuPasswordSeguraAqui123@cbmedic-mysql:3306/cbmedic
JWT_SECRET=clave_secreta_larga_minimo_32_caracteres
PORT=4000
NODE_ENV=production
ADMIN_MASTER_PASSWORD=ClaveAdminSegura2026
RENIEC_API_URL=https://api.apis.net.pe/v2
RENIEC_API_TOKEN=tu_token_aqui
```

### Frontend (Build Arguments):
```env
VITE_API_URL=
```

---

## 🔑 Credenciales Iniciales

### Con backup importado:
| Usuario | Contraseña | Rol |
|:---|:---|:---|
| `Anderson` | La que configuraste | ADMIN |

### Con seed (BD nueva):
```bash
# Ejecutar dentro del contenedor backend:
npx prisma migrate deploy
npx prisma db seed
```

| Usuario | Contraseña | Rol |
|:---|:---|:---|
| `admin` | `adminPass` | ADMIN Global |
| `vendedor` | `123` | VENDEDOR Demo |

**⚠️ Cambiar estas contraseñas inmediatamente.**

---

## 📋 Checklist de Despliegue

- [ ] MySQL creado con `MYSQL_DATABASE=cbmedic`
- [ ] Backend con las 7 variables configuradas
- [ ] Frontend con `VITE_API_URL=` vacío en Build Arguments
- [ ] Dominio asignado al frontend
- [ ] Backend SIN dominio público
- [ ] Primera construcción con Caché Limpia
- [ ] BD inicializada (backup o migrate+seed)
- [ ] Login probado en navegador
- [ ] Contraseñas por defecto cambiadas
- [ ] Token RENIEC configurado (opcional)

---

## 🔧 Problemas Comunes

| Síntoma | Solución |
|:---|:---|
| `ERR_CONNECTION_TIMED_OUT` | Reconstruir frontend con caché limpia |
| Pantalla blanca | F12 → Consola. Verificar errores JS |
| `Cannot find module` | Reconstruir backend con caché limpia |
| Login no funciona | Verificar logs del backend |
| DNI/RUC no busca | Configurar `RENIEC_API_TOKEN` en variables del backend |
| `server/server` duplicado | Build Context debe ser `./server` |
| Logo no carga | Ya resuelto con proxy en nginx.conf |

---

## 🔄 Actualizaciones Futuras

```bash
# En tu PC:
git add .
git commit -m "descripción"
git push

# En Dokploy:
# Si cambiaste código → Deploy normal
# Si cambiaste variables → Solo reiniciar el servicio
# Si cambiaste VITE_API_URL → Reconstruir frontend con Caché Limpia
```

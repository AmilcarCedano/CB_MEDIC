# 🚀 Guía Completa de Despliegue CBMedic en VPS Contabo

**Última actualización:** Mayo 2026 | **VPS:** Contabo | **IP:** 213.199.58.162

---

## 🌐 Acceso al Sistema

| Servicio | URL |
|:---|:---|
| **Aplicación (HTTPS)** | **https://cbmedic.213.199.58.162.sslip.io** |
| **Aplicación (HTTP)** | http://213.199.58.162 (redirige a HTTPS) |
| **Panel Dokploy** | http://213.199.58.162:3000 |

### Credenciales Iniciales del Sistema
| Usuario | Contraseña | Rol |
|:---|:---|:---|
| `admin` | `adminPass` | ADMIN Global |

> ⚠️ **Cambiar la contraseña inmediatamente** después del primer login.

---

## 🔑 Acceso SSH a la VPS

```bash
# Desde terminal (Windows PowerShell / Linux / Mac)
ssh root@213.199.58.162

# Contraseña: 19LhNC0b
```

**Panel Contabo:** https://my.contabo.com  
- Email: amilcar.cb.2015@gmail.com  
- Password: qWNPLUJWv9RVW6Hvtfz4

---

## 📋 Arquitectura del Sistema

```
Internet (HTTPS puerto 443)
       │
       ▼
┌─────────────────────────────────┐
│  Traefik (Dokploy)              │
│  Puertos: 80, 443, 3000         │
│  Certificado: Let's Encrypt     │
│  Dominio: cbmedic.*.sslip.io    │
└──────────────┬──────────────────┘
               │
┌──────────────▼──────────────────┐
│  FRONTEND (Nginx + React)       │
│  Contenedor: cbmedic-frontend   │
│  Puerto interno: 80             │
│  Proxy reverso → backend:4000   │
└──────────────┬──────────────────┘
               │
┌──────────────▼──────────────────┐
│  BACKEND (Node.js + Prisma)     │
│  Contenedor: cbmedic-backend    │
│  Puerto interno: 4000           │
└──────────────┬──────────────────┘
               │
┌──────────────▼──────────────────┐
│  MYSQL 8.0                      │
│  Contenedor: cbmedic-mysql      │
│  Puerto interno: 3306           │
│  Volumen: app_mysql_data        │
└─────────────────────────────────┘
```

---

## 🗂️ Ubicación de Archivos en VPS

```
/opt/cbmedic/
└── app/                    ← Repositorio clonado de GitHub
    ├── docker-compose.yml  ← Compose de producción
    ├── server/
    │   ├── .env            ← Variables de entorno del backend
    │   └── Dockerfile
    └── web/
        ├── nginx.conf      ← Configuración Nginx (proxy al backend)
        └── Dockerfile

/etc/dokploy/traefik/       ← Config de Traefik/Dokploy
    traefik.yml
    dynamic/
        acme.json           ← Certificados SSL guardados
```

---

## 🔧 Variables de Entorno del Backend

Archivo: `/opt/cbmedic/app/server/.env`

```env
DATABASE_URL="mysql://root:CBMedic2026Secure@cbmedic-mysql:3306/cbmedic"
JWT_SECRET="cbmedic_jwt_x9k2m8p_2026_prod_secure_key_32chars"
PORT=4000
NODE_ENV=production
ADMIN_MASTER_PASSWORD="CBAdmin2026Master"
RENIEC_API_URL="https://api-codart.cgrt.org"
RENIEC_API_TOKEN="Egrne38d9Kn0bPtdsl2Gn8GzscYT2jiSkhnCZvBA9ngSgSr7R6QrkLHSWbra"
```

### Variables de MySQL
```
MYSQL_ROOT_PASSWORD: CBMedic2026Secure
MYSQL_DATABASE: cbmedic
```

---

## 🔄 Actualizar el Sistema (Nuevas Versiones)

```bash
# 1. Desde tu PC - push los cambios a GitHub
git add .
git commit -m "descripción del cambio"
git push origin master

# 2. En la VPS - actualizar y reconstruir
ssh root@213.199.58.162

cd /opt/cbmedic/app
git pull

# Si cambiaste código del backend:
docker compose build --no-cache backend
docker compose up -d --force-recreate backend

# Si cambiaste código del frontend:
docker compose build --no-cache frontend
docker compose up -d --force-recreate frontend

# Si cambiaste ambos:
docker compose build --no-cache
docker compose up -d --force-recreate
```

---

## 🔑 Cambiar Token RENIEC

```bash
ssh root@213.199.58.162

# Editar .env
nano /opt/cbmedic/app/server/.env
# Cambiar RENIEC_API_TOKEN=NuevoToken

# Reiniciar backend (sin reconstruir)
cd /opt/cbmedic/app
docker compose restart backend
```

---

## 💾 Base de Datos

### Ver tablas
```bash
docker exec cbmedic-mysql mysql -uroot -pCBMedic2026Secure cbmedic -e "SHOW TABLES;"
```

### Backup de la BD
```bash
docker exec cbmedic-mysql mysqldump -uroot -pCBMedic2026Secure cbmedic > backup_$(date +%Y%m%d).sql
```

### Restaurar backup
```bash
docker exec -i cbmedic-mysql mysql -uroot -pCBMedic2026Secure cbmedic < backup.sql
```

---

## 🛠️ Comandos Útiles en VPS

```bash
# Ver estado de todos los contenedores
docker ps

# Ver logs del backend
docker logs cbmedic-backend --tail 50 -f

# Ver logs del frontend
docker logs cbmedic-frontend --tail 50 -f

# Ver logs de Traefik (proxy/SSL)
docker logs dokploy-traefik --tail 30

# Reiniciar todo el sistema CB Medic
cd /opt/cbmedic/app
docker compose restart

# Ver uso de recursos
docker stats --no-stream
```

---

## 🔐 HTTPS y Certificado SSL

- **Proveedor:** Let's Encrypt (automático vía Traefik)
- **Dominio:** `cbmedic.213.199.58.162.sslip.io`
  - sslip.io resuelve automáticamente IPs en el dominio
  - No requiere registro de dominio ni configuración DNS
- **Renovación:** Automática cada 60 días por Traefik
- **Cert guardado en:** `/etc/dokploy/traefik/dynamic/acme.json`

---

## 📋 Checklist de Despliegue Inicial ✅

- [x] Ubuntu actualizado
- [x] Docker 29.x instalado
- [x] Dokploy v0.29.4 instalado
- [x] MySQL 8.0 corriendo (`cbmedic-mysql`)
- [x] Backend Node.js corriendo (`cbmedic-backend`)
- [x] Frontend Nginx+React corriendo (`cbmedic-frontend`)
- [x] BD inicializada con `prisma db push`
- [x] Admin creado: `admin / adminPass`
- [x] HTTPS activo con Let's Encrypt
- [x] Redirect HTTP→HTTPS configurado
- [x] Token RENIEC configurado
- [x] nginx.conf apunta a `cbmedic-backend:4000`

---

## 🔧 Problemas Comunes

| Síntoma | Solución |
|:---|:---|
| Frontend en "Restarting" | `docker logs cbmedic-frontend` — verificar nginx.conf upstream hostname |
| Error 404 en dominio | Traefik no encontró el contenedor — verificar que está en `dokploy-network` |
| Error 502 HTTPS | Frontend acaba de reiniciar, esperar 10-15s |
| `host not found in upstream` | nginx.conf tiene hostname incorrecto del backend |
| BD vacía / error seed | Ejecutar `docker exec cbmedic-backend npx prisma db push` |
| Token RENIEC expirado | Actualizar `RENIEC_API_TOKEN` en `/opt/cbmedic/app/server/.env` y reiniciar backend |
| Certificado SSL no genera | Verificar `certresolver=letsencrypt` en labels del docker-compose |

---

## 📝 Historial de Despliegue

| Fecha | Versión | Cambios |
|:---|:---|:---|
| Mayo 2026 | v1.0 | Despliegue inicial en Contabo VPS |
| Mayo 2026 | v1.1 | Scanner QR móvil, etiquetas mejoradas, RENIEC Codart API |

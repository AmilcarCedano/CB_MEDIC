# 🐳 Guía General: Desplegar Aplicaciones Docker en VPS

**Para:** Cualquier proyecto con Docker | **VPS:** Contabo, DigitalOcean, Linode, etc.

---

## 📋 Índice

1. [Requisitos Previos](#1-requisitos-previos)
2. [Preparar la VPS](#2-preparar-la-vps)
3. [Instalar Docker](#3-instalar-docker)
4. [Instalar Dokploy (Panel Visual)](#4-instalar-dokploy-panel-visual)
5. [Estructura de un Proyecto Dockerizado](#5-estructura-de-un-proyecto-dockerizado)
6. [Desplegar con Docker Compose (sin panel)](#6-desplegar-con-docker-compose-sin-panel)
7. [Desplegar con Dokploy (con panel)](#7-desplegar-con-dokploy-con-panel)
8. [Configurar HTTPS automático](#8-configurar-https-automático)
9. [Dominios: Opciones Gratuitas y de Pago](#9-dominios-opciones-gratuitas-y-de-pago)
10. [Comandos de Mantenimiento](#10-comandos-de-mantenimiento)
11. [Conectar desde tu PC con PowerShell](#11-conectar-desde-tu-pc-con-powershell)
12. [Plantillas Rápidas](#12-plantillas-rápidas)

---

## 1. Requisitos Previos

### En tu PC necesitas:
- **Git** — para clonar y pushear tu código
- **PowerShell** (Windows) o Terminal (Mac/Linux)
- **Módulo Posh-SSH** para automatizar desde Windows:
  ```powershell
  Install-Module -Name Posh-SSH -Force -Scope CurrentUser
  ```

### Tu proyecto necesita:
- Un `Dockerfile` por cada servicio (backend, frontend, etc.)
- Un `docker-compose.yml` en la raíz
- Variables de entorno en un `.env` (nunca lo subas a GitHub)

---

## 2. Preparar la VPS

### Conectarse por SSH
```bash
# Desde PowerShell / Terminal
ssh root@TU_IP_VPS

# Si la VPS usa puerto diferente:
ssh -p 25282 root@TU_IP_VPS
```

### Actualizar el sistema (siempre primero)
```bash
apt-get update && apt-get upgrade -y
apt-get install -y curl git wget nano ufw
```

### Configurar firewall básico
```bash
ufw allow 22      # SSH
ufw allow 80      # HTTP
ufw allow 443     # HTTPS
ufw allow 3000    # Panel Dokploy (si usas Dokploy)
ufw enable
```

---

## 3. Instalar Docker

```bash
# Instalación automática (Ubuntu/Debian)
curl -fsSL https://get.docker.com | sh

# Habilitar en el sistema
systemctl enable docker
systemctl start docker

# Verificar
docker --version
docker compose version
```

---

## 4. Instalar Dokploy (Panel Visual)

Dokploy es un panel web open-source que te permite desplegar apps desde GitHub con interfaz visual, incluye Traefik para HTTPS automático.

```bash
curl -sSL https://dokploy.com/install.sh | sh
```

Después de instalar, accede a: `http://TU_IP:3000`

- Crea tu cuenta admin en el primer acceso
- Conecta tu repositorio GitHub
- Crea los servicios desde el panel

> **Cuándo usar Dokploy:** Ideal para gestionar múltiples proyectos en el mismo VPS con interfaz visual.

> **Cuándo usar solo Docker Compose:** Ideal para un único proyecto o cuando quieres control total desde terminal.

---

## 5. Estructura de un Proyecto Dockerizado

### Proyecto típico full-stack:
```
mi-proyecto/
├── docker-compose.yml          ← Orquesta todos los servicios
├── server/
│   ├── Dockerfile              ← Como construir el backend
│   ├── src/
│   └── .env.example            ← Plantilla de variables (commitear esto)
├── web/
│   ├── Dockerfile              ← Como construir el frontend
│   ├── nginx.conf              ← Config del servidor web interno
│   └── src/
└── .gitignore                  ← Debe incluir .env y node_modules
```

### Dockerfile Backend (Node.js):
```dockerfile
FROM node:20-alpine

WORKDIR /app

# Instalar dependencias del sistema si se necesitan
RUN apk add --no-cache openssl

COPY package*.json ./
RUN npm install --production

COPY . .

# Si usas Prisma:
RUN npx prisma generate

EXPOSE 4000

CMD ["node", "src/index.js"]
```

### Dockerfile Frontend (React + Nginx):
```dockerfile
# Etapa 1: Build
FROM node:20-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# Etapa 2: Servir con Nginx
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### nginx.conf para SPA con backend:
```nginx
upstream backend_api {
    # IMPORTANTE: usar el nombre del contenedor del backend
    server nombre-del-backend:4000;
}

server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    client_max_body_size 50M;

    # Proxy al backend para rutas de API
    location ~ ^/(api|auth|uploads|health) {
        proxy_pass http://backend_api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }

    # SPA routing - siempre devolver index.html
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

---

## 6. Desplegar con Docker Compose (sin panel)

### docker-compose.yml completo:
```yaml
services:
  # Base de datos MySQL
  mysql:
    image: mysql:8.0
    container_name: miapp-mysql
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: ${DB_PASSWORD}
      MYSQL_DATABASE: ${DB_NAME}
    volumes:
      - mysql_data:/var/lib/mysql
    networks:
      - app-net
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-p${DB_PASSWORD}"]
      interval: 10s
      timeout: 5s
      retries: 10

  # Backend API
  backend:
    build:
      context: ./server
      dockerfile: Dockerfile
    container_name: miapp-backend
    restart: unless-stopped
    env_file: ./server/.env
    depends_on:
      mysql:
        condition: service_healthy
    networks:
      - app-net
      - dokploy-network   # Necesario si usas Dokploy/Traefik

  # Frontend Web
  frontend:
    build:
      context: ./web
      dockerfile: Dockerfile
    container_name: miapp-frontend
    restart: unless-stopped
    networks:
      - app-net
      - dokploy-network   # Necesario si usas Dokploy/Traefik
    labels:
      # Labels para Traefik (HTTPS automático)
      - "traefik.enable=true"
      - "traefik.http.routers.miapp.rule=Host(`mi-dominio.com`)"
      - "traefik.http.routers.miapp.entrypoints=websecure"
      - "traefik.http.routers.miapp.tls.certresolver=letsencrypt"
      - "traefik.http.services.miapp.loadbalancer.server.port=80"
      - "traefik.http.routers.miapp-http.rule=Host(`mi-dominio.com`)"
      - "traefik.http.routers.miapp-http.entrypoints=web"
      - "traefik.http.middlewares.to-https.redirectscheme.scheme=https"
      - "traefik.http.routers.miapp-http.middlewares=to-https"

volumes:
  mysql_data:

networks:
  app-net:
    driver: bridge
  dokploy-network:
    external: true        # Red de Traefik/Dokploy ya existente
    name: dokploy-network
```

### Comandos de despliegue:
```bash
# 1. Clonar el proyecto en la VPS
mkdir -p /opt/mi-proyecto
cd /opt/mi-proyecto
git clone https://github.com/usuario/repositorio.git app
cd app

# 2. Crear el .env del backend
cp server/.env.example server/.env
nano server/.env       # Editar con tus valores reales

# 3. Levantar servicios
docker compose up -d

# 4. Ver logs
docker compose logs -f

# 5. Para BD con Prisma - crear tablas
docker exec miapp-backend npx prisma db push
# O con migraciones:
docker exec miapp-backend npx prisma migrate deploy

# 6. Ejecutar seed inicial
docker exec miapp-backend npx prisma db seed
```

---

## 7. Desplegar con Dokploy (con panel)

### Desde el panel web en http://TU_IP:3000:

**Paso 1 — Crear Proyecto:**
- Click en **"Create Project"**
- Nombre: `Mi Aplicación`

**Paso 2 — Crear servicio MySQL:**
- Tipo: `Database → MySQL`
- Variables:
  ```
  MYSQL_ROOT_PASSWORD=PasswordSegura123
  MYSQL_DATABASE=miapp
  ```

**Paso 3 — Crear servicio Backend:**
- Tipo: `Application → Docker (GitHub)`
- Repositorio: `usuario/repositorio`
- Rama: `master`
- Dockerfile: `server/Dockerfile`
- Build Context: `./server`
- Variables de entorno (en la sección "Environment"):
  ```
  DATABASE_URL=mysql://root:PasswordSegura123@nombre-mysql:3306/miapp
  JWT_SECRET=clave_super_secreta_minimo_32_caracteres
  PORT=4000
  NODE_ENV=production
  ```
- **NO asignar dominio público** al backend

**Paso 4 — Crear servicio Frontend:**
- Tipo: `Application → Docker (GitHub)`
- Dockerfile: `web/Dockerfile`
- Build Context: `./web`
- Build Arguments: `VITE_API_URL=` (vacío = mismo origen)
- **Asignar dominio:** `mi-dominio.com` o `miapp.IP.sslip.io`
- Puerto público: `80`

**Paso 5 — Inicializar BD:**
- Ve al servicio backend → Terminal
- Ejecuta: `npx prisma db push && npx prisma db seed`

---

## 8. Configurar HTTPS automático

### Opción A: sslip.io (sin registro, gratis, inmediato)
Usa el IP directamente en el dominio:
```
https://miapp.213.199.58.162.sslip.io
```
- ✅ No requiere registro
- ✅ HTTPS automático via Traefik + Let's Encrypt
- ❌ El IP aparece en la URL (no tan profesional)

En el label de Traefik:
```yaml
- "traefik.http.routers.miapp.rule=Host(`miapp.213.199.58.162.sslip.io`)"
- "traefik.http.routers.miapp.tls.certresolver=letsencrypt"
```

### Opción B: DuckDNS (subdominio gratis personalizado)
1. Entra a https://www.duckdns.org
2. Login con Google
3. Crea un subdominio: `miapp.duckdns.org`
4. Apunta al IP de tu VPS
5. En Traefik:
```yaml
- "traefik.http.routers.miapp.rule=Host(`miapp.duckdns.org`)"
- "traefik.http.routers.miapp.tls.certresolver=letsencrypt"
```

### Opción C: Dominio propio (.com, .pe, etc.)
1. Compra un dominio (Namecheap, GoDaddy, etc.)
2. En el panel DNS del registrador:
   - Crea registro `A`: `@` → `213.199.58.162`
   - Crea registro `A`: `www` → `213.199.58.162`
3. En Traefik:
```yaml
- "traefik.http.routers.miapp.rule=Host(`midominio.com`) || Host(`www.midominio.com`)"
- "traefik.http.routers.miapp.tls.certresolver=letsencrypt"
```

> ⏱️ Los DNS tardan 5-60 minutos en propagarse globalmente.

---

## 9. Dominios: Opciones Gratuitas y de Pago

| Opción | Ejemplo | Costo | Setup |
|:---|:---|:---|:---|
| **sslip.io** | `miapp.IP.sslip.io` | Gratis | Inmediato |
| **nip.io** | `miapp.IP.nip.io` | Gratis | Inmediato |
| **DuckDNS** | `miapp.duckdns.org` | Gratis | 5 min |
| **Freenom** | `miapp.tk` | Gratis* | 1-2 días |
| **Namecheap** | `miapp.com` | ~$10/año | 1-2 días |
| **GoDaddy** | `miapp.pe` | ~$15/año | 1-2 días |

> *Freenom ha tenido problemas de disponibilidad — preferir DuckDNS para dominios gratuitos.

---

## 10. Comandos de Mantenimiento

```bash
# ── Contenedores ──────────────────────────────────────────────
docker ps                          # Ver contenedores corriendo
docker ps -a                       # Ver todos (incluye detenidos)
docker stats --no-stream           # Uso de recursos
docker logs miapp-backend --tail 50 -f    # Logs en tiempo real
docker restart miapp-backend       # Reiniciar un contenedor

# ── Actualizaciones ───────────────────────────────────────────
cd /opt/mi-proyecto/app
git pull                           # Obtener última versión
docker compose build --no-cache backend  # Reconstruir backend
docker compose up -d --force-recreate backend  # Reiniciar con nueva imagen

# ── Base de Datos ─────────────────────────────────────────────
# Backup
docker exec miapp-mysql mysqldump -uroot -pPASSWORD miapp > backup_$(date +%Y%m%d).sql

# Restaurar
docker exec -i miapp-mysql mysql -uroot -pPASSWORD miapp < backup.sql

# Acceder a MySQL
docker exec -it miapp-mysql mysql -uroot -pPASSWORD miapp

# ── Limpieza ─────────────────────────────────────────────────
docker system prune -f             # Eliminar imágenes/containers sin uso
docker volume prune -f             # ⚠️ CUIDADO: elimina volúmenes no usados

# ── Red ──────────────────────────────────────────────────────
docker network ls                  # Ver redes
docker network connect dokploy-network miapp-frontend  # Conectar a red Traefik

# ── Dentro de un contenedor ───────────────────────────────────
docker exec -it miapp-backend sh   # Abrir shell
docker exec miapp-backend env      # Ver variables de entorno
```

---

## 11. Conectar desde tu PC con PowerShell

### Instalar el módulo SSH para PowerShell:
```powershell
Install-Module -Name Posh-SSH -Force -Scope CurrentUser
```

### Script para ejecutar comandos remotos:
```powershell
Import-Module Posh-SSH

$VPS_IP   = "TU_IP"
$VPS_USER = "root"
$VPS_PASS = "TU_PASSWORD"

$pass  = ConvertTo-SecureString $VPS_PASS -AsPlainText -Force
$cred  = New-Object System.Management.Automation.PSCredential($VPS_USER, $pass)
$sess  = New-SSHSession -ComputerName $VPS_IP -Credential $cred -AcceptKey -Force

function SSH { param([string]$cmd, [int]$timeout = 120)
    $r = Invoke-SSHCommand -SessionId $sess.SessionId -Command $cmd -TimeOut $timeout
    if ($r.Output) { Write-Host ($r.Output -join "`n") }
}

# Ejecutar comandos remotamente:
SSH "docker ps"
SSH "cd /opt/mi-proyecto/app && git pull && docker compose up -d --build" 600

Remove-SSHSession -SessionId $sess.SessionId | Out-Null
```

### Script de deploy automatizado desde PC:
```powershell
# deploy.ps1 - Guardar en la raíz del proyecto

Import-Module Posh-SSH

# Config
$VPS_IP    = "213.199.58.162"
$VPS_USER  = "root"
$VPS_PASS  = "TU_PASSWORD"
$APP_PATH  = "/opt/mi-proyecto/app"
$SERVICE   = "backend"   # El servicio a actualizar

# Conectar
$pass  = ConvertTo-SecureString $VPS_PASS -AsPlainText -Force
$cred  = New-Object System.Management.Automation.PSCredential($VPS_USER, $pass)
$sess  = New-SSHSession -ComputerName $VPS_IP -Credential $cred -AcceptKey -Force

function SSH { param([string]$cmd, [int]$to = 300)
    $r = Invoke-SSHCommand -SessionId $sess.SessionId -Command $cmd -TimeOut $to
    if ($r.Output) { Write-Host ($r.Output -join "`n") }
}

Write-Host "Pusheando a GitHub..." -ForegroundColor Cyan
git add -A
git commit -m "deploy: $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
git push origin master

Write-Host "Actualizando VPS..." -ForegroundColor Cyan
SSH "cd $APP_PATH && git pull 2>&1 | tail -3"
SSH "cd $APP_PATH && docker compose build --no-cache $SERVICE 2>&1 | tail -5" 600
SSH "cd $APP_PATH && docker compose up -d --force-recreate $SERVICE 2>&1 | tail -5"

Write-Host "Deploy completado!" -ForegroundColor Green
SSH "docker ps --format 'table {{.Names}}\t{{.Status}}'"

Remove-SSHSession -SessionId $sess.SessionId | Out-Null
```

---

## 12. Plantillas Rápidas

### Stack: Node.js + React + PostgreSQL
```yaml
services:
  postgres:
    image: postgres:16
    container_name: miapp-postgres
    restart: unless-stopped
    environment:
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - app-net

  backend:
    build: ./server
    container_name: miapp-backend
    restart: unless-stopped
    env_file: ./server/.env
    depends_on:
      - postgres
    networks:
      - app-net
      - dokploy-network

  frontend:
    build: ./web
    container_name: miapp-frontend
    restart: unless-stopped
    networks:
      - app-net
      - dokploy-network
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.miapp.rule=Host(`miapp.IP.sslip.io`)"
      - "traefik.http.routers.miapp.entrypoints=websecure"
      - "traefik.http.routers.miapp.tls.certresolver=letsencrypt"
      - "traefik.http.services.miapp.loadbalancer.server.port=80"

volumes:
  postgres_data:

networks:
  app-net:
  dokploy-network:
    external: true
    name: dokploy-network
```

### Stack: Solo API (sin frontend)
```yaml
services:
  api:
    build: .
    container_name: miapi
    restart: unless-stopped
    env_file: .env
    networks:
      - dokploy-network
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.miapi.rule=Host(`api.IP.sslip.io`)"
      - "traefik.http.routers.miapi.entrypoints=websecure"
      - "traefik.http.routers.miapi.tls.certresolver=letsencrypt"
      - "traefik.http.services.miapi.loadbalancer.server.port=3000"

networks:
  dokploy-network:
    external: true
    name: dokploy-network
```

---

## ⚠️ Errores Comunes y Soluciones

| Error | Causa | Solución |
|:---|:---|:---|
| `host not found in upstream` | nginx.conf tiene hostname incorrecto | Usar el `container_name` exacto del backend |
| `502 Bad Gateway` | El backend no inició aún | Esperar 10-15s y refrescar |
| `certificate resolver not found` | Nombre de certresolver incorrecto | Usar `letsencrypt` (no `dokploy`) |
| `network sandbox not found` | Contenedor no en red de Traefik | `docker network connect dokploy-network CONTENEDOR` |
| `Cannot connect to database` | Backend inició antes que la BD | Agregar `healthcheck` a la BD y `depends_on: condition: service_healthy` |
| Imagen vieja después de git pull | Docker usa cache | `docker compose build --no-cache` |
| `.env` no cargado | El archivo no existe en VPS | Crear el `.env` manualmente en el servidor |

---

## 🔐 Buenas Prácticas de Seguridad

```bash
# 1. Nunca subir .env a GitHub
echo ".env" >> .gitignore
echo "*.env" >> .gitignore

# 2. Usar contraseñas fuertes (generar):
openssl rand -base64 32   # Para JWT_SECRET
openssl rand -base64 24   # Para passwords de BD

# 3. Cambiar contraseña root de la VPS después del primer acceso
passwd

# 4. Crear usuario no-root para SSH (recomendado para producción)
adduser deployer
usermod -aG docker deployer
usermod -aG sudo deployer

# 5. Deshabilitar acceso root por SSH (después de crear otro usuario)
# En /etc/ssh/sshd_config:
# PermitRootLogin no
```

---

*Guía creada para el ecosistema de proyectos de Amilcar Cedano — Mayo 2026*

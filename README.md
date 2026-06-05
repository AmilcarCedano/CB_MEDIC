# CBMedic — Gestión de Farmacia

Sistema integral para la gestión de ventas, inventario, caja y clientes para farmacias.

**Stack:** React + Vite · Express + Prisma · MySQL · Docker · JWT

---

## Funcionalidades

- Autenticación con roles (Admin Global / Admin Farmacia / Vendedor)
- Gestión de farmacias, productos e inventario
- Categorías maestras y por farmacia
- Caja: apertura, cierre, movimientos
- Clientes con búsqueda RENIEC (DNI)
- Envíos entre farmacias (borrador / cotizado / aplicado)
- Scanner de código de barras (móvil y escritorio)
- Exportación Excel
- Ofertas y reglas de cross-selling

---

## Estructura del proyecto

```
cbmedic/
├── web/                    # Frontend React + Vite + Tailwind
│   ├── src/                # Componentes y páginas
│   ├── nginx.conf          # Proxy reverso en producción
│   └── Dockerfile
│
├── server/                 # Backend Express + Prisma
│   ├── src/                # Rutas, middleware, lógica
│   ├── prisma/             # Schema MySQL + migrations
│   ├── .env                # Variables de entorno (no commitear)
│   └── Dockerfile
│
├── docs/                   # Documentación
├── docker-compose.yml      # Dev local
└── package.json            # Scripts raíz
```

---

## Setup local

```bash
# 1. Instalar dependencias
cd server && npm install
cd ../web && npm install

# 2. Configurar server/.env
DATABASE_URL="mysql://root:PASSWORD@localhost:3306/cbmedic"
JWT_SECRET="tu_clave_secreta"
PORT=4000
NODE_ENV=development
ADMIN_MASTER_PASSWORD="tu_password_admin"
RENIEC_API_URL="https://api-codart.cgrt.org"
RENIEC_API_TOKEN="tu_token_reniec"

# 3. Crear tablas
cd server && npx prisma db push

# 4. Seed inicial (datos de prueba)
npm run db:seed

# 5. Iniciar
cd server && npm run dev    # http://localhost:4000
cd web && npm run dev        # http://localhost:5173
```

---

## API

Rutas principales expuestas por el backend (port 4000):

| Recurso | Ruta |
|---|---|
| Auth | `/auth` |
| Farmacias | `/farmacias` |
| Productos | `/products` |
| Maestro | `/master` |
| Categorías | `/categories` |
| Caja | `/caja` |
| Clientes | `/clientes` |
| Envíos | `/envios` |
| Usuarios | `/users` |
| RENIEC | `/reniec` |
| Health | `/health` |

En producción la API no está expuesta directamente — nginx la proxea internamente.

---

## Documentación

| Archivo | Contenido |
|---|---|
| `docs/CBMedic_Report.md` | Arquitectura detallada del sistema |
| `docs/PRUEBA_RAPIDA.md` | Guía de testing de features |
| `docs/DOKPLOY_GUIDE.md` | VPS, SSH, credenciales ⚠️ gitignored |
| `docs/DOCKER_VPS_GUIDE.md` | Referencia general Docker + VPS |

---

## Producción (VPS Contabo)

Desplegado en Contabo con Docker Compose + Traefik (HTTPS automático).

| Servicio | URL |
|---|---|
| Aplicación | https://cbmedic.duckdns.org |

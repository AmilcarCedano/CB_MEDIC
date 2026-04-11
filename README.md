# CBMedic - Gestión de Farmacia

Sistema integral para la gestión de ventas, inventario, caja y clientes para farmacias.

## 🚀 Despliegue en VPS (Dokploy)

Para desplegar este proyecto en un VPS usando Dokploy, sigue nuestra **[Guía Maestra de Despliegue](./DOKPLOY_GUIDE.md)**. 

Esta guía incluye:
1. Cómo exportar tu base de datos local.
2. Cómo configurar las variables de entorno en Dokploy.
3. Cómo realizar el despliegue automático desde GitHub.

---

## Estructura del Proyecto

- `/server`: API Backend desarrollada en Node.js, Express y Prisma (MySQL).
- `/web`: Frontend desarrollado en React, Vite y Tailwind CSS.

## Despliegue en VPS (Dokploy)

Este proyecto está configurado para desplegarse fácilmente en **Dokploy** usando Docker.

### 1. Preparación del Entorno
Configura las variables de entorno en el panel de Dokploy basándote en los archivos `.env.example` en cada carpeta:

**Backend (Server):**
- `DATABASE_URL`: URL de conexión a tu base de datos MySQL (ej: `mysql://root:password@mysql-service:3306/cbmedic`)
- `JWT_SECRET`: Una clave segura para los tokens de acceso.

**Frontend (Web):**
- `VITE_API_URL`: La URL pública donde se aloja tu backend.

### 2. Base de Datos
1. Exporta tu base de datos local usando `mysqldump`.
2. Crea un servicio de MySQL en Dokploy.
3. Importa el archivo `.sql` generado.

### 3. Dockerización
El proyecto incluye `Dockerfile` para ambos servicios, lo que permite a Dokploy compilarlos y ejecutarlos automáticamente desde GitHub.

---

## Desarrollo Local

1. Instala dependencias:
   ```bash
   cd server && npm install
   cd ../web && npm install
   ```
2. Ejecuta en modo desarrollo:
   - Server: `cd server && npm run dev`
   - Web: `cd web && npm run dev`

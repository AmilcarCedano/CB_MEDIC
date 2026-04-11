# Guía Maestra de Despliegue en Dokploy - CBMedic

Esta guía te llevará paso a paso desde tu computadora local hasta tener tu sistema de farmacia funcionando en tu VPS con **Dokploy**.

---

## Paso 1: Exportar tu Base de Datos Local
Antes de subir nada, necesitamos una copia de tus datos actuales.
1. Ve a la carpeta `deploy_tools/` en tu proyecto.
2. Ejecuta el archivo `export_db.bat`.
3. Esto generará un archivo llamado `cbmedic_backup.sql`. **Guárdalo bien**, lo usaremos en el Paso 4.

---

## Paso 2: Subir tu Código a GitHub
1. Crea un nuevo repositorio **Privado** en tu cuenta de GitHub.
2. Sube toda la carpeta `cbmedic` (la que acabamos de organizar).
   > [!NOTE]
   > No te preocupes por el archivo `.env`, mi configuración ya lo ignora automáticamente para que tus claves no queden públicas.

---

## Paso 3: Configurar el "Stack" en Dokploy
Dokploy permite desplegar todo el proyecto usando el archivo `docker-compose.yml` que te preparé.

1. Entra a tu panel de **Dokploy**.
2. Haz clic en **"Create Stack"**.
3. Dale un nombre (ej: `cbmedic-sistema`).
4. Selecciona tu repositorio de GitHub y la rama (usualmente `main` o `master`).
5. Dokploy leerá el archivo `docker-compose.yml` y te pedirá las **Variables de Entorno**.

---

## Paso 4: Configurar Variables de Entorno
Aquí es donde pondrás la información que te mostré en los archivos `.env.example`. En el panel de Dokploy, verás una sección para escribir estas claves:

### Para el Backend (Procesamiento y Base de Datos)
| Clave | Valor de Ejemplo | Descripción |
| :--- | :--- | :--- |
| `DATABASE_URL` | `mysql://root:contrasena@mysql-db:3306/cbmedic` | La dirección de tu base de datos en el VPS. |
| `JWT_SECRET` | `una_clave_larga_y_segura_123` | Se usa para proteger las sesiones de usuario. |

### Para el Frontend (Pantallas y UI)
| Clave | Valor de Ejemplo | Descripción |
| :--- | :--- | :--- |
| `VITE_API_URL` | `http://tu-vps-ip:4000` | La dirección IP de tu servidor donde corre el backend. |

---

## Paso 5: Preparar la Base de Datos en el VPS
1. En Dokploy, crea un servicio de **MySQL**.
2. Una vez creado, entra a la base de datos y usa la función de **Importar**.
3. Sube el archivo `cbmedic_backup.sql` que generamos en el Paso 1.
4. **Importante**: Asegúrate de que los datos de acceso (usuario y contraseña) del MySQL de Dokploy coincidan con lo que pusiste en la variable `DATABASE_URL`.

---

## Paso 6: Desplegar (Deploy)
1. Con las variables puestas y la base de datos lista, haz clic en **"Deploy"** en Dokploy.
2. Dokploy comenzará a:
   - Descargar tu código de GitHub.
   - Construir el Servidor (Backend).
   - Compilar el Frontend (Vite) y montarlo en un servidor Nginx rápido.
   - Conectar todo automáticamente.

---

## Resumen de Ubicación de Configuraciones
- **Backend**: Configurado vía `server/Dockerfile`.
- **Frontend**: Configurado vía `web/Dockerfile`.
- **Orquestación**: Todo se une mediante el archivo `docker-compose.yml` en la raíz.

¡Listo! Si sigues estos pasos, tu sistema estará en línea y seguro.

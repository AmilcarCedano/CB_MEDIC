# Análisis del Proyecto CBMedic

Este documento ofrece un análisis del proyecto CBMedic, abarcando el backend, el frontend y el esquema de base de datos.

## Backend (`server/`)

El backend es una aplicación de Node.js construida con el framework Express.js.

* **Framework**: Express.js
* **Base de datos**: MySQL con Prisma como Object-Relational Mapper (ORM). El esquema de la base de datos está definido en `prisma/schema.prisma`.
* **Autenticación**: Implementa autenticación basada en JSON Web Token (JWT) usando `jsonwebtoken` para crear y verificar tokens, y `bcryptjs` para el hash de contraseñas.
* **Rutas de la API**: El servidor expone una API REST con los siguientes recursos:

  * `/auth`: Autenticación de usuarios.
  * `/caja`: Gestión de caja.
  * `/categories`: Categorías de productos.
  * `/envios`: Envíos.
  * `/farmacias`: Gestión de farmacias.
  * `/health`: Endpoint de verificación de estado (health check).
  * `/master`: Datos maestros de productos.
  * `/products`: Gestión de productos.
  * `/reniec`: Integración con RENIEC (Registro Nacional de Identificación y Estado Civil del Perú).
  * `/users`: Gestión de usuarios.
* **Middleware**:

  * `cors`: Habilita el uso compartido de recursos de origen cruzado (CORS).
  * `helmet`: Agrega varios encabezados de seguridad.
  * `morgan`: Registra las solicitudes HTTP.
* **Scripts**:

  * `dev`: Ejecuta el servidor en modo desarrollo con `nodemon` para reinicios automáticos.
  * `start`: Ejecuta el servidor en modo producción.
  * `prisma:generate`: Genera el cliente de Prisma.
  * `prisma:push`: Aplica los cambios del esquema a la base de datos.
  * `prisma:studio`: Abre Prisma Studio para ver y editar datos.
  * `db:seed`: Inserta datos iniciales en la base de datos.
* **Dependencias clave**: `express`, `@prisma/client`, `jsonwebtoken`, `bcryptjs`, `cors`, `helmet`, `morgan`, `dotenv`.

## Frontend (`web/`)

El frontend es una aplicación de una sola página (SPA) construida con React.

* **Framework**: React.js con Vite como herramienta de construcción.
* **Enrutamiento**: `react-router-dom` se utiliza para el enrutamiento del lado del cliente.
* **Estilos**: Se utiliza Tailwind CSS para los estilos, configurado en `tailwind.config.js`.
* **Comunicación con la API**: `axios` se utiliza para realizar solicitudes HTTP al backend. El cliente de la API está configurado en `src/lib/api.js`. La URL base de la API es `http://localhost:4000` por defecto y puede configurarse mediante la variable de entorno `VITE_API_URL`. Incluye una función para establecer el encabezado `Authorization` con el JWT en solicitudes autenticadas.
* **Dependencias clave**: `react`, `react-dom`, `react-router-dom`, `axios`, `lucide-react` para íconos y `xlsx` para manejo de archivos de Excel.
* **Herramientas de desarrollo**: `vite`, `eslint` para linting, `autoprefixer` y `postcss` para el procesamiento de CSS.

## Base de datos (`prisma/schema.prisma`)

El esquema de la base de datos está definido con Prisma e incluye los siguientes modelos:

* **`User`**: Almacena información de usuario, incluyendo nombre de usuario, hash de contraseña, rol (`ADMIN` o `VENDEDOR`) y farmacia asociada.
* **`Horario`**: Define los horarios laborales de los usuarios.
* **`Farmacia`**: Representa una farmacia con sus detalles.
* **`Caja`**: Administra cajas, incluyendo montos de apertura y cierre.
* **`Cliente`**: Almacena información de clientes.
* **`Categoria`**: Define categorías de productos, que pueden ser específicas de una farmacia o categorías maestras.
* **`Producto`**: Representa productos en el inventario de una farmacia.
* **`ProductoMaestro`**: Lista maestra de productos.
* **`MasterImportLog`**: Registros de importaciones de datos maestros de productos.
* **`Envio`**: Gestiona envíos con estados como `BORRADOR`, `COTIZADO`, `APLICADO`.
* **`EnvioItem`**: Representa ítems dentro de un envío.

El esquema define relaciones entre estos modelos, como un `User` que pertenece a una `Farmacia`, y un `Producto` que pertenece a una `Categoria` y a una `Farmacia`.

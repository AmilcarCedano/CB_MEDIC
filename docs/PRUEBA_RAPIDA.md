# ⚡ Guía Rápida de Prueba – Reglas por Producto

## Paso 1: Arranca backend y frontend

`powershell
cd c:\Users\ANDERSON\IdeaProjects\cbmedic\server
node src/index.js    # API en http://localhost:4000

cd c:\Users\ANDERSON\IdeaProjects\cbmedic\web
npm run dev          # Frontend en http://localhost:5173
`

Inicia sesión como dmin.

---

## Paso 2: Revisa la pantalla de Ofertas

1. Ve a **Dashboard Admin → Ofertas**.
2. Deberías ver:
   - Título “Gestión de Reglas de Venta”.
   - Botón “Crear Regla”.
   - Tarjeta “Puntos de Lealtad” con los campos para soles/punto y valor por punto.
   - Tabla con las reglas existentes (si ya configuraste alguna).

---

## Paso 3: Crea una regla producto → producto

1. Haz clic en **“Crear Regla”**.
2. Llena el formulario:
   - **Producto disparador**: por ejemplo “Amoxicilina 500 mg”.
   - **Producto sugerido**: por ejemplo “Protector gástrico XYZ”.
   - **Mensaje**: “Evita molestias estomacales ofreciendo este protector”.
   - **Prioridad**: 8.
   - Marca “Activada”.
3. Guarda. La regla aparece en la tabla con ambas descripciones.

> Puedes crear tantas como desees; todas apuntan a productos reales, no a etiquetas.

---

## Paso 4: Ajusta los puntos de lealtad

1. En la tarjeta ⭐ define:
   - “S/ para 1 punto” (ej. 12).
   - “Valor del punto” (ej. 0.15).
2. Activa/desactiva el programa según lo necesites y guarda.

El POS usará estos valores para permitir canjes y acumular puntos automáticamente.

---

## Paso 5: Valida en el POS

1. Ve a **Vendedor → POS**.
2. Agrega al carrito el producto disparador configurado.
3. El panel derecho (“Alertas de Venta”) debe mostrar:

`
💡 SUGERENCIA
Evita molestias estomacales ofreciendo este protector
[Agregar Protector gástrico XYZ]
`

4. Haz clic en el botón para agregarlo y completa la venta.

> Las sugerencias también mostrarán otras presentaciones del mismo principio activo cuando existan en inventario.

---

## Checklist de validación

### ✅ Frontend
- [ ] Página Ofertas carga sin errores.
- [ ] Tabla de reglas lista productos, no etiquetas.
- [ ] Modal de creación/edición funciona con productos reales.
- [ ] Tarjeta de lealtad guarda/recupera valores.
- [ ] POS muestra banners al aplicar reglas.

### ✅ Backend
- [ ] GET /ofertas devuelve reglas con 	riggerProducto/sugeridoProducto.
- [ ] POST /ofertas crea reglas con 	riggerProductoId y sugeridoProductoId.
- [ ] GET /ofertas/lealtad / POST /ofertas/lealtad funcionan.
- [ ] POST /sales/suggestions devuelve sugerencias sin errores de Prisma.

### ✅ Base de datos
- [ ] Tabla eglas_venta_cruzada sólo tiene columnas 	riggerProductoId y sugeridoProductoId.
- [ ] Tabla configuracion_lealtad contiene la fila de la farmacia.
- [ ] No existen tablas etiquetas ni producto_etiqueta.

---

## SQL útiles

`sql
-- Ver reglas
SELECT id, triggerProductoId, sugeridoProductoId, prioridad, mensaje
FROM reglas_venta_cruzada;

-- Crear una regla manualmente (ejemplo)
INSERT INTO reglas_venta_cruzada (farmaciaId, triggerProductoId, sugeridoProductoId, prioridad, mensaje)
VALUES (1, 10, 15, 8, 'Se complementan para acelerar la recuperación');

-- Configuración de lealtad
SELECT * FROM configuracion_lealtad;
`

---

Listo. Con esto confirmas que el sistema de venta cruzada quedó completamente basado en productos. 🎯

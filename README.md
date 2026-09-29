# Delicia · Prototipo

Sitio estático en español con cinco escenas de producto, perspectiva CSS 3D y animación sincronizada con scroll nativo. Sin framework ni dependencias JavaScript.

## Tienda en línea (demostración)

Además de la landing, el sitio incluye una tienda completa que funciona sin servidor:

| Ruta | Qué es |
| --- | --- |
| `/` | Landing. Cada cerveza tiene botón **Comprar**; el encabezado lleva a la tienda y al carrito. |
| `/tienda/` | Las cinco cervezas por **unidad, six, 12, 18 o caja de 24**, con descuento por volumen. |
| `/checkout/` | Pago en tres pasos: celular verificado, entrega (domicilio o recolección) y tarjeta. |
| `/cuenta/` | «Mis pedidos»: seguimiento en vivo de cada pedido. |
| `/admin/` | **Back office** para Cervecería Backhoff: pedidos en tiempo real, productos y clientes. |

### Cómo probarla

1. Abre `/admin/` y entra con el PIN de demostración **2020**.
2. En otra pestaña del mismo navegador abre `/tienda/`, agrega cervezas y ve a pagar.
3. Escribe cualquier celular de 10 dígitos y elige WhatsApp o SMS. El código llega como notificación simulada en pantalla (botón **Usar código**). Si es la primera vez, pide nombre y confirmación de mayoría de edad. No se usa correo.
4. Paga con una tarjeta de prueba, con vencimiento futuro y cualquier CVV:
   - `4242 4242 4242 4242` (Visa) y `5555 5555 5555 4444` (Mastercard): aprobadas.
   - `4000 0000 0000 0002`: rechazada; `4000 0000 0000 9995`: fondos insuficientes.
5. En el back office el pedido aparece al instante con aviso y sonido. Al avanzarlo (preparando → en camino o listo para recoger → entregado) o cancelarlo, la pestaña del cliente recibe el aviso simulado por WhatsApp o SMS y su seguimiento se actualiza.

En **Productos** se cambia el precio por botella y la disponibilidad (agotada); la tienda se actualiza en vivo. **Restablecer demo** (menú del back office) vuelve a los 12 pedidos de ejemplo, que usan teléfonos con prefijo 555 y tienen el contacto deshabilitado.

### Reglas de negocio de ejemplo

Se editan en `dist/shop/data.js`:

- Precios por botella de 355 ml: $60 a $70 MXN (ajustables desde el back office).
- Descuentos: six −5 %, 12 −8 %, 18 −10 % y caja de 24 −15 %, redondeado a múltiplos de $5.
- Envío a Delicias y Meoqui: $60, gratis desde $800. Recolección en la cervecería sin costo.

### Cómo está hecha

Módulos ES nativos, sin compilación ni dependencias:

- `dist/shop/data.js`: catálogo, presentaciones, precios, envío y estados del pedido (la landing también lo usa).
- `dist/shop/util.js`: formato de dinero, teléfonos y fechas; validación de tarjetas (Luhn, marca, vencimiento).
- `dist/shop/store.js`: almacenamiento, carrito, sesión y avisos entre pestañas (evento `storage`).
- `dist/shop/api.js`: **backend simulado**. Códigos por SMS/WhatsApp, registro, cobro, pedidos y funciones del back office. Recalcula precios con su catálogo y guarda de la tarjeta solo la marca y los últimos 4 dígitos.
- `dist/shop/ui.js`: carrito, compra rápida, acceso con celular, avisos y seguimiento.
- `dist/shop/tienda.js`, `checkout.js`, `cuenta.js` y `dist/admin/admin.js`: una por página.
- `dist/assets/tienda/*.webp`: botellas recortadas con el mismo trazo de la landing (unos 27 KB cada una).

Pruebas de precios, validaciones, verificación, pedidos y back office (Node 22, sin dependencias):

```sh
node --test
```

### Límites de la demostración

- Todo se guarda en el `localStorage` del navegador. El back office ve los pedidos hechos **en ese mismo navegador** (otra pestaña o ventana), no los de otro dispositivo.
- No se envían SMS ni WhatsApp y no se hace ningún cargo. No escribas datos de una tarjeta real.
- El PIN del back office solo separa las vistas; no es seguridad real.

### Para ponerla en producción

`api.js` ya tiene la forma de las llamadas a un servidor; basta con reemplazar su interior por `fetch()` a una API propia:

- **Verificación por celular:** Twilio Verify, o la API de WhatsApp Business con plantillas de autenticación, con SMS como respaldo.
- **Pagos con tarjeta:** Stripe, Conekta, Openpay o Mercado Pago, capturando la tarjeta con sus campos seguros (tokenización y 3-D Secure) para no manejar datos de tarjeta en el sitio.
- **Base de datos** para pedidos, clientes y catálogo, y avisos al back office por tiempo real o notificaciones push.
- **Back office** con usuarios, contraseñas y permisos validados en el servidor.
- Legal: aviso de privacidad, términos de venta, verificación de mayoría de edad al entregar y horarios de venta de alcohol de cada municipio.

## Vista local

```sh
python3 -m http.server 4173 --directory dist
```

Abre http://localhost:4173. Los archivos de publicación están en `dist/`.

## Edición

- `dist/index.html`: portada, navegación y cierre.
- `dist/style.css`: diseño, colores, tipografía y reglas responsivas.
- `dist/app.js`: productos, máscaras de fotografía y coreografía de movimiento.

Las botellas usan las fotografías oficiales intactas, recortadas visualmente con SVG. La rotación es una ilusión de perspectiva (2.5D), no un modelo volumétrico con etiqueta posterior. La animación usa requestAnimationFrame con interpolación dependiente del tiempo, observación de visibilidad y transformaciones por GPU. Respeta prefers-reduced-motion y mantiene el desplazamiento nativo.

## Fuentes

Información e imágenes: https://cervezadelicia.com/inicio/.
Pionera: /wp-content/uploads/2026/04/Publicidad-Pionera-Vertical.png.
Resto: /wp-content/uploads/2023/10/{Monito-2,Red,Porter,Pale-Ale}.png.
Tipografías: Barlow Condensed y DM Sans, Google Fonts.

## Historia y puntos de venta

La sección `#nosotros`, antes de las cervezas, resume la historia publicada en https://cervezadelicia.com/nosotros/. Fotografía oficial: https://cervezadelicia.com/wp-content/uploads/2022/07/FotoCerveceria2-1.jpg.

La sección `#clientes`, después de las cervezas, incluye los 17 establecimientos publicados en https://cervezadelicia.com/, agrupados por Delicias y Meoqui. Los enlaces de mapa realizan búsquedas por nombre y dirección; no se afirma disponibilidad de inventario en tiempo real.

## Despliegue en Vercel

Importa este repositorio con la raíz del proyecto en `.` (sin seleccionar `dist` como Root Directory). El archivo `vercel.json` configura un sitio estático, sin instalación ni compilación, y publica el contenido de `dist/`.

- Framework Preset: **Other**.
- Root Directory: **raíz del repositorio**.
- Output Directory: **dist**.
- Build Command e Install Command: vacíos.

Con la integración de GitHub, cada push a `main` genera una nueva publicación y cada push a otra rama (por ejemplo `tienda-en-linea`) genera una publicación de vista previa con su propia URL. Si aparece `404 NOT_FOUND`, comprueba que el despliegue incluya `vercel.json` y que la raíz del proyecto no se haya cambiado. La página se sirve en `/`, con imágenes en `/assets/`, estilos en `/style.css` y JavaScript en `/app.js`.

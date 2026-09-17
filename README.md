# Delicia · Prototipo

Sitio estático en español con cinco escenas de producto, perspectiva CSS 3D y animación sincronizada con scroll nativo. Sin framework ni dependencias JavaScript.

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

# ADR 0009 — Fotos de la landing en Cloudinary, con subida firmada desde el navegador

**Fecha:** 2026-10  ·  **Estado:** aceptada (reemplaza el punto 2 de ADR 0004)

## Contexto

ADR 0004 dejó las fotos de salones y servicios como una URL externa que el administrador pegaba en
el panel: no había dónde guardar archivos. En la práctica, Fran tiene las fotos en su celular o su
compu, no en una URL, y tener que subirlas a otro lado para copiar el enlace no es usable.

Guardar la imagen en la base no es una opción: ocupa mucho espacio en el plan de Neon y cada
listado tendría que cargar los bytes. El equipo creó una cuenta de Cloudinary (plan gratis: 10 MB
por imagen) para alojarlas.

## Decisión

Fran elige la foto de su galería y **el navegador la sube directo a Cloudinary**; la base sigue
guardando solo `fotoUrl`, ahora con la URL que devuelve Cloudinary.

1. `POST /api/fotos/firma` (personal) devuelve una **firma** de Cloudinary para subir a
   `confluens/salones` o `confluens/servicios`, con una transformación que limita la imagen a
   1920 px. El secreto (`CLOUDINARY_API_SECRET`) nunca sale de la API.
2. El navegador sube el archivo a Cloudinary con esa firma y manda la `secure_url` al
   `PATCH /:id/landing` de siempre. Elegir el archivo sube y guarda de una: no hay un paso
   "Guardar" que pueda dejar fotos subidas sin usar.
3. Al cambiar o quitar una foto, la API **borra la anterior** de Cloudinary después de guardar
   (decisión del PO, 07/10/2026). Solo borra fotos de nuestra cuenta y carpeta `confluens/`; si
   Cloudinary falla, el cambio queda guardado y se registra en la consola.
4. Sin SDK: la firma es un SHA-1 con `node:crypto` y los llamados son `fetch` a la API HTTP de
   Cloudinary, igual que con Resend (ADR 0006). Las credenciales son `CLOUDINARY_CLOUD_NAME`,
   `CLOUDINARY_API_KEY` y `CLOUDINARY_API_SECRET`, leídas de `process.env` (ADR 0003).

5. Para mostrarlas, la web pide a Cloudinary una versión del ancho en pantalla, con formato y
   calidad automáticos (`f_auto,q_auto,c_limit,w_<ancho>`), y las carga en diferido
   (`loading="lazy"`). Lo que más consume el plan gratis es la descarga, no el espacio, y así cada
   visita baja varias veces menos. Las fotos de servicios también se muestran en la sección de
   gastronomía de la landing.

## Consecuencias

**A favor.** Las fotos no pasan por la API ni por la base: no hay middleware de uploads, ni límite
de tamaño de body en Render, ni bytes en Neon. Nadie puede subir a la cuenta sin una firma que solo
da la API a una sesión del personal. Cloudinary sirve las imágenes por CDN y achica las del celular.
`fotoUrl` no cambió de tipo, así que las URLs que ya estaban cargadas siguen funcionando.

**En contra.** Una dependencia externa más, con su cuenta y sus credenciales en `.env` y en
Render. El borrado de la foto anterior es best-effort: si falla, queda una foto huérfana en
Cloudinary. Y el PATCH de la landing espera la respuesta de Cloudinary al borrar, unos cientos de
milisegundos más.

**Alternativas descartadas.**

- *Upload preset sin firmar:* no necesita la API, pero cualquiera que lea el código de la web
  podría subir imágenes a la cuenta.
- *Subir el archivo a la API y de ahí a Cloudinary:* suma una dependencia para recibir archivos
  (multer) y hace pasar cada foto dos veces por la red, en un plan gratis de Render.
- *Guardar la imagen en la base:* es justamente lo que se quería evitar por espacio.

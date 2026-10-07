# ADR 0004 — Contenido público de la landing: rutas sin precios, fotos por URL y rol propio

**Fecha:** 2026-09  ·  **Estado:** aceptada

## Contexto

HU-07 pide que la landing muestre los salones y la oferta gastronómica reales, y HU-08 que alguien
del hotel decida desde adentro del sistema qué se publica y con qué foto. Antes de estas dos
historias la landing armaba las fichas con constantes escritas en el código
(`paginas/solicitudes/datos-presentacion.ts`), así que ningún cambio de datos en la base llegaba al
sitio público.

Tres restricciones condicionan el diseño:

- El canal público **no muestra precios**. La vista con precios sin IVA es para el cliente
  registrado y es del Sprint 2. Hasta entonces el tarifario (`docs/negocio/tarifario-2026.md`) es
  información comercial que no debería quedar expuesta a cualquiera que abra la landing.
- No hay infraestructura de almacenamiento de archivos ni presupuesto para sumarla en el Sprint 1:
  el despliegue es el de ADR 0001, sin bucket ni CDN.
- El `AuditLog` del modelo de datos existe desde el primer día pero todavía no lo escribe nadie: la
  historia que generaliza el registro de auditoría es HU-25, del Sprint 5.

## Decisión

1. El canal público se sirve por **rutas propias** — `GET /api/salones/publicos` y
   `GET /api/servicios/publicos` — con esquemas propios en `packages/shared`
   (`esquemaSalonPublico`, `esquemaServicioPublico`) y un `select` explícito de Prisma que **no
   incluye las columnas de precio**. Las rutas internas `GET /api/salones` y `GET /api/servicios`
   quedan intactas.
2. Las fotos se guardan como **`fotoUrl String?`**: una URL externa que el Administrador del
   Sistema pega en el formulario. No hay subida de archivos.
3. La administración del contenido público es de un **rol nuevo, `ADMINISTRADOR_SISTEMA`**, que ve
   todo lo del Gerente General y además la sección "Landing page".
4. Los dos `PATCH /:id/landing` escriben una fila en `audit_log` **dentro de la misma transacción**
   que el `update`, acotado a este caso y sin construir todavía el mecanismo general de HU-25.

## Consecuencias

**A favor.** Que el precio no esté en el `select` significa que no viaja por la red: no alcanza con
que la pantalla no lo pinte, el JSON de `/publicos` directamente no lo trae, y eso se verifica en
los tests de ruta sobre el body crudo (`respuesta.text`). La landing lee siempre de la base, así que
un cambio de datos de un salón se ve sin ningún paso de publicación manual (criterio 4 de HU-07 y
criterio 3 de HU-08) y no hay una copia publicada aparte que se pueda desincronizar. `fotoUrl` no
agrega dependencias, ni middleware de uploads, ni un lugar donde guardar bytes. Y auditar dentro de
la transacción evita el estado imposible de "el salón cambió pero nadie sabe quién lo cambió".

**En contra.** Cada campo nuevo que haya que mostrar en la landing se agrega en dos lugares: el
esquema interno y el público. Es duplicación a propósito — el día que alguien sume un campo
sensible, el canal público no se entera solo — pero es duplicación. Las fotos quedan atadas a un
hosting de terceros que el sistema no controla: si esa URL se cae o cambia, la landing muestra el
ícono de reemplazo y nadie se entera hasta que lo ve. El rol nuevo obliga a tocar
`SECCIONES_POR_ROL` y el seed cada vez que se agregue una pantalla. Y la escritura de auditoría
queda inline en `salones.repositorio.ts` / `servicios.repositorio.ts`: HU-25 va a tener que
recogerla y unificarla en vez de partir de cero.

**Alternativas descartadas.**

- *Un query param (`GET /salones?publico=true`) en vez de rutas separadas.* Se descartó porque el
  recorte de precios pasaría a depender de un parámetro que se puede olvidar: un bug en el front
  (o un `fetch` sin el flag) expondría el tarifario. Con rutas y esquemas distintos, publicar un
  precio requiere editar a mano el esquema público, que es exactamente la fricción que se busca.
- *Filtrar los precios en el front.* Peor todavía: el dato igual llega al navegador y se ve en la
  pestaña Network.
- *Subida de archivos con almacenamiento propio.* Fuera de alcance para el Sprint 1: implica
  storage, límites de tamaño, validación de tipo de archivo y un plan de backup. Si más adelante se
  quiere, `fotoUrl` sigue sirviendo — cambia quién genera la URL, no el modelo.
- *Reusar `GERENTE_GENERAL` para administrar la landing.* Se descartó porque mezcla dos
  responsabilidades distintas: el Gerente mira el negocio, no edita el sitio. Un rol propio hace que
  el 403 de `PATCH /:id/landing` sea una regla explícita y no un efecto colateral de la jerarquía.
- *Esperar a HU-25 para auditar.* La Definición de Terminado de HU-08 pide registrar quién cambió
  qué y cuándo; dejarlo para el Sprint 5 sería entregar la historia incompleta.

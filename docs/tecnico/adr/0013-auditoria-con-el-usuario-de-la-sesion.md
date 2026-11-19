# ADR 0013 — Auditoría en la transacción de cada repositorio, con el usuario de la sesión

**Fecha:** 2026-11 · **Estado:** aceptada

## Contexto

HU-25 del backlog (Sprint 5) pide registrar quién cambió qué y cuándo en **todo el panel interno**:
salones y distribuciones, landing, servicios y precios, medios de pago, clientes, consultas y
presupuestos, eventos, pagos y personal (PO, 06/11/2026). El registro tiene que escribirse en la
misma transacción que el cambio, ser inmutable, quedar a nombre del Sistema cuando actúa una tarea
programada o un recálculo, y poder filtrarse por el campo auditado en la pestaña Auditoría.

`AuditLog` existía desde el Sprint 1, pero solo lo escribían los dos `PATCH /:id/landing` (ADR 0004),
con el usuario pasado a mano por parámetro. `dominio.md` decía «middleware de Prisma»: Prisma 7 ya no
tiene `$use`, y una extensión `$extends` no ve ni el usuario ni el valor anterior.

Pasar el usuario por parámetro a cada escritura obligaba a tocar la firma de controladores, servicios
y repositorios de todos los módulos (presupuestos solo son unas 1200 líneas de servicio y 3000 de
tests), y a cambiar cientos de aserciones `toHaveBeenCalledWith` que no prueban nada de la auditoría.

## Decisión

1. **Un helper común, `apps/api/src/lib/auditoria.ts`.** Cada repositorio que escribe lee el valor
   anterior, escribe y llama a `registrarAuditoria(tx, { entidad, entidadId, anterior, nuevo })` con
   el `tx` de su transacción. Si la función recibe el cliente global en vez de una transacción,
   `enTransaccion` abre una. El helper guarda **solo los campos que cambiaron**, con los valores
   normalizados (Decimal a string con 2 decimales, Date a ISO), y nunca el hash de la contraseña:
   un cambio de contraseña queda como `contrasena: «(cambiada)»`. Las colecciones (líneas del
   presupuesto, salones del evento) se auditan como un campo más de su entidad, con la lista antes y
   después.
2. **El usuario sale del contexto de la petición.** `autenticar` corre el resto de la cadena dentro
   de un `AsyncLocalStorage` con el usuario y el rol de la sesión ya verificada. El orden para
   resolverlo es: un `usuarioId` explícito gana (`null` es el Sistema); si no viene, el de la
   sesión; **sin sesión ni usuario explícito, el helper falla**, para que un camino olvidado no
   quede auditado a nombre de nadie. El explícito se usa solo para forzar al Sistema (la tarea de
   vigencia, el recálculo por cambio de porcentaje) o donde ya existía el parámetro.
3. **El canal público no se audita.** Si la sesión es de un `CLIENTE`, el helper no escribe: el
   cotizador y la consulta social usan los mismos repositorios que el panel.
4. **`AuditLog.campos` (`text[]`, índice GIN)** guarda las claves que cambiaron, para filtrar por
   campo con `has` sin recorrer el JSON. La migración `20261107180000_auditoria` completa las filas
   que ya había desde sus claves.
5. **La base hace cumplir la inmutabilidad:** un trigger rechaza `UPDATE` y `DELETE` sobre
   `audit_log`.
6. **Consulta:** `GET /api/auditoria` (paginado, del más reciente al más antiguo, con filtros por
   campo, parte del sistema, usuario o Sistema y fechas de calendario en la zona de los eventos) y
   `GET /api/auditoria/campos`, solo para el GG y el ADM (`ROLES_QUE_VEN_AUDITORIA` en `shared`).

## Consecuencias

**A favor.** Las firmas de los módulos no cambiaron, y el actor nunca sale del body: no se puede
auditar a nombre de otro. La regla «sin actor, error» convierte un olvido en un fallo visible en
desarrollo en vez de un registro mal atribuido. Filtrar por campo es una consulta indexada. Ni el
código ni alguien con acceso directo a la base pueden reescribir la historia.

**En contra.** El contexto es implícito: quien lea un repositorio no ve de dónde sale el usuario y
tiene que conocer este ADR. Cada escritura auditada hace una lectura de más (el valor anterior). Una
escritura nueva que no llame al helper no queda auditada y nada lo avisa: hay que acordarse al sumar
módulos. Con el trigger, `audit_log` no se puede limpiar en una base de desarrollo sin desactivarlo
(`prisma migrate reset` sí sirve, porque borra el esquema). El recálculo por cambio de fecha queda a
nombre de quien modificó el presupuesto, porque viaja en el mismo pedido que su cambio; solo el
recálculo masivo por el porcentaje queda a nombre del Sistema.

**Alternativas descartadas.**

- *Pasar `usuarioId` por parámetro en todas las capas.* Es lo más explícito, pero el costo en firmas
  y tests no compraba nada: el valor siempre es el de la sesión.
- *Una extensión `$extends` de Prisma que audite toda escritura.* No ve el usuario sin el mismo
  contexto, no tiene a mano el `tx` para leer el valor anterior dentro de la transacción y
  auditaría también lo que no es del negocio (versión de sesión, tablas técnicas).
- *Filtrar por campo con el operador `?` de jsonb sobre `valorNuevo`.* Sin cambio de modelo, pero
  con SQL a mano en el repositorio y sin un índice simple. El PO eligió la columna (07/11/2026).
- *Triggers de PostgreSQL que auditen cada tabla.* La base no sabe qué usuario de la aplicación hizo
  el cambio sin pasárselo por una variable de sesión en cada transacción.

## Agregado: auditoría para Gerencia (15/11/2026)

Franco pidió llevar la pestaña Auditoría a tres vistas, diseñadas con Claude Design: un **Resumen**
para el Gerente General, un **Registro** filtrable con el detalle de cada cambio, y un **Historial**
dentro de cada consulta y evento. El feed de actividad por día quedó afuera.

**Cambio sensible.** Es el que toca plata o permisos. Las reglas viven en
`packages/shared/src/dominio/auditoria-sensible.ts` (`REGLAS_SENSIBLES`):

- un pago, cualquier cambio;
- el incremento de precios (`ConfiguracionPrecios`), cualquier cambio;
- el `precio` de un servicio;
- los precios de un salón;
- el `total` de un presupuesto;
- el `rol`, el `activo` o la contraseña de un usuario;
- el `activo` de un medio de pago.

La API arma el mismo criterio como `where` de Prisma. Así filtra y cuenta en la base, sin columnas
nuevas en `audit_log`.

**Revisión.**

- **Quién la necesita.** Un cambio sensible espera la revisión del Gerente General, salvo los que
  hizo el propio GG y los del Sistema (usuario null). Esos se muestran igual como sensibles.
- **Dónde se guarda.** Como `audit_log` es inmutable (trigger), la revisión vive en la tabla aparte
  `RevisionAuditoria`: una revisión por cambio, con quién y cuándo.
- **Quién la marca.** Solo el GG (`POST /auditoria/:id/revision`). El ADM ve el estado.
- **Respuestas de error.** Un cambio que no la necesita responde 422 y uno ya revisado, 409.

**Tipo de acción** (`tipoDeAccion`). No hay borrados físicos auditados, así que el tipo se deduce:

- **alta:** el cambio no tiene valor anterior;
- **baja:** una anulación (`anuladoEn`), un estado que pasa a `Cancelado` o un `activo` que pasa a
  `false`;
- **modificación:** el resto.

Cada comparación de valor va junto con «el campo cambió». Sin eso, en SQL el `NOT` de las
modificaciones dejaba afuera las filas que no tienen ese campo.

**Endpoints nuevos:**

- `GET /auditoria/resumen`: indicadores de los últimos días y «para revisar».
- `GET /auditoria/evento/:id`: el evento con sus presupuestos, pagos y solicitud, buscados por sus
  ids, porque esos cambios no llevan el id del evento.
- `GET /auditoria/exportar`: CSV con los filtros del registro, hasta 5000 filas.

`GET /auditoria` suma los filtros por tipo, sensibles, pendientes, registro puntual y búsqueda, y
devuelve los conteos por tipo para las pestañas.

**Lo que no se hizo.**

- No se registran la IP ni el origen del cambio.
- El historial no restaura versiones: un estado viejo de una consulta con pagos o salones agendados
  puede romper reglas (solapamiento, seña, recálculo).
- Lo que pide un cliente desde la web sigue sin auditarse, como decía este ADR. El historial de una
  consulta empieza con el primer cambio del personal.

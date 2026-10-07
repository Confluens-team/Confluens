# Backlog — Confluens

Las 46 historias del Product Backlog, alineadas con el Seguimiento del Proyecto.
Una línea por historia: para los criterios de aceptación completos ver el archivo del sprint
en curso. **Jira es la fuente de verdad del estado**; este archivo solo dice qué existe y dónde cae.

Total: 46 historias · 226 + 6 story points\* · 2 historias sin estimar (HU-48, HU-49) · 12 Epics

> **Cambios por la entrevista con el Responsable de Eventos (24/09/2026)**:
> - Se **elimina HU-08** (baja de cliente por inactividad): el cliente no quiere baja por inactividad.
> - Se **agregan HU-48** (registro del cliente) y **HU-49** (presupuesto dinámico y confirmación de la consulta en el canal público). Sin puntos: se estiman en el Sprint Planning.
> - **HU-34** cambia de actor (Responsable de Eventos, no Gerente General) y de alcance: porcentaje mensual editable más aumentos globales o por servicio en cualquier momento.
> - **HU-24** ya no envía el presupuesto por WhatsApp: el botón `wa.me` solo avisa la recepción de la consulta y el resumen se descarga en PDF para enviarlo a mano.
> - Las reglas que cambian criterios de historias existentes (vigencia de 10 días, sin cancelación automática, IVA, recargos, tercerizados con precio) están en `dominio.md`. Al escribir los criterios de cada historia en su sprint, **manda `dominio.md`** sobre cualquier documento anterior.

> **Notas de esta corrección** (ahora usando `Seguimiento del Proyecto`, sección 2.1.6/2.1.7, como fuente de verdad para la numeración de Epics — no `Definición del Producto`):
> - Se renumeraron los 12 Epics para que coincidan con Seguimiento del Proyecto: Gestión de Servicios pasa de EPIC-09 a **EPIC-04**; Gestión de Reservas de Eventos de EPIC-04 a **EPIC-05**; Gestión de Pagos de Clientes de EPIC-11 a **EPIC-06**; Notificaciones y Alertas de EPIC-06 a **EPIC-07**; Auditoría de Cambios de EPIC-07 a **EPIC-08**; Gestión de Medios de Pago de EPIC-10 a **EPIC-09**; Gestión de la Landing Page de EPIC-12 a **EPIC-10**; Reportes e Indicadores de EPIC-05 a **EPIC-11**; Administración de Accesos de EPIC-08 a **EPIC-12**. Salones, Clientes y Presupuestos no cambian de número.
> - **HU-43 (Emitir el presupuesto confirmado)** se mueve de "Reportes e Indicadores" a **"Gestión de Presupuestos de Eventos"**, porque así la agrupa el Story Map de Seguimiento del Proyecto.
> - Las historias en sí (HU-01 a HU-47), sus puntos, RD y actor no cambian: ese nivel de detalle solo existe en la Definición del Producto v0.3 (Seguimiento del Proyecto no numera historias ni asigna puntos). Los totales de puntos por Epic se recalcularon según el nuevo agrupamiento, pero el total general (235 pts) es el mismo.
> - El Story Map de Seguimiento (2.1.7) menciona 4 títulos sin HU/RD/puntos propios en la Definición del Producto: **Cerrar sesión** y **Cambiar contraseña** (bajo Administración de Accesos), y **Consultar pagos de un evento** y **Generar y emitir un recibo como comprobante válido de pago** (bajo Pagos de Clientes). Quedan listados al pie del Epic correspondiente como pendientes: a definir si necesitan HU propia o ya están cubiertas por los criterios de HU-27, HU-30, HU-41 y HU-11.
> - Aviso: los códigos RG-XX de cada Epic (heredados de la Definición del Producto/Plan de Proyecto) ya **no coinciden numéricamente** con el nuevo EPIC-XX — p. ej. Servicios sigue citado como RG-09 aunque ahora es EPIC-04. No los renumeré por no tener acceso al Plan de Proyecto para confirmar si el RG es un código fijo independiente del orden de Epics. Conviene chequearlo ahí.
> - \* HU-46 y HU-47 (Landing Page) figuran como pendientes de Planning Poker en la Definición del Producto v0.3, pero el Sprint 1 (más reciente) ya las trabajó con 3 puntos cada una — ver nota de EPIC-10.

## EPIC-01 — Gestión de Salones

RG-01. Gestionar los salones de eventos y su disponibilidad.  ·  3 historias  ·  11 pts  ·  Must have

| HU | Título | RD | Pts | Sprint | Actor |
|---|---|---|---|---|---|
| HU-01 | Consultar salones y su capacidad | RD-01.2 | 3 | 1 | Responsable de Eventos |
| HU-02 | Registrar las distribuciones posibles de un salón | RD-01.1 | 5 | 4 | Responsable de Eventos |
| HU-03 | Modificar los datos de un salón | RD-01.3 | 3 | 4 | Responsable de Eventos |

## EPIC-02 — Gestión de Clientes

RG-02. Gestionar los clientes de la organización.  ·  4 historias  ·  13 pts  ·  Must have

| HU | Título | RD | Pts | Sprint | Actor |
|---|---|---|---|---|---|
| HU-04 | Registrar un cliente | RD-02.1 | 3 | 2 | Responsable de Eventos |
| HU-05 | Consultar clientes | RD-02.4 | 3 | 3 | Responsable de Eventos |
| HU-06 | Modificar los datos de un cliente | RD-02.2 | 2 | 3 | Responsable de Eventos |
| HU-07 | Consultar el historial de eventos de un cliente | RD-02.3 | 5 | 3 | Responsable de Eventos |

~~HU-08 Registrar la baja de un cliente por inactividad~~: eliminada, no hay baja por inactividad (entrevista 24/09/2026). El código HU-08 no se reasigna.

## EPIC-03 — Gestión de Presupuestos de Eventos

RG-03. Gestionar los presupuestos.  ·  8 historias  ·  37 pts + HU-49 sin estimar  ·  Alta

| HU | Título | RD | Pts | Sprint | Actor |
|---|---|---|---|---|---|
| HU-09 | Generar un presupuesto estimado | RD-03.1 | 13 | 1 | Responsable de Eventos |
| HU-10 | Consultar el listado de presupuestos | RD-03.2 | 3 | 2 | Responsable de Eventos |
| HU-11 | Consultar el detalle de un presupuesto | RD-03.4 | 3 | 2 | Responsable de Eventos |
| HU-12 | Modificar un presupuesto | RD-03.3 | 8 | 2 | Responsable de Eventos |
| HU-13 | Registrar un presupuesto confirmado | RD-03.5 | 5 | 2 | Responsable de Eventos |
| HU-45 | Registrar un presupuesto cancelado | RD-03.6 | 2 | 3 | Responsable de Eventos |
| HU-43 | Emitir el presupuesto confirmado | RD-05.3 | 3 | 5 | Responsable de Eventos |
| HU-49 | Armar un presupuesto estimado y confirmar la consulta en el canal público | — | a estimar | a definir | Cliente |

**HU-49.** El cliente registrado carga sus datos y la fecha; ve precios proyectados a esa fecha (RN-13); elige salón, distribución, jornada, personas, servicios con modalidad (RN-11) y audiovisual; ve en vivo subtotal sin IVA, IVA 21% y total (RN-05); confirma y recibe un correo de consulta recibida. Se guarda como Solicitud con sus líneas. No bloquea el salón. Depende de HU-48 y de S-11 (proveedor de correo).

## EPIC-04 — Gestión de Servicios

RG-09. Gestionar servicios.  ·  4 historias  ·  23 pts  ·  Media

| HU | Título | RD | Pts | Sprint | Actor |
|---|---|---|---|---|---|
| HU-32 | Registrar un servicio | RD-09.1 | 5 | 1 | Responsable de Eventos |
| HU-33 | Modificar un servicio | RD-09.2 | 3 | 4 | Responsable de Eventos |
| HU-34 | Configurar el incremento de precios (mensual automático, global o por servicio) | RD-09.3 | 13 | 5 | Responsable de Eventos |
| HU-35 | Dar de baja un servicio | RD-09.4 | 2 | 6 | Responsable de Eventos |

## EPIC-05 — Gestión de Reservas de Eventos

RG-04. Gestionar eventos.  ·  8 historias  ·  62 pts  ·  Alta

| HU | Título | RD | Pts | Sprint | Actor |
|---|---|---|---|---|---|
| HU-14 | Registrar un evento en consulta | RD-04.2 | 5 | 1 | Cliente |
| HU-15 | Registrar la reserva de un evento | RD-04.1 | 13 | 1 | Responsable de Eventos |
| HU-16 | Modificar los datos de un evento | RD-04.3 | 5 | 4 | Responsable de Eventos |
| HU-17 | Consultar el calendario de eventos | RD-04.5 | 13 | 2 | Responsable de Eventos |
| HU-18 | Reasignar un evento a otro salón | RD-04.3 / RD-04.5 | 8 | 4 | Responsable de Eventos |
| HU-19 | Reutilizar la configuración de un evento anterior | RD-04.4 | 8 | 3 | Responsable de Eventos |
| HU-20 | Registrar un evento como pagado | RD-04.6 | 5 | 4 | Responsable de Finanzas |
| HU-44 | Registrar un evento cancelado | RD-04.7 | 5 | 3 | Responsable de Eventos |

## EPIC-06 — Gestión de Pagos de Clientes de los Eventos

RG-11. Gestionar los pagos y cobros de los eventos.  ·  2 historias  ·  21 pts  ·  Alta

| HU | Título | RD | Pts | Sprint | Actor |
|---|---|---|---|---|---|
| HU-40 | Registrar el pago de un evento | RD-11.1 | 13 | 2 | Responsable de Finanzas |
| HU-41 | Consultar el estado de cuenta de un evento | RD-11.1 | 8 | 3 | Responsable de Finanzas |

**Pendiente de HU propia** (mencionadas en el Story Map de Seguimiento del Proyecto, sin HU/RD/puntos en la Definición del Producto): *Consultar pagos de un evento*, *Generar y emitir un recibo como comprobante válido de pago*. La Definición del Producto sugiere que podrían estar ya cubiertas por HU-41 y HU-11 respectivamente — a confirmar con el equipo.

## EPIC-07 — Notificaciones y Alertas

RG-06. Gestionar las notificaciones y alertas del sistema.  ·  2 historias  ·  13 pts  ·  Baja

| HU | Título | RD | Pts | Sprint | Actor |
|---|---|---|---|---|---|
| HU-23 | Notificar el próximo vencimiento de un pago | RD-06.1 | 8 | 6 | Responsable de Finanzas |
| HU-24 | Avisar por WhatsApp la recepción de la consulta y descargar su resumen en PDF | RD-06.2 | 5 | 5 | Responsable de Eventos |

**HU-24.** Desde el detalle de la consulta, un botón abre `wa.me` con el teléfono del cliente y un mensaje prearmado (consulta recibida, próximo contacto). No envía el presupuesto. Otro botón descarga el resumen en PDF (pdfmake) para que el Responsable de Eventos lo envíe a mano.

## EPIC-08 — Auditoría de Cambios

RG-07. Administrar la auditoría de cambios del sistema.  ·  1 historia  ·  8 pts  ·  Baja

| HU | Título | RD | Pts | Sprint | Actor |
|---|---|---|---|---|---|
| HU-25 | Registrar el usuario y la fecha de cada modificación | RD-07.1 | 8 | 5 | Sistema |

## EPIC-09 — Gestión de Medios de Pago

RG-10. Gestionar medios de pago.  ·  4 historias  ·  7 pts  ·  Media

| HU | Título | RD | Pts | Sprint | Actor |
|---|---|---|---|---|---|
| HU-36 | Registrar un medio de pago | RD-10.1 | 2 | 3 | Responsable de Finanzas |
| HU-37 | Consultar los medios de pago | RD-10.4 | 1 | 3 | Responsable de Finanzas |
| HU-38 | Modificar un medio de pago | RD-10.2 | 2 | 4 | Responsable de Finanzas |
| HU-39 | Dar de baja un medio de pago | RD-10.3 | 2 | 6 | Responsable de Finanzas |

## EPIC-10 — Gestión de la Landing Page

RG-12. Gestionar información de la landing page.  ·  2 historias  ·  6 pts\*  ·  Alta

| HU | Título | RD | Pts | Sprint | Actor |
|---|---|---|---|---|---|
| HU-46 | Consultar información de salones en la landing page | RD-12.1 | 3\* | 1\* | Cliente |
| HU-47 | Registrar y actualizar la información de salones publicada en la landing page | RD-12.2 | 3\* | 1\* | Responsable de Eventos |

\* La Definición del Producto v0.3 marca estos dos valores como pendientes de Planning Poker; los puntos y el sprint que se muestran acá son los que el equipo ya usó de hecho en el documento de Sprint 1.

## EPIC-11 — Reportes e Indicadores

RG-05. Gestionar reportes e indicadores del negocio.  ·  2 historias  ·  13 pts  ·  Baja

| HU | Título | RD | Pts | Sprint | Actor |
|---|---|---|---|---|---|
| HU-21 | Generar el reporte de ingresos | RD-05.1 | 8 | 6 | Gerente General |
| HU-22 | Generar el reporte de servicios contratados | RD-05.2 | 5 | 4 | Gerente General |

## EPIC-12 — Administración de Accesos al Sistema

RG-08. Administrar los accesos al sistema.  ·  6 historias  ·  18 pts + HU-48 sin estimar  ·  Media

| HU | Título | RD | Pts | Sprint | Actor |
|---|---|---|---|---|---|
| HU-27 | Autenticar a un usuario según su rol | RD-08.1 | 8 | 1 | Responsable de Eventos |
| HU-28 | Registrar un usuario | RD-08.2 | 3 | 4 | Gerente General |
| HU-29 | Consultar usuarios | RD-08.3 | 2 | 4 | Gerente General |
| HU-30 | Modificar un usuario | RD-08.5 | 3 | 5 | Gerente General |
| HU-31 | Dar de baja un usuario | RD-08.4 | 2 | 5 | Gerente General |
| HU-48 | Registrarse como cliente en el canal público | — | a estimar | a definir | Cliente |

**HU-48.** Desde la landing, el cliente se registra con nombre, apellido, correo, contraseña y teléfono (autorregistro abierto, sin aprobación) y después inicia sesión. Se crean `Usuario` con rol `CLIENTE` y su `Cliente`. Correo duplicado se rechaza. Con sesión ve precios; sin sesión, la landing nunca los muestra. `dominio.md` lo planifica para el Sprint 2.

**Pendiente de HU propia** (mencionadas en el Story Map de Seguimiento del Proyecto, sin HU/RD/puntos en la Definición del Producto): *Cerrar sesión*, *Cambiar contraseña*. La Definición del Producto sugiere que podrían estar ya cubiertas por el criterio 5 de HU-27 (cierre de sesión) y el criterio 3 de HU-30 (restablecer contraseña) — a confirmar con el equipo.

## Distribución por sprint

| Sprint | Historias | Pts |
|---|---|---|
| 1 | HU-01 · HU-09 · HU-14 · HU-15 · HU-27 · HU-32 · HU-46\* · HU-47\* | 53\* |
| 2 | HU-04 · HU-10 · HU-11 · HU-12 · HU-13 · HU-17 · HU-40 | 48 |
| 3 | HU-05 · HU-06 · HU-07 · HU-45 · HU-19 · HU-44 · HU-36 · HU-37 · HU-41 | 36 |
| 4 | HU-02 · HU-03 · HU-16 · HU-18 · HU-20 · HU-22 · HU-28 · HU-29 · HU-33 · HU-38 | 41 |
| 5 | HU-43 · HU-24 · HU-25 · HU-30 · HU-31 · HU-34 | 34 |
| 6 | HU-21 · HU-23 · HU-35 · HU-39 | 20 |
| a definir | HU-48 · HU-49 | sin estimar |

Los puntos son los del backlog general (con HU-46 y HU-47 marcadas \*, ver nota de EPIC-10). Cada Sprint Planning re-estima según el alcance real: el Sprint 1 se cerró en 8 historias y 31 puntos tras re-estimar HU-27, HU-32, HU-01 y HU-09 a la baja (ver el documento de Sprint 1, que usa numeración local HU-01 a HU-08 para este subconjunto).

## Historias consolidadas

Dos historias de la versión anterior del backlog no figuran por separado; su alcance está
cubierto como criterios de aceptación:

- **HU-26** Consultar el registro de auditoría → criterio 5 de HU-25.
- **HU-42** Confirmar la reserva mediante el registro de la seña → criterio 4 de HU-15 y criterio 3 de HU-40.

Los códigos HU-26 y HU-42 no se reasignan. Por el mismo motivo, HU-46 y HU-47 (EPIC-10) continúan la numeración existente en lugar de insertarse en un rango intermedio.

Además de estas dos, hay 4 títulos que aparecen en el Story Map de Seguimiento del Proyecto sin HU propia en la Definición del Producto (ver notas de EPIC-06 y EPIC-12 más arriba); a diferencia de HU-26/HU-42, esa consolidación no está documentada explícitamente en ningún lado — es una observación de esta corrección, pendiente de que el equipo la confirme.

# Sprint 2 — Confluens

Del 25/09/2026 al 09/10/2026 · Scrum Master: Franco Rossi · 7 historias · 32 puntos

> **Fuentes.** `Seguimiento del Proyecto` (Story Map 2.1.7 y sección 4), `Definición del Producto` v0.2 y el documento `Sprint 2 — User Stories y criterios de aceptación` en Drive. Los criterios aplican `dominio.md` (entrevista del 24/09/2026), que manda sobre cualquier documento anterior.
>
> **Numeración.** Como en el Sprint 1, se usa la numeración local de la Definición del Producto (HU-09 a HU-15). La columna *Backlog* da el código de `backlog.md`.
>
> **Notas de esta versión:**
> - **HU-09 es el registro del cliente en la aplicación** (HU-48 del backlog), no el alta manual de un cliente por el Responsable de Eventos. Corregido el 04/10. «Registrar cliente» del Story Map se aborda como el registro del cliente en la aplicación; el alta manual de un cliente por el personal (HU-04 del backlog) no forma parte de este sprint.
> - La auditoría (usuario, fecha y detalle de cada cambio) se saca de los criterios de este sprint: se resuelve completa en el EPIC-08 (HU-25, Sprint 5). Decisión del equipo.
> - En el calendario (HU-15) se saca la marca «en conflicto»; queda solo en HU-13 (RN-12).

Objetivo: completar el Release 1 (walking skeleton). El Sprint 1 dejó un circuito mínimo; este sprint lo hace funcionar con datos reales: el cliente con cuenta propia, el ciclo de vida completo del presupuesto (listado, detalle, modificación y confirmación), el registro de pagos y la agenda visible en un calendario.

Orden por dependencia: Registrarse → Consultar y ajustar el presupuesto → Confirmarlo con la seña → Registrar los pagos → Ver la agenda.

## Alcance

| HU | Título | Actor | Backlog | SP |
|---|---|---|---|---|
| HU-09 | Registrarse como cliente en la aplicación | Cliente | HU-48 | 8 |
| HU-10 | Consultar listado de presupuestos | RE | HU-10 | 3 |
| HU-11 | Consultar detalle de un presupuesto | RE | HU-11 | 3 |
| HU-12 | Modificar presupuesto | RE | HU-12 | 5 |
| HU-13 | Registrar presupuesto confirmado | RE | HU-13 | 3 |
| HU-14 | Registrar pago de un evento | RF | HU-40 | 5 |
| HU-15 | Consultar calendario de eventos | RE | HU-17 | 5 |
| | **Total** | | | **32** |

Los puntos salen del Planning Poker del Sprint 2. Velocidad del Sprint 1: 31.

## Bloqueantes y pendientes del sprint

| Tema | Situación | Afecta |
|---|---|---|
| S-08 — Base de la seña | No está definido si el 20% se calcula sobre el total con o sin IVA, ni cómo se registran los pagos. **Hasta definirlo, no implementar el cálculo del umbral de seña.** | HU-13, HU-14 |
| Vincular cliente existente | Si alguien se registra con un correo que el personal ya cargó al presupuestar, se propone vincular la cuenta a esa ficha (HU-09 C7). Falta que lo confirme el PO. | HU-09 |
| Vigencia al modificar | ¿Modificar un presupuesto Estimado reinicia los 10 días o mantiene la fecha original? | HU-12 |
| Pago mayor al saldo | ¿Se rechaza o queda saldo a favor? Propuesta: rechazarlo. | HU-14 |
| Quién registra pagos | El backlog pone al RF como actor; en el Sprint 1 la seña la registraba el RE. ¿Pueden los dos? | HU-14 |

Si un punto de esta tabla bloquea una tarea, **parar y preguntar** (mismo criterio que `pendientes.md`).

## HU-09 — Registrarse como cliente en la aplicación

Como Cliente, quiero registrarme en la aplicación con mis datos de contacto y una contraseña, para iniciar sesión, ver los precios de salones y servicios y consultar por mi evento sin tener que dar mis datos cada vez.

- Desde la landing accedo al registro y me registro con nombre, apellido, correo, teléfono y contraseña, sin aprobación previa del personal; se crea mi cuenta con rol Cliente junto con mi ficha de cliente.
- Si falta un dato obligatorio o el correo no tiene un formato válido, el registro se rechaza indicando el campo.
- Un correo que ya tiene una cuenta se rechaza, informando que el correo ya está registrado.
- La contraseña se guarda cifrada, nunca en texto plano.
- Una vez registrado puedo iniciar sesión con mi correo y contraseña. Con sesión de Cliente veo salones y servicios con precio; sin sesión, la landing nunca muestra precios (ADR 0004).
- El rol Cliente nunca accede al panel interno.
- Si ya existe una ficha de cliente con mi correo, cargada por el personal antes de que el alta de clientes fuera solo por registro, mi cuenta se vincula a esa ficha en lugar de crear un cliente duplicado, y mi celular validado reemplaza el teléfono que tenía.

**Implementación.** `POST /api/auth/registro` crea `Usuario` (rol `CLIENTE`) y `Cliente` en una sola transacción; `GET /api/auth/perfil` devuelve los datos del cliente con sesión. `Cliente.apellido` es nullable (razones sociales y clientes cargados antes del registro). Ya hay avance en la rama `feat/hu-48-registrarse-como-cliente`. Validación de correo por mail: no se pidió (S-02), no se implementa.

**Pendiente antes de publicar.** Rate limit en `/api/auth/registro`, igual que el pendiente del formulario público de HU-04.

## HU-10 — Consultar listado de presupuestos

Como Responsable de Eventos, quiero consultar el listado de presupuestos con su estado, para hacer el seguimiento de los que están vigentes, vencidos o confirmados sin revisar planillas.

- Veo cada presupuesto con número, cliente, salón, fecha del evento, fecha de emisión, fecha de vencimiento, subtotal sin IVA, IVA 21%, total con IVA y estado (RN-05).
- Puedo filtrar por estado (Estimado, Expirado, Cancelado), por cliente y por rango de fechas del evento.
- Los presupuestos Confirmado no aparecen: una vez confirmado, el evento pasa a la agenda (decisión del PO, 05/10/2026).
- Los presupuestos Expirado se destacan con el aviso «Presupuesto vencido, recalcular» (RN-08).
- El listado se ordena del más reciente al más antiguo por fecha de emisión.
- Desde cada fila accedo al detalle del presupuesto (HU-11).
- Si ningún presupuesto cumple los filtros, el sistema lo informa.

**Implementación.** En la interfaz el listado se llama **Consultas** (pestaña de `/admin` y vista de `/panel`) y reemplaza a la pantalla de solicitudes del Sprint 1. `GET /api/presupuestos?estado=&cliente=&desde=&hasta=`, para el Responsable de Eventos y el Administrador del Sistema; sin `estado` devuelve todos menos los `Confirmado`. `cliente` es texto libre: cada palabra tiene que aparecer en el nombre, el apellido o el correo (se cambió el `clienteId` original porque `GET /clientes` es solo del administrador y el Responsable de Eventos no tendría de dónde elegirlo; decisión del equipo, 05/10/2026). `desde` y `hasta` acotan la fecha del evento, inclusive. Requiere `Presupuesto.venceEn` (= emisión + 10 días) y el trabajo programado `controlarVigencia`, que pasa a `Expirado` los `Estimado` vencidos. Ese trabajo **reemplaza** a `senas.trabajo.ts`: ya no hay cancelación automática (RN-06, RN-08).

## HU-11 — Consultar detalle de un presupuesto

Como Responsable de Eventos, quiero ver el detalle completo de un presupuesto, para responder las consultas del cliente y revisar exactamente qué se cotizó.

- Veo cliente, salón, distribución, fecha, horario, jornada, cantidad de personas, fecha de emisión, fecha de vencimiento y estado.
- Veo el detalle línea por línea: descripción, cantidad, precio unitario y subtotal.
- Los precios son los congelados al emitir, aunque el catálogo haya cambiado después.
- Un servicio tercerizado «a cotizar» aparece sin importe, con esa leyenda, y no suma al total.
- Se muestran subtotal sin IVA, IVA 21% y total (RN-05), y la leyenda «Este presupuesto tiene una validez de 10 días».
- Si el evento tiene más de un presupuesto, puedo navegar a los demás desde el detalle.
- Un presupuesto Expirado muestra el aviso «Presupuesto vencido, recalcular» (RN-08).

**Implementación.** `GET /api/presupuestos/:id`. IVA y total no se guardan: se calculan al mostrar con la constante del 21% (RN-05). Los tercerizados **suman** al total salvo los «a cotizar» (`Servicio.precio = null`, ver `../tecnico/modelo-datos.md`); esto corrige el criterio de HU-05 del Sprint 1.

## HU-12 — Modificar presupuesto

Como Responsable de Eventos, quiero modificar un presupuesto estimado (servicios, cantidades, personas, jornada y precios puntuales), para ajustarlo a lo que negocio con el cliente sin armarlo de nuevo.

- Un presupuesto Estimado es editable. Un presupuesto Confirmado solo puede modificarlo el Administrador del Sistema en casos excepcionales, sin que esa opción se muestre en el canal del cliente. Cancelado y Expirado se rechazan.
- Puedo agregar y quitar servicios y cambiar cantidades, cantidad de personas y jornada; el total se recalcula con las reglas de HU-05 (RN-04, RN-05, tercerizados y «a cotizar»).
- Las líneas que no toco conservan su precio congelado; las líneas nuevas toman el precio vigente del catálogo.
- Puedo ajustar a mano el precio unitario de una línea como ajuste comercial (RN-03).
- Sobre un Expirado se ofrece «Recalcular»: genera un presupuesto Estimado nuevo para el mismo evento, con precios vigentes y 10 días de vigencia; el anterior sigue visible como Expirado.

**Implementación.** `PATCH /api/presupuestos/:id` (`409` si el estado no lo permite; Confirmado solo con rol `ADMINISTRADOR_SISTEMA`) y `POST /api/presupuestos/:id/recalcular` (solo sobre `Expirado`). Un evento puede tener varios presupuestos.

## HU-13 — Registrar presupuesto confirmado

Como Responsable de Eventos, quiero que el presupuesto quede registrado como Confirmado cuando el cliente abona la seña dentro de su vigencia, para congelar sus precios y dejar tomado el salón.

- Cuando los pagos del evento alcanzan el 20% del total (RN-01, base según S-08) dentro de la vigencia, el presupuesto pasa a Confirmado y el evento a Reservado.
- Un presupuesto Confirmado conserva sus precios aunque suba el tarifario (RN-06, RN-10); solo admite modificaciones excepcionales del Administrador del Sistema (HU-12).
- Solo se confirma un presupuesto Estimado vigente; si está Expirado se rechaza pidiendo recalcularlo (RN-06).
- Un evento tiene como máximo un presupuesto Confirmado.
- Si el salón ya está Reservado o Cobrado por otro evento en ese horario, la confirmación se rechaza informando con cuál se superpone (RN-12).
- Al confirmar, las consultas EnConsulta superpuestas no se cancelan: quedan marcadas «en conflicto» para gestión manual (RN-12).

**Implementación.** No tiene endpoint propio: la confirmación la dispara el registro de un pago (HU-14) al cruzar el 20%, dentro de la misma transacción. **Reemplaza** el comportamiento del Sprint 1, donde reservar pasaba el evento a `Reservado` y el presupuesto a `Confirmado` sin seña. El no solapamiento sigue validándose en la aplicación y con la restricción `EXCLUDE` (btree_gist). «En conflicto» es una consulta de la aplicación, no un campo nuevo (`modelo-datos.md`).

**Bloqueado por S-08** en el cálculo del umbral.

## HU-14 — Registrar pago de un evento

Como Responsable de Finanzas, quiero registrar cada pago que hace un cliente por su evento, con fecha, importe y medio de pago, para llevar el saldo al día y que el evento avance de estado según lo abonado.

- Registro un pago con fecha, importe mayor a cero, medio de pago (Efectivo, Tarjeta o A la habitación) y una observación opcional; queda asociado al evento.
- El importe es libre, sin mínimo; el sistema muestra el saldo actualizado (total menos pagos registrados).
- Si el acumulado alcanza el 20% del total, se dispara la confirmación de HU-13 (evento Reservado, presupuesto Confirmado).
- Si el acumulado alcanza el 100% del total, el evento pasa a Cobrado.
- No se registran pagos en eventos Cancelado o Cobrado, ni en eventos sin presupuesto.
- Solo los roles con permiso de cobro pueden registrar pagos; el rol Cliente no accede.

**Implementación.** Entidades nuevas `Pago` (eventoId, fecha, importe, medioPagoId, observación) y `MedioPago`. Los tres medios se cargan por seed; el ABM es del Sprint 3 (HU-36 a HU-39). `POST /api/eventos/:id/pagos`. Importes con `Decimal`, nunca `Float`. Saldo = total − suma de pagos, calculado, no guardado.

**Bloqueado por S-08** en el cálculo del umbral de seña.

## HU-15 — Consultar calendario de eventos

Como Responsable de Eventos, quiero ver los eventos en un calendario por salón, para conocer de un vistazo la disponibilidad y responderle al cliente si una fecha está libre.

- Veo los eventos en vista mensual, semanal y diaria, en su fecha y horario, con salón, cliente y cantidad de personas.
- Cada estado se distingue visualmente: Reservado (etiqueta «Confirmado») y Cobrado; los Cancelado no se muestran por defecto.
- Puedo filtrar por uno o varios salones y por estado.
- Al seleccionar un evento accedo a su detalle y a su presupuesto vigente (HU-11).
- Una franja sin eventos Reservado o Cobrado en un salón se interpreta como disponible, aunque tenga consultas EnConsulta.
- Tres eventos el mismo día y horario en salones distintos se muestran sin conflicto.

**Implementación.** FullCalendar en la web. `GET /api/eventos?desde=&hasta=&salonId=&estado=`: hoy esa ruta solo la usa el panel del `ADMINISTRADOR_SISTEMA`; hay que abrirla al resto del personal interno. `Reservado` se muestra como «Confirmado» solo en pantalla: el enum no cambia (`dominio.md`).

## Ajustes sobre lo construido en el Sprint 1

| Comportamiento del Sprint 1 | Ajuste en el Sprint 2 | HU |
|---|---|---|
| Reservar pasaba el evento a Reservado y el presupuesto a Confirmado sin seña. | La reserva ocurre cuando los pagos alcanzan el 20% del total. | HU-13, HU-14 |
| `senas.trabajo.ts` cancelaba las reservas con la seña vencida. | Sin cancelación automática: `controlarVigencia` pasa a Expirado los presupuestos con más de 10 días sin seña. | HU-10 |
| `Presupuesto` sin fecha de vencimiento. | Se agrega `venceEn`. | HU-10, HU-11 |
| El cliente solo tenía nombre y se creaba al presupuestar. | Se agrega `apellido`; el cliente puede registrarse y queda vinculado a un `Usuario` rol `CLIENTE`. | HU-09 |
| No existían `Pago` ni `MedioPago`. | Se crean, con medios precargados. | HU-14 |
| Los tercerizados no sumaban al total. | Suman, salvo los «a cotizar». | HU-11, HU-12 |

También se retoman los 15 casos de prueba manuales pendientes del Sprint 1.

## Casos de prueba

El diseño de casos de prueba de cada historia (CP-09-01 en adelante) está en la Definición del Producto v0.2. Se automatizan con Vitest + Supertest sobre `crearApp()`, igual que en el Sprint 1.

## Definición de Terminado

Una historia está terminada cuando sus criterios pasan como tests automatizados, el código fue revisado por otro integrante vía pull request, el CI corre sin errores y la funcionalidad está desplegada y accesible.

La auditoría de las operaciones que modifican datos sale de la definición de este sprint: se implementa completa en el EPIC-08 (Sprint 5).

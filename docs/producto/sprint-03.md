# Sprint 3 — Confluens

Del 09/10/2026 al 23/10/2026 · Scrum Master: Eliazar Alexis Marti · 9 historias · 36 puntos (backlog, a re-estimar)

> **Fuentes.** `Definicion_del_Producto(sprint 3)` v0.4 (sección 7.3, HU-16 a HU-24) en Drive, más la tabla de Scrum Masters de `Seguimiento del Proyecto`. Los criterios aplican `dominio.md`, que manda sobre cualquier documento anterior.
>
> **Notas de esta versión:**
> - **Fechas.** El `Seguimiento del Proyecto` todavía no tiene la sección del Sprint 3. Las fechas salen de la tabla de asignación de Scrum Master (Sprint 3 el 09/10, Sprint 4 el 23/10), con el mismo criterio que el Sprint 1.
> - **Puntos.** En la Definición del Producto los SP del sprint figuran «A estimar». La columna *SP* usa la estimación del backlog (`backlog.md`); se reemplaza cuando haya Planning Poker.
> - **Numeración.** Como en los sprints anteriores, se usa la numeración local de la Definición del Producto (HU-16 a HU-24). La columna *Backlog* da el código de `backlog.md`.
> - La Definición del Producto cita requerimientos con la numeración vieja de Epics (por ejemplo RD-09.1 para medios de pago, que en `backlog.md` es RD-10.1). No se copian acá: vale el código de `backlog.md`.

Objetivo: empezar el Release 2 (MVP operativo). El Release 1 dejó el circuito completo del evento; este sprint suma lo que hace falta para trabajar el día a día sin planillas: clientes con su ficha e historial, el catálogo de medios de pago, el estado de cuenta de cada evento, las bajas (presupuesto y evento) y reutilizar un evento anterior para un cliente recurrente.

Orden de la Definición del Producto: Clientes → Medios de pago → Estado de cuenta → Bajas → Reutilizar.

## Alcance

| HU | Título | Actor | Backlog | SP |
|---|---|---|---|---|
| HU-16 | Consultar clientes | RE | HU-05 | 3 |
| HU-17 | Modificar datos de cliente | RE | HU-06 | 2 |
| HU-18 | Consultar historial de eventos de un cliente | RE | HU-07 | 5 |
| HU-19 | Registrar medio de pago | RF | HU-36 | 2 |
| HU-20 | Consultar medios de pago | RF | HU-37 | 1 |
| HU-21 | Consultar el estado de cuenta de un evento | RF | HU-41 | 8 |
| HU-22 | Registrar presupuesto cancelado | RE | HU-45 | 2 |
| HU-23 | Registrar evento cancelado | RE | HU-44 | 5 |
| HU-24 | Reutilizar configuración de un evento anterior | RE | HU-19 | 8 |
| | **Total** | | | **36** |

Velocidad de los sprints anteriores: 31 (Sprint 1) y 32 (Sprint 2). Con 36 puntos de backlog el sprint queda por encima; conviene confirmarlo en el Planning.

## Puntos a resolver antes de implementar

La Definición del Producto del Sprint 3 contradice en algunos puntos a `dominio.md` o a decisiones
posteriores. **El agente no los resuelve por su cuenta**: hay que confirmarlos con el PO (mismo
criterio que `pendientes.md`).

| Tema | Qué dice la Definición del Producto | Qué dice el proyecto hoy | Afecta |
|---|---|---|---|
| Catálogo de medios de pago | Los medios iniciales son Efectivo, Tarjeta y A la habitación (HU-19 C4), y el RF registra medios nuevos. | RN-14: el catálogo es Efectivo, Transferencia, Débito, Crédito, Cheque y A la habitación; «Tarjeta» tiene baja lógica. Qué medios se aceptan en cada cobro lo fija una lista en `packages/shared/src/dominio/medios-pago.ts` según `requiereFactura`, así que **un medio dado de alta por el ABM no se podría usar en ningún cobro**. Cambiar el catálogo o RN-14 es una decisión que el agente no puede tomar (`dominio.md`). | HU-19, HU-20 |
| Saldo negativo | «El saldo nunca es negativo» (HU-21 C3). | Corrección del 08/10/2026 sobre HU-12: si se modifica un presupuesto Confirmado y el total queda por debajo de lo pagado, se guarda igual y **el saldo queda negativo** para resolverlo con el cliente. | HU-21 |
| Quién edita los datos de contacto | El personal modifica nombre, apellido, teléfono y correo del cliente (HU-17). | `sprint-02.md` (HU-12): «Los datos de contacto del cliente no se editan: los mantiene el cliente desde su cuenta». Además queda abierto S-15 (correo de un cliente con cuenta). | HU-17 |
| Plazo de 48 horas | Aplica a cualquier cancelación (HU-23 C3, CP-23-05). | RN-07 habla de la cancelación **por parte del cliente**. Lo implementado en el Sprint 1 exige las 48 horas solo a un evento `Reservado`; uno `EnConsulta` se cancela sin plazo. | HU-23 |
| Modalidad de servicio | Al reutilizar se copia la modalidad de cada servicio (HU-24 C2, CP-24-04). | RN-11 (continuo +20%, en mesa +30%) está en `dominio.md` y `modelo-datos.md`, pero **no está implementada**: `LineaPresupuesto` no tiene la columna `modalidad`. | HU-24 |

Además siguen abiertos dos pendientes que esta Definición del Producto marca como bloqueantes:
**S-01** (reintegro de lo abonado por encima de la seña, HU-23) y el nuevo **S-15** (cambio de
correo de un cliente con cuenta, HU-17). Ver `pendientes.md`.

## HU-16 — Consultar clientes

Como Responsable de Eventos, quiero consultar el listado de clientes registrados con sus datos de contacto, para ubicar rápidamente a un cliente y acceder a su información sin depender de planillas ni del historial de WhatsApp.

- Veo cada cliente con nombre y apellido (o razón social), correo, teléfono, etiqueta (si tiene) y fecha de alta.
- Puedo buscar por nombre, apellido, correo, teléfono o etiqueta; la búsqueda no distingue mayúsculas de minúsculas.
- El listado se ordena alfabéticamente por apellido y nombre.
- Desde cada fila accedo a la ficha del cliente, con sus datos y su historial de eventos (HU-18).
- Si ningún cliente cumple la búsqueda, el sistema lo informa.
- Solo el personal interno accede al listado; el rol Cliente y los visitantes sin sesión no.

**Implementación.** Ya existe `GET /api/clientes` (todo el personal, con la etiqueta y la cantidad de eventos y solicitudes) y la pantalla **Clientes** de `/admin`. Falta: la búsqueda del lado de la API (hoy filtra la web; CP-16-02 pide `GET /api/clientes?busqueda=`), ordenar por apellido y nombre (hoy ordena por nombre) y la ficha del cliente como pantalla propia, que comparte con HU-17 y HU-18.

## HU-17 — Modificar datos de cliente

Como Responsable de Eventos, quiero modificar los datos de contacto de un cliente, para mantenerlos actualizados cuando cambia de teléfono o de correo y no perder el canal de contacto.

- Desde la ficha del cliente puedo modificar nombre, apellido (o razón social), teléfono y correo; el cambio se ve de inmediato en el listado y en los eventos del cliente.
- Nombre, teléfono y correo son obligatorios y el correo debe tener un formato válido; si falta un dato o es inválido, la modificación se rechaza indicando el campo.
- El teléfono debe ser un celular válido y se guarda en formato internacional, igual que en el registro (HU-09).
- El correo se guarda en minúsculas y sin espacios; si ya pertenece a otro cliente, la modificación se rechaza informándolo.
- La modificación no altera el historial: los eventos, presupuestos y pagos del cliente siguen asociados a la misma ficha.
- Solo el personal interno puede modificar los datos de un cliente; el rol Cliente no accede.

**Pendiente (S-15).** Si el cliente tiene cuenta, falta que el PO confirme si el cambio de correo hecho por el personal cambia también el correo con el que inicia sesión. Hasta definirlo, la Definición del Producto aplica la regla del correo solo a las fichas sin cuenta. Ver además «Puntos a resolver»: hoy el proyecto dice que los datos de contacto los mantiene el cliente.

**Implementación.** `PATCH /api/clientes/:id` (`409` si el correo ya es de otro cliente, `404` si no existe). El celular y el correo reusan la validación y la normalización del registro (`telefono.esquema.ts`, correo en minúsculas, `dominio.md`).

## HU-18 — Consultar historial de eventos de un cliente

Como Responsable de Eventos, quiero consultar el historial de eventos y consultas de un cliente, para conocer qué contrató antes y atenderlo con ese contexto.

- En la ficha del cliente veo todos sus eventos, en cualquier estado (EnConsulta, Reservado, Cobrado y Cancelado), con fecha, tipo de evento, salón, cantidad de personas, estado y total del presupuesto. Una consulta social sin salón figura como «Sin salón asignado».
- El historial se ordena del más reciente al más antiguo por fecha del evento.
- Puedo filtrar el historial por estado y por rango de fechas del evento.
- Desde cada fila accedo al detalle del evento y de su presupuesto (HU-11).
- Se muestra un resumen con la cantidad de eventos del cliente en cada estado.
- Si el cliente no tiene eventos, el sistema lo informa.
- El historial es de uso interno: el rol Cliente no accede.

**Implementación.** `GET /api/clientes/:id/eventos?estado=&desde=&hasta=` (`404` si el cliente no existe). Un evento puede ocupar varios salones (`EventoSalon`, ADR 0011): la columna «salón» los lista a todos.

## HU-19 — Registrar medio de pago

Como Responsable de Finanzas, quiero registrar los medios de pago que acepta la organización, para poder elegirlos al registrar un pago sin depender de una lista fija.

- Registro un medio de pago con su nombre; queda activo y disponible para elegir al registrar un pago (HU-14).
- El nombre es obligatorio; vacío o solo con espacios se rechaza indicando el campo.
- Un nombre ya existente se rechaza, sin distinguir mayúsculas de minúsculas.
- Los medios cargados al iniciar el sistema se conservan y conviven con los nuevos.
- Solo el personal interno puede registrar medios de pago; el rol Cliente no accede.

**Bloqueada por «Puntos a resolver».** Con RN-14 la lista de medios habilitados está fija en código según `requiereFactura`: antes de implementar el alta hay que definir con el PO si un medio nuevo se habilita con factura, sin factura o en los dos casos, y dónde se guarda esa decisión (hoy no hay columna). La Definición del Producto todavía nombra «Tarjeta» entre los medios iniciales.

**Implementación.** `POST /api/medios-pago` (`409` si el nombre ya existe sin distinguir mayúsculas). `MedioPago` ya existe, con `activo` para la baja lógica; el seed y la migración `20261013201842_medios_de_pago_rn_14` cargan el catálogo de RN-14.

## HU-20 — Consultar medios de pago

Como Responsable de Finanzas, quiero consultar el listado de medios de pago, para saber cuáles están disponibles al registrar un cobro.

- Veo cada medio de pago con su nombre y su estado (activo o inactivo).
- El listado se ordena alfabéticamente por nombre.
- Al registrar un pago (HU-14), el selector ofrece solo los medios de pago activos, y de ellos los que habilita RN-14 según el presupuesto requiera factura o no.
- Solo el personal interno accede al listado; el rol Cliente no.

**Implementación.** Ya existe `GET /api/medios-pago`, pero devuelve solo los activos (es lo que usa el formulario de cobro). El listado de esta historia necesita también los inactivos: un parámetro para pedirlos o un endpoint aparte, sin cambiar lo que recibe el formulario de cobro.

## HU-21 — Consultar el estado de cuenta de un evento

Como Responsable de Finanzas, quiero consultar el estado de cuenta de un evento, con lo presupuestado, lo abonado y lo que falta cobrar, para hacer el seguimiento de la deuda sin recalcularla a mano.

- Veo el cliente, el evento (fecha, salón y estado) y la base de cobro: el total con IVA si el presupuesto requiere factura, o el subtotal sin IVA si no (RN-01).
- Veo cada pago registrado con fecha, importe, medio de pago y observación, del más antiguo al más reciente.
- Veo el total abonado y el saldo pendiente (base de cobro menos pagos registrados).
- Veo el importe de la seña (20% de la base de cobro) y si ya fue alcanzada (RN-01).
- Un evento Cobrado figura con saldo cero y la cuenta saldada.
- Un evento Cancelado conserva sus pagos para consulta: lo abonado no se reintegra (RN-06).
- Si el evento no tiene pagos, el sistema lo informa y el saldo es igual a la base de cobro.
- Solo el personal interno accede al estado de cuenta; el rol Cliente no.

La Definición del Producto agrega «el saldo nunca es negativo», que choca con la corrección del 08/10/2026 (ver «Puntos a resolver»).

**Implementación.** Ya existe `GET /api/eventos/:id/pagos` (HU-14): devuelve los pagos y el saldo (`baseDeCobro`, `incluyeIva`, `pagado`, `saldo`, `porcentajeAbonado`), calculado y nunca guardado. Falta el importe de la seña y si fue alcanzada, y la pantalla del estado de cuenta con los datos del cliente y del evento.

## HU-22 — Registrar presupuesto cancelado

Como Responsable de Eventos, quiero dar de baja un presupuesto que el cliente no va a confirmar, para que deje de figurar como pendiente y el listado refleje solo lo que sigue en gestión.

- Puedo dar de baja un presupuesto Estimado o Expirado, previa confirmación explícita; pasa a Cancelado. La baja siempre es manual: el sistema nunca cancela un presupuesto por su cuenta (RN-08).
- Un presupuesto Confirmado no se da de baja por esta vía (la cancelación de un evento reservado es HU-23) y uno ya Cancelado se rechaza.
- Como cada evento tiene un solo presupuesto, al darlo de baja su evento EnConsulta pasa también a Cancelado.
- El presupuesto Cancelado no se borra: sigue visible en el listado (HU-10) y en su detalle (HU-11), en solo lectura; no se modifica ni se recalcula, y su evento no admite pagos.
- Los pagos parciales registrados antes de la baja se conservan en el estado de cuenta (HU-21); lo abonado no se reintegra (RN-06).
- Solo el personal interno puede dar de baja un presupuesto; el rol Cliente no accede.

**Implementación.** La baja ya se construyó en el Sprint 2 como parte de HU-12: `POST /api/presupuestos/:id/dar-de-baja` cancela el presupuesto y su evento. Esta historia la formaliza: falta verificar el diálogo de confirmación en la web y cubrir con tests los casos CP-22-01 a CP-22-11.

## HU-23 — Registrar evento cancelado

Como Responsable de Eventos, quiero registrar la cancelación de un evento cuando el cliente desiste, para liberar el salón en la agenda y dejar constancia de la baja.

- Puedo cancelar un evento EnConsulta o Reservado, previa confirmación explícita; pasa a Cancelado. La cancelación siempre es manual: el sistema nunca cancela un evento por su cuenta.
- Un evento Cobrado o ya Cancelado no se puede cancelar.
- La cancelación se admite hasta 48 horas corridas antes del inicio del evento; fines de semana y feriados cuentan (RN-07). Con menos anticipación se rechaza.
- Al cancelar un evento Reservado, el salón queda libre en ese horario y otro evento puede reservarlo.
- Las consultas que estaban marcadas «en conflicto» por ese evento dejan de estarlo (RN-12).
- Los pagos del evento se conservan en el estado de cuenta (HU-21); la seña no se reintegra (RN-06).
- El evento Cancelado no se muestra por defecto en el calendario (HU-15), pero sigue en el historial del cliente (HU-18); no admite pagos.
- Solo el personal interno puede cancelar un evento; el rol Cliente no accede.

**Bloqueante (S-01).** No está definido qué pasa con lo abonado por encima de la seña cuando el cliente cancela dentro del plazo. Hasta que el PO lo defina, la cancelación no registra ningún reintegro: los pagos solo se conservan para consulta.

**Implementación.** Ya existe `POST /api/eventos/:id/cancelar` (Sprint 1): acepta EnConsulta y Reservado (`409` en los demás) y exige las 48 horas solo a un Reservado con horario (`422`, RN-07). Ver «Puntos a resolver» por el alcance del plazo. «En conflicto» es una consulta de la aplicación, no un campo, así que deja de figurar sola al cancelarse el evento que la provocaba.

## HU-24 — Reutilizar configuración de un evento anterior

Como Responsable de Eventos, quiero generar una consulta nueva a partir de la configuración de un evento anterior, para no volver a cargar salón, distribución y servicios cuando un cliente recurrente repite su evento.

- Desde el detalle de un evento o desde el historial del cliente (HU-18) elijo «Reutilizar configuración» e indico la nueva fecha y el horario; la fecha es obligatoria y debe ser futura.
- Se crea un evento nuevo en estado EnConsulta para el mismo cliente, con el tipo de evento, los salones, la distribución, la jornada, la cantidad de personas y los servicios (con sus cantidades) del evento original.
- El presupuesto nuevo nace Estimado, con los precios vigentes del catálogo y no los congelados del original, y con 10 días de vigencia (RN-08); muestra subtotal sin IVA, IVA 21% y total (RN-05).
- Los servicios del original que ya no están disponibles en el catálogo no se copian y el sistema avisa cuáles quedaron afuera; los tercerizados «a cotizar» se copian sin importe.
- No se copian los pagos, el estado ni los ajustes comerciales de precio del evento original (RN-03).
- El evento original no se modifica.
- La consulta nueva no bloquea el salón: si la fecha ya está reservada, queda marcada «en conflicto» (RN-12). Después se modifica como cualquier presupuesto Estimado (HU-12).
- Solo el personal interno puede reutilizar la configuración de un evento; el rol Cliente no accede.

La Definición del Producto pide copiar también la **modalidad** de cada servicio (RN-11), que todavía no está implementada (ver «Puntos a resolver»).

**Implementación.** `POST /api/eventos/:id/reutilizar` (`201` con el evento nuevo y los servicios que quedaron afuera; `400` sin fecha o con fecha pasada). Crea evento y presupuesto en una sola transacción, como `POST /api/presupuestos`.

## Casos de prueba

El diseño de casos de prueba de cada historia (CP-16-01 en adelante) está en la Definición del Producto v0.4. Se automatizan con Vitest + Supertest sobre `crearApp()`, igual que en los sprints anteriores.

## Definición de Terminado

Una historia está terminada cuando sus criterios pasan como tests automatizados, el código fue revisado por otro integrante vía pull request, el CI corre sin errores y la funcionalidad está desplegada y accesible.

La auditoría de las operaciones que modifican datos sigue fuera de la definición: se implementa completa en el EPIC-08 (HU-25, Sprint 5).

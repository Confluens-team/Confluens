# Sprint 3 — Confluens

Del 09/10/2026 al 23/10/2026 · Scrum Master: Eliazar Alexis Marti · 9 historias · 36 puntos (backlog, a re-estimar en el Planning)

> **Fuentes.** `Definicion_del_Producto(sprint 3)` v0.4 (sección 7.3, HU-16 a HU-24) en Drive, más la tabla de Scrum Masters de `Seguimiento del Proyecto`. Los criterios aplican `dominio.md`, que manda sobre cualquier documento anterior.
>
> **Notas de esta versión:**
> - **Fechas.** El `Seguimiento del Proyecto` todavía no tiene la sección del Sprint 3. Las fechas salen de la tabla de asignación de Scrum Master (Sprint 3 el 09/10, Sprint 4 el 23/10), con el mismo criterio que el Sprint 1.
> - **Puntos.** En la Definición del Producto los SP del sprint figuran «A estimar» y todavía no hubo Planning Poker (16/10/2026). La columna *SP* usa la estimación del backlog (`backlog.md`); se reemplaza cuando se estime. HU-24 va a crecer: suma la modalidad de servicio (ver «Decisiones del PO»).
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

## Decisiones del PO (16/10/2026)

La Definición del Producto del Sprint 3 contradecía en cinco puntos a `dominio.md` o a decisiones
posteriores. El PO los resolvió el 16/10/2026; `dominio.md` ya está actualizado y **manda sobre el
texto de Drive** en estos puntos (conviene corregirlo también en la Definición del Producto).

| Tema | Qué decía la Definición del Producto | Decisión | Afecta |
|---|---|---|---|
| Medios de pago | Medios iniciales Efectivo, Tarjeta y A la habitación (HU-19 C4); el RF registra medios nuevos. Con RN-14 la lista de qué medio va con factura estaba fija en código, así que un medio nuevo no se habría podido usar en ningún cobro. | **Al dar de alta un medio se elige si se habilita con factura, sin factura o en los dos casos**, y RN-14 pasa a salir de esa marca. El catálogo inicial es el de RN-14; «Tarjeta» se saca de la historia (tiene baja lógica). | HU-19, HU-20 |
| Saldo negativo | «El saldo nunca es negativo» (HU-21 C3). | **El saldo puede ser negativo** (decisión del 08/10/2026 sobre HU-12): se muestra como **saldo a favor del cliente** para resolverlo a mano. | HU-21 |
| Quién edita los datos de contacto | El personal modifica nombre, apellido, teléfono y correo (HU-17), contra «los datos de contacto los mantiene el cliente desde su cuenta» (`sprint-02.md`). | **El personal edita nombre, apellido y teléfono de cualquier cliente; el correo, solo de los clientes sin cuenta** (el de un cliente con cuenta es su usuario para iniciar sesión y lo cambia él). Cierra S-15. | HU-17 |
| Plazo de 48 horas | Aplica a cualquier cancelación (HU-23 C3, CP-23-05). | **Las 48 horas aplican solo a un evento confirmado** (`Reservado`); una consulta sin seña se cancela en cualquier momento. Es como funciona desde el Sprint 1. | HU-23 |
| Modalidad de servicio | Al reutilizar se copia la modalidad de cada servicio (HU-24 C2), pero RN-11 nunca se implementó. | **La modalidad se construye en este sprint** (RN-11): se elige en el cotizador y al armar o modificar el presupuesto, suma el recargo y se copia al reutilizar. Mientras S-09 siga abierto, **una sola modalidad por servicio**. | HU-24 |

Siguen abiertos **S-01** (qué pasa con lo abonado por encima de la seña si el cliente cancela en
plazo; hasta definirlo la cancelación no registra reintegros) y **S-09** (si un servicio puede
llevar las dos modalidades a la vez). Ver `pendientes.md`.

**Cambios de modelo que van a hacer falta** (cada uno se confirma antes de tocar `schema.prisma`,
`AGENTS.md` §6): la marca de factura en `MedioPago` (HU-19) y la columna `modalidad` en
`LineaPresupuesto` más `admiteModalidad` en `Servicio`, que `modelo-datos.md` ya describe pero no existen en la base (HU-24).

## HU-16 — Consultar clientes

Como Responsable de Eventos, quiero consultar el listado de clientes registrados con sus datos de contacto, para ubicar rápidamente a un cliente y acceder a su información sin depender de planillas ni del historial de WhatsApp.

- Veo cada cliente con nombre y apellido (o razón social), correo, teléfono, etiqueta (si tiene) y fecha de alta.
- Puedo buscar por nombre, apellido, correo, teléfono o etiqueta; la búsqueda no distingue mayúsculas de minúsculas.
- El listado se ordena alfabéticamente por apellido y nombre.
- Desde cada fila accedo a la ficha del cliente, con sus datos y su historial de eventos (HU-18).
- Si ningún cliente cumple la búsqueda, el sistema lo informa.
- Solo el personal interno accede al listado; el rol Cliente y los visitantes sin sesión no.

**Hecho (16/10/2026, PR #66).** `GET /api/clientes?busqueda=`: cada palabra tiene que aparecer en el nombre, el apellido, el correo, el teléfono o la etiqueta. El orden por apellido y nombre lo arma el servicio (una razón social, sin apellido, se ordena por su nombre). `GET /api/clientes/:id` da la ficha. En la web, cada nombre del listado abre la ficha (`FichaCliente.tsx`), que comparten HU-17 y HU-18.

## HU-17 — Modificar datos de cliente

Como Responsable de Eventos, quiero modificar los datos de contacto de un cliente, para mantenerlos actualizados cuando cambia de teléfono o de correo y no perder el canal de contacto.

- Desde la ficha del cliente puedo modificar nombre, apellido (o razón social) y teléfono de cualquier cliente; el cambio se ve de inmediato en el listado y en los eventos del cliente.
- El correo solo lo puedo modificar si el cliente **no tiene cuenta**: el de un cliente con cuenta es su usuario para iniciar sesión y lo cambia él (decisión del PO, 16/10/2026).
- Nombre y teléfono son obligatorios, y también el correo cuando se modifica; si falta un dato o es inválido, la modificación se rechaza indicando el campo.
- El teléfono debe ser un celular válido y se guarda en formato internacional, igual que en el registro (HU-09).
- El correo se guarda en minúsculas y sin espacios; si ya pertenece a otro cliente, la modificación se rechaza informándolo.
- La modificación no altera el historial: los eventos, presupuestos y pagos del cliente siguen asociados a la misma ficha.
- Solo el personal interno puede modificar los datos de un cliente; el rol Cliente no accede.

**Hecho (16/10/2026).** `PATCH /api/clientes/:id` (`409` si el correo ya es de otro cliente, sin distinguir mayúsculas; `422` si se intenta cambiar el correo de un cliente con cuenta; `404` si no existe). El body lo valida `esquemaModificarCliente` (`packages/shared`): el celular reusa `esquemaCelular` y se guarda en E.164; el correo, opcional, se guarda en minúsculas y sin espacios; el apellido, opcional, queda `null` para una razón social. Mandar el mismo correo que ya tiene el cliente no cuenta como un cambio, así que la web puede enviar el formulario entero. En la web, `EditorDatosCliente.tsx` dentro de la ficha: el correo se muestra de solo lectura cuando el cliente tiene cuenta y no se envía.

## HU-18 — Consultar historial de eventos de un cliente

Como Responsable de Eventos, quiero consultar el historial de eventos y consultas de un cliente, para conocer qué contrató antes y atenderlo con ese contexto.

- En la ficha del cliente veo todos sus eventos, en cualquier estado (EnConsulta, Reservado, Cobrado y Cancelado), con fecha, tipo de evento, salón, cantidad de personas, estado y total del presupuesto. Una consulta social sin salón figura como «Sin salón asignado».
- El historial se ordena del más reciente al más antiguo por fecha del evento.
- Puedo filtrar el historial por estado y por rango de fechas del evento.
- Desde cada fila accedo al detalle del evento y de su presupuesto (HU-11).
- Se muestra un resumen con la cantidad de eventos del cliente en cada estado.
- Si el cliente no tiene eventos, el sistema lo informa.
- El historial es de uso interno: el rol Cliente no accede.

**Hecho (16/10/2026, PR #67).** `GET /api/clientes/:id/eventos?estado=&desde=&hasta=` devuelve los eventos y el resumen por estado de todos los del cliente, sin aplicar los filtros (`404` si el cliente no existe). Un evento puede ocupar varios salones (`EventoSalon`, ADR 0011): la columna «salón» los lista a todos. En la web, `HistorialCliente.tsx` dentro de la ficha; cada fila abre el evento y desde ahí su presupuesto.

## HU-19 — Registrar medio de pago

Como Responsable de Finanzas, quiero registrar los medios de pago que acepta la organización, para poder elegirlos al registrar un pago sin depender de una lista fija.

- Registro un medio de pago con su nombre y elijo si se puede usar **con factura, sin factura o en los dos casos**; queda activo y disponible para elegir al registrar un pago (HU-14) en los presupuestos que correspondan (RN-14).
- El nombre es obligatorio; vacío o solo con espacios se rechaza indicando el campo. Elegir al menos uno de los dos casos también es obligatorio.
- Un nombre ya existente se rechaza, sin distinguir mayúsculas de minúsculas.
- Los medios del catálogo inicial (los de RN-14: Efectivo, Transferencia, Débito, Crédito, Cheque y A la habitación) se conservan, con la habilitación que fija RN-14, y conviven con los nuevos.
- Solo el personal interno puede registrar medios de pago; el rol Cliente no accede.

**Implementación.** `POST /api/medios-pago` (`409` si el nombre ya existe sin distinguir mayúsculas). `MedioPago` ya existe, con `activo` para la baja lógica; el seed y la migración `20261013201842_medios_de_pago_rn_14` cargan el catálogo. Hace falta guardar en `MedioPago` con qué casos se habilita (por ejemplo, dos booleanos `conFactura` y `sinFactura`), cargar los seis medios actuales con lo que fija RN-14 y que la regla deje de leer la lista fija de `packages/shared/src/dominio/medios-pago.ts`. Es un cambio de modelo: se confirma antes de tocar `schema.prisma`.

## HU-20 — Consultar medios de pago

Como Responsable de Finanzas, quiero consultar el listado de medios de pago, para saber cuáles están disponibles al registrar un cobro.

- Veo cada medio de pago con su nombre, su estado (activo o inactivo) y si se habilita con factura, sin factura o en los dos casos.
- El listado se ordena alfabéticamente por nombre.
- Al registrar un pago (HU-14), el selector ofrece solo los medios de pago activos, y de ellos los que habilita RN-14 según el presupuesto requiera factura o no.
- Solo el personal interno accede al listado; el rol Cliente no.

**Implementación.** Ya existe `GET /api/medios-pago`, pero devuelve solo los activos (es lo que usa el formulario de cobro). El listado de esta historia necesita también los inactivos: un parámetro para pedirlos o un endpoint aparte, sin cambiar lo que recibe el formulario de cobro.

## HU-21 — Consultar el estado de cuenta de un evento

Como Responsable de Finanzas, quiero consultar el estado de cuenta de un evento, con lo presupuestado, lo abonado y lo que falta cobrar, para hacer el seguimiento de la deuda sin recalcularla a mano.

- Veo el cliente, el evento (fecha, salón y estado) y la base de cobro: el total con IVA si el presupuesto requiere factura, o el subtotal sin IVA si no (RN-01).
- Veo cada pago registrado con fecha, importe, medio de pago y observación, del más antiguo al más reciente.
- Veo el total abonado y el saldo pendiente (base de cobro menos pagos registrados). Si un presupuesto confirmado se modificó y su total quedó por debajo de lo pagado, el saldo es negativo y se muestra como **saldo a favor del cliente** (decisión del PO, 16/10/2026).
- Veo el importe de la seña (20% de la base de cobro) y si ya fue alcanzada (RN-01).
- Un evento Cobrado figura con saldo cero y la cuenta saldada.
- Un evento Cancelado conserva sus pagos para consulta: lo abonado no se reintegra (RN-06).
- Si el evento no tiene pagos, el sistema lo informa y el saldo es igual a la base de cobro.
- Solo el personal interno accede al estado de cuenta; el rol Cliente no.

**Hecho (16/10/2026).** `GET /api/eventos/:id/pagos` suma al saldo `montoSena` (el 20% de la base, redondeado para arriba al centavo) y `senaAlcanzada` (en true también si el evento ya se reservó, aunque después suba el total, RN-09). `saldo` puede ser negativo: la web lo muestra como saldo a favor del cliente. Cada pago trae `completaSena` y `completaPago`: el que se registró más cerca de `senaRegistradaEn` y el último de un evento Cobrado. Un evento dado de baja se sigue midiendo contra su presupuesto Cancelado, así que conserva sus pagos y su base. En la web, el estado de cuenta sigue en la tarjeta «Cuenta del evento» del detalle, que ya muestra cliente, fecha, salón y estado: suma la seña en cualquier estado, el cartel del evento cancelado y los dos pagos destacados en verde («Seña completa» y «Evento con pago completo»).

## HU-22 — Registrar presupuesto cancelado

Como Responsable de Eventos, quiero dar de baja un presupuesto que el cliente no va a confirmar, para que deje de figurar como pendiente y el listado refleje solo lo que sigue en gestión.

- Puedo dar de baja un presupuesto Estimado o Expirado, previa confirmación explícita; pasa a Cancelado. La baja siempre es manual: el sistema nunca cancela un presupuesto por su cuenta (RN-08).
- Un presupuesto Confirmado no se da de baja por esta vía (la cancelación de un evento reservado es HU-23) y uno ya Cancelado se rechaza.
- Como cada evento tiene un solo presupuesto, al darlo de baja su evento EnConsulta pasa también a Cancelado.
- El presupuesto Cancelado no se borra: sigue visible en el listado (HU-10) y en su detalle (HU-11), en solo lectura; no se modifica ni se recalcula, y su evento no admite pagos.
- Los pagos parciales registrados antes de la baja se conservan en el estado de cuenta (HU-21); lo abonado no se reintegra (RN-06).
- Solo el personal interno puede dar de baja un presupuesto; el rol Cliente no accede.

**Hecho (16/10/2026).** La baja ya se había construido en el Sprint 2 como parte de HU-12: `POST /api/presupuestos/:id/dar-de-baja` cancela el presupuesto y su evento en una sola transacción, y responde `409` si el presupuesto no está Estimado ni Expirado o si el evento ya no está EnConsulta, y `404` si no existe. Esta historia la cubre con tests por criterio: los CP-22-xx están en la Definición del Producto y no en el repo. Los tests prueban la baja de un Estimado y de un Expirado, el rechazo de un Confirmado y de un Cancelado, que no borra líneas ni pagos, que el detalle se sigue viendo, que un PATCH sobre un Cancelado da `409` y los permisos. En la web, la confirmación avisa que el evento también se cancela y que los pagos se conservan sin reintegro, y el formulario de un Cancelado queda deshabilitado. Los pagos del evento dado de baja se ven en su estado de cuenta (HU-21). Además, en el listado cada consulta Cancelada tiene un tacho que la saca del listado sin borrarla (`POST /api/presupuestos/:id/ocultar`, `204`; `409` si no está Cancelada): marca `Presupuesto.ocultoEn`, y el presupuesto sigue en su detalle, en el evento, en el historial del cliente y en la cuenta, como pide el criterio de no borrarlo (decisión de Franco, 16/10/2026).

## HU-23 — Registrar evento cancelado

Como Responsable de Eventos, quiero registrar la cancelación de un evento cuando el cliente desiste, para liberar el salón en la agenda y dejar constancia de la baja.

- Puedo cancelar un evento EnConsulta o Reservado, previa confirmación explícita; pasa a Cancelado. La cancelación siempre es manual: el sistema nunca cancela un evento por su cuenta.
- Un evento Cobrado o ya Cancelado no se puede cancelar.
- Un evento confirmado (Reservado) se puede cancelar hasta 48 horas corridas antes de su inicio; fines de semana y feriados cuentan (RN-07). Con menos anticipación se rechaza. Una consulta sin seña (EnConsulta) se cancela en cualquier momento (decisión del PO, 16/10/2026).
- Al cancelar un evento Reservado, el salón queda libre en ese horario y otro evento puede reservarlo.
- Las consultas que estaban marcadas «en conflicto» por ese evento dejan de estarlo (RN-12).
- Los pagos del evento se conservan en el estado de cuenta (HU-21); la seña no se reintegra (RN-06).
- El evento Cancelado no se muestra por defecto en el calendario (HU-15), pero sigue en el historial del cliente (HU-18); no admite pagos.
- Solo el personal interno puede cancelar un evento; el rol Cliente no accede.

**Bloqueante (S-01).** No está definido qué pasa con lo abonado por encima de la seña cuando el cliente cancela dentro del plazo. Hasta que el PO lo defina, la cancelación no registra ningún reintegro: los pagos solo se conservan para consulta.

**Hecho (16/10/2026).** `POST /api/eventos/:id/cancelar` ya existía desde el Sprint 1: acepta EnConsulta y Reservado (`409` en los demás), exige las 48 horas corridas solo a un Reservado con horario (`422`, RN-07; con exactamente 48 horas todavía se puede) y deja los pagos como están, sin reintegros (S-01 sigue abierto). Cancelar pasa a Cancelado el evento y sus presupuestos Estimado y Confirmado; el trigger de `EventoSalon` propaga el estado y el salón queda libre para otro evento (ADR 0011). «En conflicto» es una consulta de la aplicación, no un campo, así que deja de figurar sola al cancelarse el evento que la provocaba. Esta historia suma los tests de los criterios (CP-23-01 a CP-23-05 y los bordes del plazo) y, en la web, el botón **Cancelar consulta** en el detalle de un evento EnConsulta, que antes solo se podía dar de baja por su presupuesto; el aviso de confirmación de un evento confirmado dice que el salón queda libre y que lo abonado no se reintegra.

## HU-24 — Reutilizar configuración de un evento anterior

Como Responsable de Eventos, quiero generar una consulta nueva a partir de la configuración de un evento anterior, para no volver a cargar salón, distribución y servicios cuando un cliente recurrente repite su evento.

- Desde el detalle de un evento o desde el historial del cliente (HU-18) elijo «Reutilizar configuración» e indico la nueva fecha y el horario; la fecha es obligatoria y debe ser futura.
- Se crea un evento nuevo en estado EnConsulta para el mismo cliente, con el tipo de evento, los salones, la distribución, la jornada, la cantidad de personas y los servicios (con sus cantidades y su modalidad) del evento original.
- El presupuesto nuevo nace Estimado, con los precios vigentes del catálogo y no los congelados del original, y con 10 días de vigencia (RN-08); muestra subtotal sin IVA, IVA 21% y total (RN-05).
- Los servicios del original que ya no están disponibles en el catálogo no se copian y el sistema avisa cuáles quedaron afuera; los tercerizados «a cotizar» se copian sin importe.
- No se copian los pagos, el estado ni los ajustes comerciales de precio del evento original (RN-03).
- El evento original no se modifica.
- La consulta nueva no bloquea el salón: si la fecha ya está reservada, queda marcada «en conflicto» (RN-12). Después se modifica como cualquier presupuesto Estimado (HU-12).
- Solo el personal interno puede reutilizar la configuración de un evento; el rol Cliente no accede.

**Modalidad de servicio (RN-11), en este sprint** (decisión del PO, 16/10/2026). Para los servicios que la admiten (hoy los coffee breaks), el cliente en el cotizador y el Responsable de Eventos al armar o modificar el presupuesto eligen **normal, continuo en salón (+20%) o en mesas con mozo (+30%)**. El recargo va sobre el precio base por persona, sin IVA, y por cada servicio (RN-11); la línea guarda la modalidad, el precio base y el precio con recargo, y el presupuesto y su PDF la muestran. Mientras S-09 siga abierto, **una sola modalidad por servicio**. Hacen falta la columna `modalidad` en `LineaPresupuesto` y `admiteModalidad` en `Servicio`: `modelo-datos.md` ya las describe, pero ninguna existe en `schema.prisma`. Es un cambio de modelo que se confirma antes de tocar el schema.

**Implementación.** `POST /api/eventos/:id/reutilizar` (`201` con el evento nuevo y los servicios que quedaron afuera; `400` sin fecha o con fecha pasada). Crea evento y presupuesto en una sola transacción, como `POST /api/presupuestos`, y copia la modalidad de cada línea recalculando el recargo sobre el precio vigente.

> **A revisar con el equipo (17/10/2026).** Esta funcionalidad se definió sobre la marcha durante la implementación y todavía no la validó el resto del equipo ni el PO. Revisar en particular: (1) dónde viven las acciones (hoy, dentro del presupuesto), (2) la ampliación «Copiar configuración de otro evento» sobre una consulta existente, que la HU no pedía, (3) qué se copia y qué queda por defecto (personas, jornada, cantidades y horas), (4) el adelanto de la proyección de RN-13 desde HU-34 y (5) que un mismo servicio pueda repetirse con distinta modalidad (ADR 0012).

**Cómo quedó (decisiones del equipo al implementar, 16/10/2026).**

- Las dos acciones viven **dentro del presupuesto** (la pantalla de la consulta), junto a cliente, evento y servicios:
  - **«Reutilizar en una consulta nueva»**: lo que pide la HU. Crea una consulta nueva con la configuración de este evento.
  - **«Copiar configuración de otro evento»** (ampliación, avisar al PO): en una consulta que todavía se puede modificar, trae la configuración de **cualquier evento** (de este cliente o de otro, con un buscador por cliente, salón o armado) al formulario. Se copian solo los salones, el tipo de evento, los servicios con su modalidad y los adicionales; lo propio de cada cliente no viaja: la fecha, la hora, las personas, la jornada, el cliente y la solicitud siguen siendo los de la consulta, las cantidades vuelven al valor por defecto (las personas de la consulta, o 1) y las horas quedan vacías (equipo, 17/10/2026). El armado no se copia (se elige al agendar). No se guarda nada hasta «Guardar» y se puede deshacer. Sirve para no duplicar consultas cuando el cliente ya mandó la suya desde el cotizador.
- Se reutiliza un evento en **cualquier estado**, también Cancelado (el cliente que canceló y vuelve).
- En las dos acciones se copia solo lo reutilizable (equipo, 17/10/2026): salones, tipo de evento, servicios con su modalidad y adicionales; «Reutilizar en una consulta nueva» copia también el armado de los salones. Lo propio del cliente no viaja: las cantidades vuelven al valor por defecto (las personas del evento, o 1) y las horas quedan vacías.
- El diálogo de «Reutilizar en una consulta nueva» pide, como el cotizador, la **fecha** (futura, en hora de Córdoba), las **personas**, la **jornada** y una **hora aproximada opcional**. El horario exacto se carga al agendar (ADR 0007). Por eso «en conflicto» (RN-12) es un aviso **por día**: alguno de los salones ya tiene un evento Reservado o Cobrado esa fecha.
- Se copian también los **adicionales** escritos a mano, con su descripción y su precio. No se copian pagos, estado, solicitud ni notas de la comanda.
- **RN-13 se adelanta en parte desde HU-34** (avisar al PO): los precios del salón y de los servicios propios se proyectan a la fecha del evento con el porcentaje mensual de `ConfiguracionPrecios`, que arranca en 0% y edita el Responsable de Eventos en Catálogo. Vale en el cotizador, al armar o modificar un presupuesto y al reutilizar. Sigue en HU-34 aplicar el aumento al tarifario cada mes, los aumentos puntuales y su historial.
- La modalidad es una columna de la línea (ADR 0012). Las variantes con recargo del seed se dieron de baja y sus líneas se convirtieron. Un mismo servicio puede repetirse en un presupuesto **con distinta modalidad** en cada línea.

## Casos de prueba

El diseño de casos de prueba de cada historia (CP-16-01 en adelante) está en la Definición del Producto v0.4. Se automatizan con Vitest + Supertest sobre `crearApp()`, igual que en los sprints anteriores.

## Definición de Terminado

Una historia está terminada cuando sus criterios pasan como tests automatizados, el código fue revisado por otro integrante vía pull request, el CI corre sin errores y la funcionalidad está desplegada y accesible.

La auditoría de las operaciones que modifican datos sigue fuera de la definición: se implementa completa en el EPIC-08 (HU-25, Sprint 5).

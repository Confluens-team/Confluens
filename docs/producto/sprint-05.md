# Sprint 5 — Confluens

Del 06/11/2026 al 20/11/2026 · Scrum Master: Facundo Andrés Pfening · Release 3 «Gestión y control»

> **Estado al 14/11/2026: todo el alcance propuesto está construido en `sprint-05`, y también HU-50
> (evento de varios días), que entró después.** La propuesta
> se armó el 06/11/2026 a pedido del PO a partir de la tabla de distribución por sprint del
> `Seguimiento del Proyecto` (sección 2.8), de `backlog.md` y de lo que ya existe en el código. El
> 12/11/2026 se revisó cada historia contra el código de la rama y se actualizó la columna
> «Situación hoy»; el 14/11/2026 se sumó HU-50 y lo que cambió desde entonces. Lo que sigue
> pendiente no es código: ver «Pendiente del sprint». Hasta entonces este
> archivo usa los **códigos de `backlog.md`** («HU-25 del backlog» es la auditoría, no la HU-25 del
> Sprint 4).
>
> **Diferencias con la tabla del Seguimiento:**
> - **Entran** HU-54 y HU-55 (reunión con el cliente del 05/11/2026). Cambian reglas que el código
>   ya aplica distinto: mientras no se construyan, el sistema sigue con las reglas viejas.
> - **HU-53 (IVA siempre) no va acá:** el PO la adelantó al cierre del Sprint 4 (06/11/2026), porque
>   para la exposición todo tiene que estar calculado con IVA y sin la casilla de factura.
> - **Sale** HU-34 (incremento por tramos, 13 SP) al Sprint 6: no entra junto con la auditoría y no
>   bloquea nada de este sprint, porque HU-54 funciona con el porcentaje único de hoy.
> - **Entró** HU-56 (permisos por rol), que se proponía como candidata si sobraba lugar: ya está
>   construida (PR #122).
> - **Entró** HU-50 (evento de varios días), que no tenía lugar en ningún sprint: el PO la definió el
>   12/11/2026 y ya está construida (PR #141 a #144). HU-51 y HU-52 y dos historias que salieron del
>   Sprint 4 (HU-18 y HU-22) siguen sin lugar en ningún sprint. Ver «Lo que no entra».

Objetivo: que el sistema aplique las reglas acordadas con el cliente el 05/11/2026 que siguen
pendientes (recálculo automático y seña de un presupuesto vencido), que deje rastro de quién cambió qué
(auditoría, que la Definición de Terminado deja para este sprint) y que el GG y el ADM terminen de
administrar al personal.

## Rama del sprint

**Decisión del PO (06/11/2026): el Sprint 5 se integra en la rama `sprint-05`, no en `develop`.**
`develop` y `main` quedan como están para la exposición, y el sprint entra recién después.

- `sprint-05` salió de `develop` con todo el Sprint 4 y HU-53.
- Cada historia sale de `sprint-05` y vuelve a `sprint-05` por pull request, con la plantilla, CI en
  verde y la revisión de otro integrante: lo mismo que pide `AGENTS.md` §3, cambiando `develop` por
  `sprint-05`. El CI corre en cualquier pull request, también los que van a `sprint-05`.
- Después de la exposición, `sprint-05` entra a `develop` por un pull request (merge commit, como
  siempre). Al 14/11/2026 `sprint-05` lleva 97 commits que `develop` no tiene y `develop` no tiene
  ninguno que le falte a `sprint-05`, así que ese pull request entra sin conflictos. Trae migraciones
  nuevas (HU-50 y las observaciones por día): hay que aplicarlas en cada base donde corra `develop`,
  probando primero en una copia de la demo con `DATABASE_URL` y `DIRECT_URL` forzadas.
- Si a `develop` le llega un arreglo urgente antes de eso, se mergea `develop` en `sprint-05` para
  no divergir.
- **Protección:** del 07/11/2026 al 12/11/2026 la rama tuvo su propio ruleset de GitHub, «Flujo
  equipos: proteger sprint-05» (pull request con 1 aprobación, solo merge commit, los cinco checks
  del CI y sin borrado ni push forzado). **El PO lo eliminó el 12/11/2026**, por considerarlo muy
  tosco. Desde entonces `sprint-05` no tiene protección en GitHub: se puede pushear
  directo y no hay checks obligatorios. El ruleset de `develop` y `main` no se tocó.
- **Al mergear `sprint-05` a `develop`, queda borrar la rama**, en GitHub o con
  `git push origin --delete sprint-05`. Ya no hay ruleset que borrar antes.
- `develop` se mergeó en `sprint-05` el 12/11/2026 para no divergir. Al integrar las dos
  implementaciones de HU-54 (la de `sprint-05` del 06/11 y la de `develop` del 09/11) el PO
  decidió **conservar la de `sprint-05` y sumarle lo de `develop`**; ver HU-54 y HU-55 más abajo.

## Alcance propuesto

| Backlog | Título | Actor | SP | Situación hoy |
|---|---|---|---|---|
| HU-25 | Registrar el usuario y la fecha de cada modificación (auditoría) | SYS | 8 | Construida (PR #118): mecanismo común, consulta para el GG y el ADM y pestaña Auditoría (ADR 0013) |
| HU-54 | Recalcular el presupuesto automáticamente | SYS | a estimar | Construida (PR #113). El cambio de fecha también marca en pantalla los precios que cambiaron y pide confirmarlos al guardar (de `develop`, 09/11/2026) |
| HU-55 | Cobrar la seña de un presupuesto vencido | RF | a estimar | Construida (PR #112). El panel también deja registrar pagos con la consulta vencida |
| HU-30 | Modificar un usuario | GG / ADM | 3 | Construida (PR #114): modificar el rol y cambiar la contraseña, también desde Mi cuenta |
| HU-31 | Dar de baja un usuario | GG / ADM | 2 | Construida (PR #114), con `Usuario.activo` |
| HU-24 | Avisar por WhatsApp la recepción de la consulta y descargar su resumen en PDF | RE | 5 | Revisada contra los criterios en el PR #116, sin cambios. Falta re-estimarla en la Planning |
| — | Enviar correo de confirmación de consulta | SYS | a estimar | Construido (PR #121 y siguientes): confirmación breve, sin resumen ni PDF adjunto (PO, 07/11/2026); no necesitó dependencia nueva. Sin dominio (S-11) solo llega al dueño de la cuenta de Resend |
| HU-56 | Restringir el panel interno según el rol | todos | a estimar | Construida (PR #122): matriz de permisos por rol, restricciones en la API y secciones de Configuración según el rol |
| HU-50 | Reservar un evento de varios días | RE | a estimar | Construida en cuatro partes (PR #141 a #144) y con las correcciones del PO del 13/11/2026 (ver «HU-50 del backlog»). Queda abierto `S-16` (hora estimada por día) |
| — | Cerrar sesión | todos | — | Cubierta con tests (PR #116) |
| — | Cambiar contraseña | todos | — | Restablecimiento por correo cubierto con tests (PR #116). Desde Mi cuenta, con HU-30 (PR #114) |
| | **Total estimado** | | **18 + a estimar** | |

Velocidad de los sprints anteriores: 31, 32, 36 y 34. Con 18 SP estimados quedan unos 15 para
HU-54, HU-55 y el correo. HU-56 (permisos por rol), que se proponía como candidata si sobraba
lugar, entró y está construida: sus reglas están en `dominio.md`.

Correcciones sin historia (`backlog.md`, reunión 05/11/2026), que se arreglan en este sprint y ya están hechas (PR #115):

- el nombre del PDF del presupuesto, `presupuesto-AAAA-MM-DD-apellido.pdf` con la fecha del evento;
- los campos de importe, que solo aceptan dígitos y un separador decimal;
- el botón «Salir» del cotizador, que no funciona y tiene que pedir confirmación («¿Seguro que querés
  salir? Tu consulta todavía no se completó»).

Los campos de importe ya los cubría `InputImporte`. **Pendiente: cargar estas tres tareas en Jira** (no tienen historia propia; PO, 06/11/2026).

Entró a la rama después de la propuesta (sin historia propia en este documento):

- La confirmación por correo también para la consulta social (PR #124).
- Desde `develop` (mergeado en `sprint-05` el 12/11/2026): hora de fin estimada de la consulta de un
  evento social, selectores de hora en la landing y el cotizador, la duración del cotizador que pasa
  a los salones, vista previa de las fotos de la landing, correcciones de seguridad (PR #135), el
  segundo cambio de fecha (HU-54, PR #130), el cambio de salón y de fecha de un evento confirmado
  (HU-12, PR #132) y ajustes para la exposición (PR #138).
- Desde la rama `chore/marca-confluens-en-el-panel` (PR #140, mergeado en `develop`): la marca de
  Confluens en el encabezado del panel, las **observaciones del evento** (internas del personal;
  migración y endpoint `PATCH /eventos/:id/observaciones`; desde el 13/11/2026 son de cada día, ver
  HU-50) y «Fiesta empresarial» en lugar de «Fiesta corporativa».
- HU-50, el evento de varios días (PR #141 a #144), con las correcciones del PO del 13/11/2026 y dos
  arreglos del panel: tocar la pestaña activa o el logo vuelve al listado, y la pantalla ya no salta
  al actualizar los datos.

Orden sugerido: HU-55 → HU-54 (las dos tocan el presupuesto y conviene no pisarse) en
paralelo con HU-25; después HU-30 y HU-31 juntas; HU-24 y el correo al final.

## Definiciones del PO (06/11/2026)

| Historia | Definido |
|---|---|
| HU-25 | Se audita **todo el panel interno**: salones y distribuciones, landing, servicios y precios, medios de pago, clientes, consultas y presupuestos, eventos, pagos y personal. Se consulta en una pestaña **Auditoría** de Configuración de negocio, solo para el GG y el ADM, que se puede filtrar por el campo auditado. |
| HU-30 | **La contraseña de otro usuario solo la cambia el ADM**, la de cualquiera. Fuera de él, cada usuario cambia solo la suya, desde Mi cuenta. |
| HU-31 | Se construye con la baja lógica de `dominio.md`. El cambio de modelo (`Usuario.activo`) queda confirmado. |
| HU-24 | Funciona bien: se revisa contra los criterios, sin trabajo nuevo salvo lo que falte. |
| Cerrar sesión, cambiar contraseña | Se cubren con tests. El PO quiere revisar en la app cómo funciona el restablecimiento por correo. |
| Correo | Se manda **solo cuando el cliente confirma la consulta en el cotizador**, no cuando la carga el personal. Es una **confirmación breve, sin resumen del evento ni PDF adjunto** (PO, 07/11/2026): el cliente ya descarga su presupuesto estimado desde el cotizador y el definitivo se lo envía el Responsable de Eventos. **No hay dominio propio todavía** (S-11): hasta conseguirlo, solo llega al correo del dueño de la cuenta de Resend. |

**Cambios de modelo** (cada uno se confirma antes de tocar `schema.prisma`, `AGENTS.md` §6):
`Usuario.activo` (HU-31, confirmado) y `AuditLog.campos` (HU-25, con el trigger que hace inmutable
el registro). Fuera del alcance original: `Evento.horaFinEstimada` y `Evento.observaciones` (esta
última confirmada por el PO el 12/11/2026 y pasada a `EventoDia.observaciones` el 13/11/2026, cuando
cada día pasó a tener las suyas). HU-50 sumó la tabla `EventoDia` y sus triggers (ADR 0014, aceptada
por el PO el 12/11/2026).

**Sin dependencias nuevas.** El correo no lleva el PDF adjunto ni un resumen (PO, 07/11/2026): el PDF
se sigue descargando desde el cotizador con la impresión del navegador. Así no hace falta una
librería de PDF en el servidor ni adjuntos en `correo.ts`.

## HU-25 del backlog — Registrar el usuario y la fecha de cada modificación

Como Sistema, quiero registrar quién modificó qué y cuándo, para que la gerencia pueda reconstruir
cualquier cambio.

Criterios propuestos:

- Cada operación auditada deja un registro con el usuario, la fecha, la entidad, su id, el valor
  anterior y el valor nuevo (`dominio.md`, «Auditoría»). Solo los campos que cambiaron.
- El registro se escribe en la misma transacción que el cambio: o quedan los dos o ninguno.
- El registro es inmutable: no se modifica ni se borra.
- Lo que hace el Sistema (tareas programadas, recálculos) queda con usuario vacío (`SYS`).
- Se audita todo el panel interno (PO, 06/11/2026): salones y distribuciones, landing, servicios y
  precios, medios de pago, clientes, consultas y presupuestos, eventos, pagos y personal.
- La auditoría la ven solo el GG y el ADM (`dominio.md`, «Roles»), en una pestaña **Auditoría** de
  Configuración de negocio: cada cambio con su fecha, usuario, parte del sistema, campo, valor
  anterior y valor nuevo, del más reciente al más antiguo.
- Se puede **filtrar por el campo auditado** (por ejemplo, «precio» o «estado») para encontrar
  rápido lo que se busca revisar, además de por parte del sistema, usuario y fechas.

**Implementación.** Un helper común en `apps/api/src/lib/auditoria.ts` que recibe el `tx` de cada
repositorio y toma el usuario de la sesión que abrió `autenticar`. Se agrega `AuditLog.campos` y un
trigger que impide modificar o borrar el registro (PO, 07/11/2026). El canal público queda afuera.
Detalle en ADR 0013.

## HU-54 del backlog — Recalcular el presupuesto automáticamente

Criterios propuestos (`dominio.md`, «Recálculo automático»):

- No hay botón Recalcular.
- Al cambiar la fecha del evento, el presupuesto se recalcula con los precios de la fecha nueva
  (RN-13), en cualquier estado, también `Confirmado`, y reinicia la vigencia: un `Expirado` vuelve a
  `Estimado`.
- Al cambiar el porcentaje de incremento se recalculan solo los `Estimado` de eventos
  `EnConsulta`, sin reiniciar la vigencia. Los `Confirmado` quedan congelados y los `Expirado`
  esperan a que les cambien la fecha.
- Corrige HU-27 del Sprint 4, que deja recalcular un presupuesto `Confirmado` sin cambio de fecha.

## HU-55 del backlog — Cobrar la seña de un presupuesto vencido

Criterios propuestos (RN-06, RN-08):

- La seña se registra aunque el presupuesto esté `Expirado`, sin recalcularlo.
- Agrega `Expirado → Confirmado` a la máquina del presupuesto (ya figura en `dominio.md`).
- La vigencia de 10 días sigue siendo una leyenda para el cliente; en el panel no bloquea nada.

## HU-30 y HU-31 del backlog — Modificar y dar de baja un usuario

Continúan HU-30 y HU-31 del Sprint 4 (alta y consulta), en la sección Personal. Criterios
propuestos (`dominio.md`, «Personal»):

- El GG y el ADM modifican el rol de un usuario del personal, con las mismas reglas que el alta:
  el GG asigna GG, RE y RF; el ADM, cualquiera.
- El GG no modifica, no cambia el rol ni da de baja a un ADM, y el GG y el ADM no se quitan el rol
  entre sí.
- Siempre queda al menos un GG y un ADM activos: el cambio de rol o la baja que los deje en cero se
  rechaza.
- La baja es lógica: el usuario queda inactivo, no puede iniciar sesión y se cierran sus sesiones
  (subir `versionSesion`). Se sigue viendo en la auditoría y en lo que registró, y se puede
  reactivar.
- **Contraseñas** (PO, 06/11/2026): el ADM le puede cargar una contraseña nueva a cualquier usuario
  del personal. Nadie más cambia la contraseña de otro. Cada usuario cambia la suya desde **Mi
  cuenta**, con la contraseña actual y la nueva (mínimo 6 caracteres), sin pasar por el correo. Al
  cambiarla se cierran sus otras sesiones.

## HU-24 del backlog — Aviso por WhatsApp y resumen en PDF

Ya existen el botón `wa.me` (`BotonWhatsApp.tsx`, en el detalle y el seguimiento de la consulta) y
la descarga del presupuesto en PDF con `window.print()`. Según el PO funciona bien (06/11/2026): se
revisa contra los criterios de la Definición del Producto y se re-estima.

## HU-50 del backlog — Reservar un evento de varios días

Un evento dura de 1 a 32 días corridos y cada día tiene su horario, jornada, salones con su
distribución, personas y servicios, con un solo presupuesto, un solo total y una sola seña. La
definió el PO el 12/11/2026 (`backlog.md`, `dominio.md`) y el diseño de datos está en la ADR 0014, que
detalla cada parte. Se construyó en cuatro partes, todas mergeadas en `sprint-05`:

1. **Modelo y solapamiento por día** (PR #141): `EventoDia`, `EventoSalon` por día, la restricción de
   exclusión y la migración de los eventos de hoy, que quedan con un día.
2. **Cotizador y presupuesto por día** (PR #142): selector de franja de hasta 32 días, una pestaña por
   día y el documento del presupuesto día por día.
3. **Agenda, reserva y comanda por día** y 4. **repetir y modificar un evento reservado día por día**
   (PR #143): horario por día, aviso de todos los choques, agenda en barra larga, comanda por día,
   repetir con la misma franja y recálculo con el último día como referencia.

**Correcciones del PO del 13/11/2026** (PR #144), también en `sprint-05`:

- **Distribución por día:** el mismo salón puede armarse distinto cada día (`fecha` opcional en cada
  distribución de `POST /eventos/:id/agendar`).
- **Observaciones por día:** cada día tiene las suyas (`EventoDia.observaciones`, migración
  `20261113150000`). Las que ya existían pasaron al primer día; `Evento.observaciones` queda sin uso.
  Cambia la regla de `dominio.md`.
- **Detalle del evento de varios días:** un solo bloque con el selector de día y, debajo, las
  observaciones y el presupuesto de ese día con su subtotal. El total sin IVA se ve siempre.
- **Lápiz del horario** en los datos del evento; el formulario de horario y distribución sigue en
  «Agendar y registrar pago» de una consulta.

**Abierto:** `S-16` (hora estimada de inicio por día, `pendientes.md`), la estimación de la historia en
la Planning, y llevar la regla de las observaciones por día a los documentos de Drive. Sin aplicar
todavía a las bases que no sean la local: las migraciones de HU-50 y de las observaciones.

## Cerrar sesión y cambiar contraseña

Ya existen y se cubren con tests: cerrar sesión (`POST /auth/logout`, invalida el token en todos los
dispositivos) y el restablecimiento por correo («¿Olvidaste tu contraseña?»: un enlace que vence en
30 minutos y sirve una sola vez, y al usarlo cierra las demás sesiones). El restablecimiento usa
Resend, así que sin dominio (S-11) hoy solo le llega al dueño de la cuenta. El cambio desde adentro
del panel va con HU-30.

## Enviar correo de confirmación de consulta

Criterios (PO, 06/11/2026; simplificados el 07/11/2026, ver más abajo):

- Se manda cuando el **cliente confirma su consulta**, en el cotizador (`POST /presupuestos`, con la
  sesión de un cliente) o en la consulta social (`POST /presupuestos/social`, ADR 0008), que se envía
  desde la misma pantalla. Si la carga el personal desde el panel, no sale correo.
- Va al correo de la ficha del cliente de la sesión.
- **Es solo una confirmación** (PO, 07/11/2026): le deja tranquilo de que su consulta llegó y repite
  el mensaje que ya ve en pantalla (el del cotizador o el de la consulta social), con el teléfono de
  su ficha y el número de consulta. **No lleva resumen del evento, importes ni PDF adjunto**: el
  presupuesto estimado ya lo descarga desde el cotizador y el definitivo se lo envía el Responsable
  de Eventos. Lleva el sello de Los Abuelos (bordó, dorado y crema de la web), hecho con texto y no
  con una imagen remota.
- Si el correo falla, la consulta se guarda igual: el correo no bloquea la confirmación. El envío no
  espera a Resend para responder, y un fallo queda en el log de la API.

Antes de esta simplificación el correo llevaba el resumen del evento (fecha, salón y servicios con su
importe, subtotal, IVA y total, y la vigencia de 10 días) y la aclaración de que no reserva el salón.
Esa versión se mergeó en el PR #121 y la reemplaza este cambio.

Resend ya se usa para restablecer la contraseña (ADR 0006). **Falta el dominio** (S-11): hasta
verificarlo, el remitente de prueba solo entrega al dueño de la cuenta de Resend, así que un cliente
real no lo recibe. Verificar el dominio y cargar `CORREO_REMITENTE` no requiere cambios de código.

## Lo que no entra

**Sprint 6 (20/11 al 04/12), según la tabla del Seguimiento más HU-34:**

| Backlog | Título | SP | Nota |
|---|---|---|---|
| HU-34 | Configurar el incremento de precios (tramos y porcentaje por servicio) | 13 | Movida desde el Sprint 5 |
| HU-21 | Generar el reporte de ingresos | 8 | |
| HU-23 | Notificar el próximo vencimiento de un pago | 8 | **Bloqueada** por S-05 (vencimiento del saldo) |
| HU-35 | Dar de baja un servicio | 2 | |
| HU-39 | Dar de baja un medio de pago | 2 | |
| | **Total** | **33** | |

**Sin lugar en ningún sprint** (el proyecto termina el 04/12): el PO decide cuáles entran en el
Sprint 6 en lugar de otras y cuáles quedan fuera del alcance de la tesis.

| Backlog | Título | SP | Nota |
|---|---|---|---|
| HU-51 | Agregar servicios propios a un evento | a estimar | Reemplaza la caja de texto del evento social (S-14) |
| HU-52 | Registrar lo pagado de más como no reintegrable | a estimar | Cambio de modelo |
| HU-18 | Reasignar un evento a otro salón | 8 | Salió del Sprint 4 |
| HU-22 | Generar el reporte de servicios contratados | 5 | Salió del Sprint 4 |

## Pendiente del sprint

No queda código del alcance. Lo que falta (al 14/11/2026):

- **Pasar `sprint-05` a `develop`** por pull request, después de la exposición, y borrar la rama (ver
  «Rama del sprint»). Hasta entonces «desplegada y accesible» no se cumple, por diseño.
- **Estimar en la Planning** HU-54, HU-55, el correo, HU-56 y HU-50, y **re-estimar** HU-24.
- **Pasar alcance, puntos y numeración** al `Seguimiento del Proyecto` y a los documentos de Drive.
- **Cargar en Jira** las tres correcciones sin historia (nombre del PDF, importes y botón «Salir»).
- **Definición del Producto:** criterios, prototipo, casos de prueba y resultados de las historias.
- **Dominio propio para el correo** (S-11): sin él, la confirmación de consulta y el restablecimiento
  de contraseña solo le llegan al dueño de la cuenta de Resend.
- **Revisar en la app el restablecimiento de contraseña por correo** (pedido del PO, 06/11/2026).
- **Migrar la demo y la base de producción** con las migraciones de HU-50 y de las observaciones por
  día, probando antes en una copia.
- **S-16:** decidir si la hora estimada de inicio se guarda por día.

## Definición de Terminado

La misma del Sprint 4: los criterios pasan como tests automatizados, el código fue revisado por
otro integrante vía pull request, el CI corre sin errores, la funcionalidad está desplegada y
accesible, y la Definición del Producto tiene sus criterios, prototipo, casos de prueba y
resultados. La auditoría deja de quedar afuera: entra con HU-25 del backlog. Al 14/11/2026
«desplegada y accesible» no se cumple todavía, por diseño: `sprint-05` entra a `develop` recién
después de la exposición.

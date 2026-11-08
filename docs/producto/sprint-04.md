# Sprint 4 — Confluens

Del 23/10/2026 al 06/11/2026 · Scrum Master: Ayrton Vanega · 11 historias + HU-53 del backlog · 34 puntos (backlog, sin Planning Poker; HU-36 eliminada y HU-53 agregada por el PO, 06/11/2026)

> **Fuentes.** `Seguimiento del Proyecto` v0.5 (sección 6, Sprint 4: alcance, Sprint Backlog y
> puntos a definir con el PO) en Drive, y `Definicion_del_Producto` v0.6 (29/10/2026), que suma
> HU-25 a HU-36 con criterios de aceptación (C1, C2…), casos de prueba (CP-25-01 en adelante) y
> los puntos a definir de cada historia. Los criterios se armaron con `dominio.md` y con lo que ya
> existe en el código, y **todavía no los validó el PO**: se validan antes de construir cada
> historia (retrospectiva del Sprint 3). Si este archivo y la Definición del Producto difieren,
> vale la Definición del Producto.
>
> **Notas de esta versión:**
> - **Puntos.** No hubo Planning Poker: la columna *SP* es la del Sprint Backlog del Seguimiento,
>   que toma la estimación del backlog. HU-36 figuraba «A estimar»; el PO la eliminó (06/11/2026).
> - **Numeración.** Como en los sprints anteriores, se usa la numeración local del Seguimiento
>   (HU-25 a HU-36). La columna *Backlog* da el código de `backlog.md`. Ojo con los choques: en
>   `sprint-03.md`, «HU-34» es la del backlog (incremento de precios); acá HU-34 es *Consultar pagos
>   de un evento*. Cuando se cite una historia del backlog se escribe «HU-xx del backlog».
> - **Diferencias con `backlog.md`.** Su tabla «Distribución por sprint» ponía en el Sprint 4 dos
>   historias que el Seguimiento no toma: *Reasignar un evento a otro salón* (HU-18 del backlog,
>   8 SP) y *Generar el reporte de servicios contratados* (HU-22 del backlog, 5 SP). Y el Seguimiento
>   suma tres que `backlog.md` no tiene con código propio: la comanda (HU-29, de S-07), *Consultar
>   pagos de un evento* (HU-34) y *Anular pago de un evento* (HU-35). Vale el Seguimiento; falta
>   decidir a qué sprint van las dos que quedaron afuera y actualizar `backlog.md`.

Objetivo: cerrar el Release 2 (MVP operativo). Completar lo que falta para que el sistema reemplace
las planillas en el trabajo diario: mantener los datos de salones, servicios, medios de pago y
eventos sin tocar la base, dar de alta al personal con su rol y cerrar el circuito del cobro con la
anulación de pagos.

Orden del Seguimiento: Salones → Eventos → Usuarios → Catálogos → Pagos.

## Alcance

| HU | Título | Actor | Backlog | SP | Estado (06/11/2026) |
|---|---|---|---|---|---|
| HU-25 | Registrar distribuciones posibles de un salón | RE | HU-02 | 5 | Hecha (#88 y #107), con la baja lógica |
| HU-26 | Modificar información de un salón | RE | HU-03 | 3 | Hecha (#89 y #95): precios y distribuciones |
| HU-27 | Modificar datos de un evento | RE | HU-16 | 5 | Hecha (#90 y #96): tests y vigencia al recalcular |
| HU-28 | Registrar evento cobrado | RF | HU-20 | 5 | Hecha (#91): cubierta con tests |
| HU-29 | Generar y emitir comanda | RE | — (S-07) | 2 | Hecha (#92) |
| HU-30 | Registrar usuario | GG / ADM | HU-28 | 3 | Hecha (#105): alta en Personal, con la contraseña inicial que define el GG o el ADM |
| HU-31 | Consultar usuario | GG / ADM | HU-29 | 2 | Hecha (#105): listado en Personal, con filtro por rol |
| HU-32 | Modificar servicio | RE | HU-33 | 3 | Hecha (#93) |
| HU-33 | Modificar medio de pago | RF | HU-38 | 2 | Hecha (#94) |
| HU-34 | Consultar pagos de un evento | RF | — | 2 | Hecha: cubierta por HU-21, sin código nuevo |
| HU-35 | Anular pago de un evento | RF | — | 2 | Hecha: anulación sin borrar el pago |
| ~~HU-36~~ | ~~Generar y emitir un recibo como comprobante válido de pago~~ | RF | — | — | **Eliminada (PO, 06/11/2026)** |
| — | Calcular todo presupuesto nuevo con IVA | SYS | HU-53 | a estimar | Hecha: agregada por el PO al cierre del sprint |
| | **Total (sin HU-53)** | | | **34** | **Hechos: 34** |

Velocidad de los sprints anteriores: 31, 32 y 36. Con 34 puntos el sprint queda en línea, pero
varias historias valen menos de lo estimado porque ya están hechas en parte (HU-29, HU-34 y, según
lo que defina el PO, HU-27 y HU-28), y HU-35 puede valer más: conviene re-estimarla.

## Puntos a definir con el PO (Seguimiento, 6.3)

**Bloquean la historia**: no se construye la parte afectada hasta que el PO lo defina. Las
decisiones se registran acá, en `dominio.md` si cambian una regla, y en la Definición del Producto.

| Historia | Qué falta definir |
|---|---|
| HU-25 | ~~Si una distribución se puede dar de baja cuando ya la usa un evento.~~ **Sí, con baja lógica; no afecta a los eventos que ya la tienen (PO, 06/11/2026).** ~~Si se puede modificar.~~ **Sí, se modifica aunque la use un evento (equipo, 03/11/2026).** |
| HU-26 | ~~Confirmar que la historia es la edición de los datos del salón (capacidad, superficie, precios).~~ **El alcance son los precios y las distribuciones; la capacidad máxima y la superficie no se modifican (equipo, 03/11/2026).** |
| HU-27 | ~~Si hace falta una pantalla propia del evento o alcanza con lo que ya existe.~~ **Alcanza con lo que existe: la historia se cubre con tests y se re-estima (equipo, 03/11/2026).** |
| HU-28 | ~~Si la historia agrega algo al cambio automático a Cobrado de HU-14.~~ **No agrega nada: se cubre con tests y se re-estima (equipo, 03/11/2026).** |
| HU-30 | ~~Cómo recibe el usuario su primera contraseña.~~ **Se la carga el GG o el ADM al registrarlo (reunión con el cliente, 05/11/2026; PO, 06/11/2026).** |
| HU-35 | ~~Cómo se registra la anulación sin borrar el pago (fecha, usuario y motivo); quién puede anular.~~ **Se guardan la fecha y el usuario que anuló, sin motivo; anula cualquier rol del personal (PO, 06/11/2026).** ~~Qué pasa con el estado del evento si lo abonado baja del 20% o del 100% de la base de cobro.~~ **Por debajo de la seña sigue `Reservado`, con un aviso; un `Cobrado` por debajo del 100% vuelve a `Reservado` (reunión 05/11/2026; PO, 06/11/2026).** |
| HU-36 | ~~Qué datos lleva el recibo y si tiene numeración propia.~~ **Historia eliminada (PO, 06/11/2026).** |

Además de los del Seguimiento, al cruzarlo con `dominio.md` y el código aparecen estos (agregados
en esta versión, también para el PO):

| Historia | Qué falta definir | Por qué |
|---|---|---|
| HU-30, HU-31 | ~~Si la división de funciones por rol empieza con estas historias.~~ **Quedó definida en la reunión del 05/11/2026 (`dominio.md`, «Roles» y «Personal»): `/usuarios` distingue roles desde estas historias; los permisos del resto del panel son HU-56 del backlog.** | Hoy todo el personal entra al mismo panel y hace todo (decisión provisoria del PO, 06/10/2026). La regla de quién asigna qué rol necesita que la API distinga roles en `/usuarios`. |
| HU-33 | ~~Si se puede cambiar con qué casos se habilita un medio del catálogo inicial (Efectivo, Transferencia, Débito, Crédito, Cheque y A la habitación).~~ **Sí, todos son editables (equipo, 03/11/2026).** | RN-14 fijaba esa habilitación y `dominio.md` no dejaba cambiarla sin el PO. |
| HU-35 | ~~Si una anulación puede sacar a un evento de `Reservado` o de `Cobrado`.~~ **Si lo pagado queda por debajo de la seña, el evento sigue `Reservado` y el sistema avisa que no la cubre: no se agrega `Reservado` → `EnConsulta` (reunión 05/11/2026).** | `Cobrado` → `Reservado` ya existe al modificar un presupuesto por encima de lo pagado (HU-12), pero `Reservado` → `EnConsulta` no está en la máquina de estados aprobada: agregarla es cambiar `dominio.md`. |
| HU-25, HU-26 | ~~Si bajar la capacidad de un salón por debajo de la de una de sus distribuciones se rechaza o arrastra la distribución.~~ **Ya no aplica: la capacidad del salón no se modifica (equipo, 03/11/2026).** | `dominio.md`: la capacidad de una distribución nunca supera la del salón. |

**Cambios de modelo que van a hacer falta** (cada uno se confirma antes de tocar `schema.prisma`,
`AGENTS.md` §6): la baja lógica de `Distribucion` (HU-25) y los datos de la anulación en `Pago`
(HU-35). Con HU-36 eliminada, no hace falta numerar recibos.

## HU-25 — Registrar distribuciones posibles de un salón

Como Responsable de Eventos, quiero registrar las distribuciones posibles de cada salón con su
capacidad, para presupuestar y agendar con los armados reales y no solo con los de los datos
iniciales.

Criterios propuestos:

- Desde la gestión de salones, registro una distribución para un salón con su nombre (conferencia,
  mesas de trabajo, banquete u otro) y su capacidad.
- Nombre y capacidad son obligatorios; la capacidad es un entero mayor que cero.
- El nombre es único dentro del salón, sin distinguir mayúsculas (equipo, 02/11/2026); uno
  repetido se rechaza. Dos salones distintos pueden tener
  una distribución con el mismo nombre.
- La capacidad de la distribución no puede superar la capacidad máxima del salón (`dominio.md`).
- La distribución nueva queda disponible al armar o modificar un presupuesto y al agendar el evento.
- Solo el personal interno registra distribuciones; el rol Cliente no.

**Definido (PO, 06/11/2026): baja lógica.** Una distribución se da de baja aunque ya la use un
evento. Dada de baja, no se ofrece al armar o modificar un presupuesto ni al agendar, pero los
eventos que ya la tienen la conservan y la siguen mostrando: la baja no los afecta. Modificarla
quedó definido en HU-26.

**Implementación.** `Distribucion` ya existe con `@@unique([salonId, nombre])`; las del tarifario
las carga el seed. Falta `POST /api/salones/:id/distribuciones` (`409` por nombre repetido, `422` si
supera la capacidad del salón, `404` si el salón no existe). La unicidad sin distinguir mayúsculas
la controla el servicio, como en medios de pago.

La baja es la columna `Distribucion.activo` (migración `20261106220000_baja_logica_distribucion`,
confirmada por el PO el 06/11/2026) y `PATCH /api/salones/:id/distribuciones/:distribucionId/estado`
con `{ activo }`, que también la reactiva. Agendar rechaza con `422` una dada de baja, salvo la que el
evento ya tiene en ese salón; al cambiar de salón un presupuesto o al reutilizar la configuración de
un evento solo se heredan las activas, y la
landing no publica las dadas de baja. En la web, cada distribución de Salones tiene su botón para dar
de baja o reactivar. Tests en `salones.rutas.test.ts` y `eventos.rutas.test.ts`.

## HU-26 — Modificar información de un salón

Como Responsable de Eventos, quiero modificar los precios y las distribuciones de un salón, para
mantenerlos al día sin tocar la base de datos.

Criterios propuestos:

- Desde la gestión de salones, modifico los precios de jornada completa y de media jornada de un
  salón. Los dos son obligatorios e importes mayores que cero, sin IVA (RN-05).
- Un cambio de precio no afecta los presupuestos ya emitidos: sus líneas conservan el precio
  congelado (RN-03, RN-10). Los presupuestos nuevos o recalculados usan el precio nuevo, proyectado a
  la fecha del evento (RN-13).
- El nombre, la capacidad máxima y la superficie del salón no se modifican (equipo, 03/11/2026).
- Modifico el nombre y la capacidad de cada distribución del salón, con las mismas reglas que el
  alta (HU-25): nombre único en el salón sin distinguir mayúsculas y capacidad entera, mayor que
  cero y que no supere la del salón.
- Una distribución se modifica aunque ya la use un evento; el cambio se ve en ese evento (equipo,
  03/11/2026). Darla de baja sigue a definir (HU-25).
- Lo publicado en la landing (visible, foto) sigue en HU-08 y no cambia con esta historia.
- Solo el personal interno modifica salones y distribuciones; el rol Cliente no.

**Definido (equipo, 03/11/2026).** El alcance son los precios y las distribuciones; la capacidad
máxima y la superficie quedan fijas y la landing sigue en HU-08.

**Implementación.** `PATCH /api/salones/:id` con los dos precios y
`PATCH /api/salones/:id/distribuciones/:distribucionId` con el nombre y la capacidad (`404` si la
distribución no es del salón, `409` por nombre repetido, `422` si supera la capacidad del salón),
con sus esquemas en `packages/shared` y la edición en `ConsultarSalones.tsx`. Que el cambio de
precio no afecte lo emitido ya lo garantiza el modelo (`LineaPresupuesto.precioUnitario` congelado).

## HU-27 — Modificar datos de un evento

Como Responsable de Eventos, quiero modificar los datos de un evento cuando se acuerdan cambios con
el cliente, para que el evento refleje lo que se va a hacer.

Criterios propuestos:

- Puedo modificar un evento `EnConsulta`, `Reservado` o `Cobrado`; uno `Cancelado` no se modifica
  (así funciona hoy `PATCH /api/presupuestos/:id`, que recalcula el estado según lo pagado).
- El Responsable de Eventos modifica en todo momento, sin el plazo de 7 días del cliente (RN-09).
- Si un evento `Reservado` o `Cobrado` cambia de fecha, horario o salón, el horario anterior queda libre en ese
  momento y el nuevo no puede solaparse con otro `Reservado` o `Cobrado` en el mismo salón (RN-12);
  el solapamiento se rechaza.
- La capacidad informa y no pone tope (`dominio.md`, «Varios salones»): si la cantidad de personas
  supera la de las distribuciones elegidas, agendar lo avisa y pide confirmarlo. (El criterio
  propuesto decía «no puede superar», que contradice `dominio.md`; vale `dominio.md`.)
- Un cambio que mueve el total del presupuesto sigue las reglas de HU-12 (vigencia, saldo a favor si
  baja por debajo de lo pagado). **Cambia con HU-52 del backlog** (reunión 05/11/2026): por debajo
  de lo pagado, cartel de confirmación, saldo en $0 y lo pagado de más como no reintegrable.
- Al recalcular un presupuesto, la fecha de emisión pasa a ser la del recálculo y la vigencia vuelve
  a contar 10 días desde ahí, como en toda modificación (RN-08; Franco, 03/11/2026). Vale también
  para un evento `Reservado` o `Cobrado`: su presupuesto sigue `Confirmado`, porque el control de
  vigencia solo vence los `Estimado`. **Cambia con HU-54 del backlog** (reunión 05/11/2026): se saca
  el botón y el sistema recalcula solo. Un presupuesto `Confirmado` ya no se recalcula por un
  cambio de porcentaje; solo por un cambio de fecha del evento, que reinicia la vigencia.
- Solo el personal interno modifica eventos; el rol Cliente no.

**Definido (equipo, 03/11/2026).** Alcanza con lo que ya existe: la historia se cubre con tests y
se re-estima.

**Cobertura** (`presupuestos.consultas.test.ts` y `eventos.rutas.test.ts`):

| Criterio | Tests |
|---|---|
| Estados que se modifican | `PATCH … sobre un evento confirmado (RN-09)`: Reservado, Cobrado que vuelve a Reservado, Cancelado `409`; `responde 409 si el evento ya no está en consulta` |
| Sin el plazo de 7 días | `a menos de 7 días del evento (HU-27)` |
| Fecha, horario o salón sin solapar | `si cambia la fecha, el horario se corre…`, `responde 409 si la fecha o el salón nuevos pisan a otro evento reservado (RN-12)`; agendar: `responde 409 si el salón ya está reservado…`, `…constraint EXCLUDE…` |
| Capacidad | agendar: `responde 422 si cantidadPersonas supera la capacidad y no se confirma`, `agenda igual si … confirmarCapacidadExcedida es true` |
| Reglas de HU-12 | `si lo pagado cubre el total nuevo, el evento pasa a Cobrado…`, `conserva los precios congelados…` |
| Emisión y vigencia al recalcular | `conserva los precios congelados … y reinicia la emisión y la vigencia`, `se guarda sin volver a Estimado, reinicia la emisión y la vigencia…` |
| Solo el personal | `sin sesión responde 401 y con sesión de Cliente 403, sin modificar nada` |

**Implementación.** Ya existen `PATCH /api/presupuestos/:id` (fecha, salones, servicios, personas;
HU-12) y `POST /api/eventos/:id/agendar` (distribución, horario y modalidad; `409` por solapamiento,
`422` por capacidad). El no solapamiento lo garantiza también la restricción de exclusión sobre
`EventoSalon` (ADR 0011).

## HU-28 — Registrar evento cobrado

Como Responsable de Finanzas, quiero que un evento figure como Cobrado cuando el cliente pagó el
total, para distinguir los eventos saldados de los que tienen deuda.

Criterios propuestos:

- Cuando los pagos acumulados alcanzan el 100% de la base de cobro (RN-01), el evento pasa a
  `Cobrado` y su saldo es cero.
- Un evento `Cobrado` no admite más pagos ni se cancela (HU-23).
- Si se modifica el presupuesto de un evento `Cobrado` y su total queda por encima de lo pagado,
  el evento vuelve a `Reservado` hasta cobrar la diferencia (ya funciona así desde HU-12).
- En la agenda, el listado y la ficha del cliente se distingue un evento `Cobrado` de uno
  `Reservado` con saldo pendiente.
- El estado de cuenta (HU-21) muestra la cuenta saldada y destaca el pago que completó el total.

**Definido (equipo, 03/11/2026).** No agrega nada al cambio automático: no se marca a mano. La
historia se cubre con los tests que ya existen y se re-estima.

**Cobertura** (`pagos.rutas.test.ts`, `eventos.rutas.test.ts` y `presupuestos.consultas.test.ts`):

| Criterio | Tests |
|---|---|
| Al 100% pasa a `Cobrado` con saldo cero | `un pago que completa el 100% sobre un evento ya Reservado lo pasa a Cobrado`, `un pago único que cruza el 20% y el 100% a la vez…`, `un evento Cobrado queda con saldo cero…` |
| `Cobrado` no admite pagos ni se cancela | `it.each(['Cancelado', 'Cobrado'])` de `POST /eventos/:id/pagos` (`409`) y de `POST /eventos/:id/cancelar` |
| Vuelve a `Reservado` si el total sube | `un Cobrado al que se le suman servicios vuelve a Reservado…` |
| Se distingue en agenda, listado y ficha | Presentación, sin test (AGENTS.md §5): las tres vistas usan `estado-evento.ts`, con Cobrado en azul y Confirmado en verde |
| El estado de cuenta destaca el pago que completó | `un evento Cobrado queda con saldo cero y marca el pago de la seña y el que completó el total` |

**Implementación.** El cambio automático ya está en el módulo de pagos desde HU-14, y el estado de
cuenta marca `completaPago` desde HU-21. Si el PO no agrega nada, la historia se cubre con tests por
criterio y se re-estima.

## HU-29 — Generar y emitir comanda

Como Responsable de Eventos, quiero generar la comanda de cocina de un evento confirmado, para que
la cocina sepa qué preparar y a qué hora, sin precios.

Criterios propuestos (de `dominio.md`, «Comanda de cocina», decisión del equipo del 09/10/2026):

- La comanda se genera solo para un evento con el presupuesto `Confirmado`.
- Lleva fecha, salón, armado, horario, cantidad de personas y nombre del cliente.
- Lista los servicios de gastronomía ordenados por la hora a la que se los espera; los que no tienen
  hora van al final, en el orden en que se cargaron.
- No entran la línea del salón ni los servicios tercerizados; los adicionales escritos a mano van
  aparte, al pie.
- **Nunca lleva precios.**
- Admite observaciones internas del personal (menús especiales, alergias), que salen solo en la
  comanda y el cliente nunca ve.
- Se imprime en una sola hoja o se guarda como PDF.
- Solo el personal interno genera la comanda.

**Hecho en buena parte (Sprint 3).** `ComandaEvento.tsx` arma la hoja y la imprime con
`window.print()`; el botón «Comanda de cocina» del detalle aparece solo con el presupuesto
`Confirmado`; `PATCH /api/eventos/:id/observaciones-comanda` guarda las notas (`409` si el evento
está cancelado). Falta pasar la historia a la Definición del Producto con sus casos de prueba y
cubrir con tests lo que tenga lógica (qué líneas entran y en qué orden).

## HU-30 — Registrar usuario

Como Gerente General, quiero dar de alta a los integrantes del personal con su rol, para que cada
uno acceda al sistema con su propio usuario.

Criterios propuestos:

- Registro un usuario con su correo y su rol: Responsable de Eventos, Responsable de Finanzas,
  Gerente General o Administrador del Sistema. El rol Cliente no se asigna por acá: el cliente se
  registra solo en la landing (`dominio.md`).
- ~~El Gerente General asigna los roles RE y RF; solo el Administrador del Sistema asigna los de
  Gerente General y Administrador (Seguimiento, HU-30; Definición del Producto, «Roles del
  Sistema»).~~ **El Gerente General asigna GG, RE y RF; el Administrador del Sistema, cualquier rol
  (reunión 05/11/2026).** Las demás reglas de Personal (al menos un GG y un ADM, el GG no toca a un
  ADM, un rol por usuario) están en `dominio.md`.
- El GG o el ADM le cargan la contraseña inicial al registrarlo (reunión 05/11/2026). Alcanza con
  que cumpla la política de contraseñas (`dominio.md`, «Personal»), la misma del registro del
  cliente: al menos 8 caracteres, sin ser trivial ni una de las más comunes, y como máximo 72 bytes.
  Antes alcanzaba con 6 caracteres (PO, 06/11/2026); la política actual es del PO, 08/11/2026.
- El correo es obligatorio, se guarda en minúsculas y sin espacios, y es único: uno que ya es de
  otro usuario se rechaza.
- El usuario nuevo inicia sesión con su correo y su contraseña, y entra al panel interno según su
  rol (HU-01).
- El RE, el RF y el rol Cliente no registran usuarios.

**Definido (reunión 05/11/2026; PO, 06/11/2026).** La contraseña inicial la carga el GG o el ADM,
con un mínimo de 6 caracteres y sin otros requisitos (desde el 08/11/2026 rige la política de
`dominio.md`: 8 caracteres, sin ser trivial), y la división por rol arranca acá para
`/usuarios` (ver «Puntos a definir»).

**Implementación.** Módulo `usuarios` con `POST /api/usuarios`, solo para el GG y el ADM: `400` si el
rol no es del personal, `403` si quien da el alta no puede asignar el rol pedido (`puedeAsignarRol`
en `packages/shared`, que la web usa para ofrecer solo esos roles) y `409` por correo repetido, aunque
sea de un cliente. La contraseña se guarda con bcrypt y el alta no inicia sesión. En la web, la
sección **Personal** de Configuración de negocio, que ven solo el GG y el ADM; el resto del panel
sigue igual hasta HU-56 del backlog. Tests en `usuarios.rutas.test.ts` y `personal.test.ts`.

## HU-31 — Consultar usuario

Como Gerente General, quiero consultar los usuarios del personal con su rol, para saber quién
tiene acceso al sistema y con qué permisos.

Criterios propuestos:

- Veo cada usuario del personal con su correo, su rol y su fecha de alta.
- No se listan los usuarios con rol Cliente: esos se consultan en Clientes (HU-16).
- El listado se ordena por rol y después por correo, y puedo filtrar por rol.
- Nunca se muestra la contraseña ni su hash.
- Solo el Gerente General y el Administrador del Sistema acceden; el RE, el RF y el Cliente no.

**Implementación.** `GET /api/usuarios?rol=` en el mismo módulo que HU-30, con el listado debajo del
alta en Personal. El orden por rol es el del enum `Rol` (RE, RF, GG, ADM). Que no salgan los clientes,
el orden y que nunca se lea el hash se prueban en `usuarios.repositorio.test.ts`. Modificar y dar de
baja usuarios quedan para el Sprint 5 (HU-30 y HU-31 del backlog).

## HU-32 — Modificar servicio

Como Responsable de Eventos, quiero modificar un servicio del catálogo, para mantenerlo actualizado
sin tener que cargarlo de nuevo.

Criterios propuestos:

- Modifico el nombre, la descripción, la unidad de medida, el precio, si se cobra por persona, si es
  tercerizado, si admite modalidad (RN-11) y la categoría de un servicio.
- El nombre es obligatorio y único sin distinguir mayúsculas (equipo, 03/11/2026); uno que ya es
  de otro servicio se rechaza. Vale también para el alta.
- El precio es sin IVA (RN-05) y mayor que cero. Solo un tercerizado puede quedar «a cotizar», sin
  precio.
- Un cambio de precio no afecta los presupuestos ya emitidos: sus líneas conservan el precio
  congelado (RN-03). Los presupuestos nuevos o recalculados usan el precio nuevo.
- El precio de un tercerizado lo actualiza a mano el Responsable de Eventos y no recibe el
  incremento mensual (`dominio.md`).
- Solo el personal interno modifica servicios; el rol Cliente no.

**Implementación.** Hoy solo existe `PATCH /api/servicios/:id/landing` (la foto). Falta
`PATCH /api/servicios/:id` con su esquema en `packages/shared`, que respete el CHECK
`servicio_a_cotizar_solo_tercerizado`, y la edición en la web. La baja de un servicio es HU-35 del
backlog (Sprint 6) y no entra acá.

## HU-33 — Modificar medio de pago

Como Responsable de Finanzas, quiero modificar un medio de pago, para corregir su nombre o los
casos en que se puede usar.

Criterios propuestos:

- Modifico el nombre de un medio de pago y si se habilita con factura, sin factura o en los dos
  casos (RN-14).
- El nombre es obligatorio y único sin distinguir mayúsculas; elegir al menos un caso también es
  obligatorio (igual que en el alta, HU-19).
- Los pagos ya registrados con ese medio no cambian y lo siguen mostrando con su nombre nuevo.
- Un cambio de habilitación vale para los cobros siguientes: el formulario de cobro y la API
  (`422`) aplican la habilitación nueva.
- Solo el personal interno modifica medios de pago; el rol Cliente no.

**Definido (equipo, 03/11/2026).** La habilitación de los seis medios del catálogo inicial también
se puede cambiar, igual que la de los dados de alta después; RN-14 quedó actualizada en
`dominio.md`. La baja de un medio es HU-39 del backlog (Sprint 6).

**Cambió con HU-53 del backlog** (reunión 05/11/2026), construida al cierre de este sprint: todos
los medios quedan habilitados en todos los cobros, así que elegir con factura, sin factura o los dos
salió del alta y de la modificación.

**Implementación.** `PATCH /api/medios-pago/:id` (`409` por nombre repetido, `404` si no existe),
reutilizando las validaciones de `esquemaCrearMedioPago`. Edición en `ListadoMediosPago.tsx`.

## HU-34 — Consultar pagos de un evento

Como Responsable de Finanzas, quiero consultar los pagos de un evento, para saber cuánto pagó el
cliente, cuándo y con qué medio.

Criterios propuestos:

- Veo cada pago del evento con fecha, importe, medio de pago y observación, del más antiguo al más
  reciente.
- Veo el total abonado y el saldo pendiente.
- Si el evento no tiene pagos, el sistema lo informa.
- Solo el personal interno consulta los pagos; el rol Cliente no.

**Ya cubierta por HU-21** (Seguimiento: «no lleva trabajo nuevo»). `GET /api/eventos/:id/pagos` y la
tarjeta «Cuenta del evento» del detalle muestran todo esto. Se cierra sin código nuevo, con la
cobertura de abajo; falta pasarla a la Definición del Producto y re-estimarla.

**Cobertura** (`pagos.rutas.test.ts`, `describe` de `GET /api/eventos/:id/pagos` y del estado de
cuenta de HU-21):

| Criterio | Tests |
|---|---|
| Cada pago con fecha, importe, medio y observación | `devuelve el historial y el saldo actualizado (HU-14 C2)`. El orden del más antiguo al más reciente lo da la consulta (`pagos.repositorio.ts`, por fecha y después por id), que en los tests de rutas está simulada: sin test propio |
| Total abonado y saldo pendiente | `devuelve el historial y el saldo actualizado (HU-14 C2)`, `un evento Cobrado queda con saldo cero…` |
| Sin pagos, el sistema lo informa | `sin pagos el saldo es la base de cobro y la seña no está alcanzada`. El texto «Todavía no hay pagos.» de `CuentaDelEvento.tsx` es presentación, sin test (AGENTS.md §5) |
| Solo el personal interno | `un Cliente no accede al estado de cuenta` (`403`) |

## HU-35 — Anular pago de un evento

Como Responsable de Finanzas, quiero anular un pago registrado por error sin borrarlo, para que el
estado de cuenta refleje lo que el cliente pagó de verdad.

Criterios propuestos (lo que no depende de los puntos abiertos):

- Puedo anular un pago de un evento, previa confirmación explícita.
- El pago anulado **no se borra**: sigue en el estado de cuenta, marcado como anulado, y deja de
  sumar al total abonado y al saldo.
- Un pago ya anulado no se puede anular de nuevo.
- Solo el personal interno anula pagos; el rol Cliente no.

**Definido (reunión 05/11/2026; PO, 06/11/2026).** Si lo abonado baja del 20%, el evento **sigue
`Reservado`** y el sistema avisa que lo pagado no cubre la seña: la máquina de estados no cambia.
La anulación es también la forma de pasar un pago a otro evento del mismo cliente y de corregir un
pago mal registrado (se anula y se registra de nuevo), sin una acción de «transferir» ni de editar.

Si el evento estaba `Cobrado` y lo abonado baja del 100%, **vuelve a `Reservado`** hasta
cobrar la diferencia, como al modificar el presupuesto (PO, 06/11/2026).

**Definido (PO, 06/11/2026).** La anulación guarda la fecha y el usuario que anuló; no se pide
motivo. Anula cualquier rol del personal (RE, RF, GG y ADM), los mismos que registran pagos; el
rol Cliente no.

**Implementación.** Columnas `anuladoEn` y `anuladoPorId` en `Pago` (migración
`20261106210000_anulacion_de_pagos`, con el CHECK `pago_anulacion_completa`: las dos se cargan
juntas), confirmadas por el PO el 06/11/2026. `POST /api/eventos/:id/pagos/:pagoId/anular` para
todo el personal: `404` si el pago no es del evento, `409` si ya está anulado (también ante dos
anulaciones simultáneas) o si el evento está `Cancelado`, cuya cuenta queda como estaba al
cancelarse (PO, 06/11/2026). Lo pagado, el saldo, `completaSena` y `completaPago` ignoran los pagos anulados, también
al modificar un presupuesto confirmado (HU-12). `senaAlcanzada` sigue fija una vez reservado el
evento; el aviso de que lo pagado ya no cubre la seña es el campo nuevo `cubreSena` del saldo. En la
web, cada pago de la cuenta tiene «Anular» con confirmación en la misma fila, y el anulado queda
tachado con la fecha y el usuario. Tests en `pagos.rutas.test.ts`.

## HU-36 — Generar y emitir un recibo como comprobante válido de pago

**Eliminada (PO, 06/11/2026).** No se construye.

## HU-53 del backlog — Calcular todo presupuesto nuevo con IVA

**Agregada por el PO al cierre del sprint (06/11/2026).** Venía de la reunión con el cliente del
05/11/2026 y estaba sin sprint; se adelanta porque para la exposición todo tiene que estar
calculado con IVA y sin la casilla de factura. Sin numeración local: se cita con el código del
backlog. Se estima recién en la Definición del Producto.

Criterios (`backlog.md` y RN-01, RN-14 de `dominio.md`):

- Se saca la casilla «El cliente requiere factura»: todo presupuesto nuevo se crea con factura y su
  base de cobro es el total con IVA. Vale para el cotizador del cliente, el alta del personal, la
  consulta social y la reutilización de un evento.
- La marca ya no se modifica: los presupuestos existentes conservan la suya aunque se modifiquen o
  se recalculen (la base de producción se limpia antes de la exposición; PO, 06/11/2026).
- Todos los medios de pago activos se pueden usar en todos los cobros, con factura o sin ella; el
  alta y la modificación de un medio piden solo el nombre.

**Implementación.** Sin cambio de modelo: `crearPresupuestoConLineas` crea con
`requiereFactura: true` (la columna sigue con default `false`), `PATCH /api/presupuestos/:id` ya no
recibe la marca, y las columnas `conFactura` y `sinFactura` de `MedioPago` quedan sin uso. Tests en
`presupuestos.repositorio.test.ts`, `presupuestos.consultas.test.ts`, `pagos.rutas.test.ts` y
`medios-pago.test.ts`.

## Casos límite del sprint (07 y 08/11/2026)

Se revisó la funcionalidad del sprint buscando casos límite y se agregaron tests para cubrirlos
(salones, pagos, usuarios, servicios, medios de pago, eventos, comanda y modificación de
presupuestos, más los schemas compartidos y el token de sesión). Salieron estas decisiones del PO
y un arreglo, todo registrado también en `dominio.md`.

**Decisiones del PO**

| Tema | Decisión | Fecha |
|---|---|---|
| Contraseña (HU-30) | Máximo de **72 bytes**. Se mide en bytes, no en caracteres, porque bcrypt lee solo los primeros 72. Rige al crearla o cambiarla, no al iniciar sesión | 07/11/2026 |
| Política de contraseñas | Mínimo **8 caracteres** (era 6); no puede ser solo espacios, un único carácter repetido ni una de las contraseñas más comunes. **Sin** exigir mayúsculas, minúsculas ni símbolos. Reemplaza el «mínimo 6, sin otros requisitos» del 06/11. Detalle en `dominio.md` | 08/11/2026 |
| HTML en los campos de texto | Solo se rechaza lo que un navegador leería como etiqueta; un `<` suelto («a < b», «Juan <juan@x.com>») es texto y pasa. Se cierra un hueco: `<!--` y `<?` pasaban y ahora se rechazan | 08/11/2026 |
| Monto de un pago | Tope de **$500.000.000** por pago. Primero se fijó en 100 millones y el PO lo subió «por las dudas». Aplica solo a registrar un pago, no a precios ni totales | 08/11/2026 |
| Fecha de un pago | **Sin límite**: se acepta cualquier fecha real, pasada o futura | 07/11/2026 |
| Eventos que cruzan la medianoche | Lo que cae después de las 00:00 es del **día siguiente**. En esos eventos la hora esperada de un servicio no se controla contra la franja. Queda como estaba | 07/11/2026 |
| Largo de textos | Correo de una cuenta o de un cliente: máximo **254** caracteres. Servicio: nombre **100**, descripción **500**, unidad de medida **30**. Sirve para que nadie rompa el sistema con un texto enorme. El nombre del servicio ahora también se recorta en el alta, como ya pasaba al modificarlo | 08/11/2026 |
| Adicional de $0 | Se acepta como **cortesía**: es una línea con precio, no suma al total | 08/11/2026 |

**Arreglo técnico.** Dos pedidos simultáneos con el mismo nombre (al crear o renombrar un servicio,
un medio de pago o una distribución) pasaban los dos el chequeo previo y el segundo chocaba con el
índice único de la base: respondía `500` en lugar de `409 CONFLICT`. Ahora se traduce igual que en
`usuarios` (`comoConflictoSiYaExiste`, en `lib/prisma-errores.ts`). Queda un caso sin cubrir: el
índice de `Distribucion` distingue mayúsculas, así que dos altas simultáneas que difieran solo en
ellas no se frenan. Cerrarlo pide un índice sobre `lower(nombre)`, que es un cambio de modelo y se
confirma antes (`AGENTS.md` §6).

**Dos arreglos más de la misma ronda** (08/11/2026). La respuesta de `/usuarios` devuelve solo los
campos públicos (id, correo, rol y fechas), aunque el repositorio trajera de más. Y los errores
por HTML en un campo nombran la posición de las listas con puntos (`adicionales.0.descripcion`), igual
que los de Zod; la web no lee ese nombre, así que no cambia nada visible.

## Casos de prueba

El diseño de casos de prueba de cada historia (CP-25-01 a CP-36-06) está en la Definición del
Producto v0.6. Se automatizan con Vitest + Supertest sobre `crearApp()`, igual que en los sprints
anteriores; los resultados se registran ahí al cierre del sprint.

## Definición de Terminado

Una historia está terminada cuando sus criterios pasan como tests automatizados, el código fue
revisado por otro integrante vía pull request, el CI corre sin errores, la funcionalidad está
desplegada y accesible, y la Definición del Producto tiene sus criterios, prototipo, casos de prueba
y resultados (retrospectiva del Sprint 3).

La auditoría de las operaciones que modifican datos sigue fuera de la definición: se implementa
completa en el EPIC-08 (HU-25 del backlog, Sprint 5).

# Sprint 4 — Confluens

Del 23/10/2026 al 06/11/2026 · Scrum Master: Ayrton Vanega · 12 historias · 34 puntos + HU-36 a estimar (backlog, sin Planning Poker)

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
>   que toma la estimación del backlog. HU-36 figura «A estimar» y se estima antes de empezarla.
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
anulación de pagos y el recibo.

Orden del Seguimiento: Salones → Eventos → Usuarios → Catálogos → Pagos.

## Alcance

| HU | Título | Actor | Backlog | SP | Estado en el código |
|---|---|---|---|---|---|
| HU-25 | Registrar distribuciones posibles de un salón | RE | HU-02 | 5 | Solo lectura (`GET /salones` las trae) |
| HU-26 | Modificar información de un salón | RE | HU-03 | 3 | Solo la parte de la landing (HU-08) |
| HU-27 | Modificar datos de un evento | RE | HU-16 | 5 | Cubierto en parte por HU-12 y `agendar` |
| HU-28 | Registrar evento cobrado | RF | HU-20 | 5 | Automático desde HU-14 |
| HU-29 | Generar y emitir comanda | RE | — (S-07) | 2 | Construida, falta formalizarla |
| HU-30 | Registrar usuario | GG / ADM | HU-28 | 3 | No existe (usuarios del seed) |
| HU-31 | Consultar usuario | GG / ADM | HU-29 | 2 | No existe |
| HU-32 | Modificar servicio | RE | HU-33 | 3 | Solo la foto de la landing (HU-08) |
| HU-33 | Modificar medio de pago | RF | HU-38 | 2 | No existe |
| HU-34 | Consultar pagos de un evento | RF | — | 2 | Cubierta por HU-21 |
| HU-35 | Anular pago de un evento | RF | — | 2 | No existe; los pagos no se editan ni se borran |
| HU-36 | Generar y emitir un recibo como comprobante válido de pago | RF | — | a estimar | No existe |
| | **Total (sin HU-36)** | | | **34** | |

Velocidad de los sprints anteriores: 31, 32 y 36. Con 34 puntos el sprint queda en línea, pero
varias historias valen menos de lo estimado porque ya están hechas en parte (HU-29, HU-34 y, según
lo que defina el PO, HU-27 y HU-28), y HU-35 y HU-36 pueden valer más: conviene re-estimarlas.

## Puntos a definir con el PO (Seguimiento, 6.3)

**Bloquean la historia**: no se construye la parte afectada hasta que el PO lo defina. Las
decisiones se registran acá, en `dominio.md` si cambian una regla, y en la Definición del Producto.

| Historia | Qué falta definir |
|---|---|
| HU-25 | Si una distribución se puede modificar o dar de baja cuando ya la usa un evento. |
| HU-26 | Confirmar que la historia es la edición de los datos del salón (capacidad, superficie, precios); lo publicado en la landing ya lo cubre HU-08. |
| HU-27 | Si hace falta una pantalla propia del evento o alcanza con lo que ya existe (fecha, salones y servicios se cambian desde el presupuesto, HU-12). |
| HU-28 | Si la historia agrega algo al cambio automático a Cobrado de HU-14 (por ejemplo, marcarlo a mano). |
| HU-30 | Cómo recibe el usuario su primera contraseña. |
| HU-35 | Cómo se registra la anulación sin borrar el pago (fecha, usuario y motivo); qué pasa con el estado del evento si lo abonado baja del 20% o del 100% de la base de cobro; quién puede anular. |
| HU-36 | Qué datos lleva el recibo y si tiene numeración propia. |

Además de los del Seguimiento, al cruzarlo con `dominio.md` y el código aparecen estos (agregados
en esta versión, también para el PO):

| Historia | Qué falta definir | Por qué |
|---|---|---|
| HU-30, HU-31 | Si la división de funciones por rol empieza con estas historias. | Hoy todo el personal entra al mismo panel y hace todo (decisión provisoria del PO, 06/10/2026). La regla «el GG asigna RE y RF; el ADM, GG y ADM» necesita que la API distinga roles en `/usuarios`. |
| HU-33 | Si se puede cambiar con qué casos se habilita un medio del catálogo inicial (Efectivo, Transferencia, Débito, Crédito, Cheque y A la habitación). | RN-14 fija esa habilitación y `dominio.md` no deja cambiarla sin el PO. Para los medios dados de alta después no hay conflicto. |
| HU-35 | Si una anulación puede sacar a un evento de `Reservado` o de `Cobrado`. | `Cobrado` → `Reservado` ya existe al modificar un presupuesto por encima de lo pagado (HU-12), pero `Reservado` → `EnConsulta` no está en la máquina de estados aprobada: agregarla es cambiar `dominio.md`. |
| HU-25, HU-26 | Si bajar la capacidad de un salón por debajo de la de una de sus distribuciones se rechaza o arrastra la distribución. | `dominio.md`: la capacidad de una distribución nunca supera la del salón. |

**Cambios de modelo que van a hacer falta** (cada uno se confirma antes de tocar `schema.prisma`,
`AGENTS.md` §6): la baja lógica de `Distribucion` si el PO la pide (HU-25), los datos de la
anulación en `Pago` (HU-35) y, según lo que lleve el recibo, su numeración (HU-36).

## HU-25 — Registrar distribuciones posibles de un salón

Como Responsable de Eventos, quiero registrar las distribuciones posibles de cada salón con su
capacidad, para presupuestar y agendar con los armados reales y no solo con los de los datos
iniciales.

Criterios propuestos:

- Desde la gestión de salones, registro una distribución para un salón con su nombre (conferencia,
  mesas de trabajo, banquete u otro) y su capacidad.
- Nombre y capacidad son obligatorios; la capacidad es un entero mayor que cero.
- El nombre es único dentro del salón; uno repetido se rechaza. Dos salones distintos pueden tener
  una distribución con el mismo nombre.
- La capacidad de la distribución no puede superar la capacidad máxima del salón (`dominio.md`).
- La distribución nueva queda disponible al armar o modificar un presupuesto y al agendar el evento.
- Solo el personal interno registra distribuciones; el rol Cliente no.

**A definir (bloquea modificar y dar de baja).** Si una distribución ya usada por un evento se puede
modificar o dar de baja. Hoy `Distribucion` no tiene `activo`; una baja lógica es cambio de modelo.

**Implementación.** `Distribucion` ya existe con `@@unique([salonId, nombre])`; las del tarifario
las carga el seed. Falta `POST /api/salones/:id/distribuciones` (`409` por nombre repetido, `422` si
supera la capacidad del salón, `404` si el salón no existe). La unicidad sin distinguir mayúsculas,
si se pide, la controla el servicio, como en medios de pago.

## HU-26 — Modificar información de un salón

Como Responsable de Eventos, quiero modificar la capacidad, la superficie y los precios de un
salón, para mantenerlos al día sin tocar la base de datos.

Criterios propuestos:

- Desde la gestión de salones, modifico la capacidad máxima, la superficie y los precios de jornada
  completa y de media jornada de un salón.
- Todos son obligatorios; la capacidad y la superficie son enteros mayores que cero y los precios,
  importes mayores que cero, sin IVA (RN-05).
- Un cambio de precio no afecta los presupuestos ya emitidos: sus líneas conservan el precio
  congelado (RN-03, RN-10). Los presupuestos nuevos o recalculados usan el precio nuevo, proyectado a
  la fecha del evento (RN-13).
- La capacidad no puede quedar por debajo de la de alguna de sus distribuciones (a confirmar, ver
  «Puntos a definir»).
- El nombre del salón no se modifica: los cinco salones son fijos y dan nombre al producto.
- Lo publicado en la landing (visible, foto) sigue en HU-08 y no cambia con esta historia.
- Solo el personal interno modifica salones; el rol Cliente no.

**A definir.** Confirmar con el PO que este es el alcance (y no el contenido de la landing).

**Implementación.** Hoy solo existe `PATCH /api/salones/:id/landing`. Falta `PATCH /api/salones/:id`
con su esquema en `packages/shared` y la edición en `ConsultarSalones.tsx`. Que el cambio no
afecte lo emitido ya lo garantiza el modelo (`LineaPresupuesto.precioUnitario` congelado).

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
- La cantidad de personas no puede superar la capacidad de la distribución elegida.
- Un cambio que mueve el total del presupuesto sigue las reglas de HU-12 (vigencia, saldo a favor si
  baja por debajo de lo pagado).
- Solo el personal interno modifica eventos; el rol Cliente no.

**A definir (bloquea la historia).** Si hace falta una pantalla propia del evento o alcanza con lo
que ya existe. Si alcanza, la historia se reduce a cubrir los criterios con tests y se re-estima.

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

**A definir (bloquea la historia).** Si agrega algo al cambio automático (por ejemplo, marcar a mano
un evento como Cobrado). Marcarlo a mano con saldo pendiente contradice la máquina de estados
(`Cobrado` = acumulado 100%) y se decide con el PO.

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
- El Gerente General asigna los roles RE y RF; solo el Administrador del Sistema asigna los de
  Gerente General y Administrador (Seguimiento, HU-30; Definición del Producto, «Roles del
  Sistema»).
- El correo es obligatorio, se guarda en minúsculas y sin espacios, y es único: uno que ya es de
  otro usuario se rechaza.
- El usuario nuevo inicia sesión con su correo y su contraseña, y entra al panel interno según su
  rol (HU-01).
- El RE, el RF y el rol Cliente no registran usuarios.

**A definir (bloquea la historia).** Cómo recibe el usuario su primera contraseña. Hay un mecanismo
ya construido que podría servir (el enlace de «Olvidé mi contraseña», que vence a los 30 minutos y
sirve una vez), pero la decisión es del PO. También, si la división por rol arranca acá (ver
«Puntos a definir»).

**Implementación.** No hay módulo de usuarios: los cuatro usuarios del personal los carga el seed
(`re@`, `rf@`, `gg@` y `admin@confluens.test`). Falta un módulo `usuarios` con `POST /api/usuarios`
(`409` por correo repetido, `403` si el rol no puede asignar el rol pedido). La contraseña se guarda
con bcrypt, igual que en el registro del cliente.

## HU-31 — Consultar usuario

Como Gerente General, quiero consultar los usuarios del personal con su rol, para saber quién
tiene acceso al sistema y con qué permisos.

Criterios propuestos:

- Veo cada usuario del personal con su correo, su rol y su fecha de alta.
- No se listan los usuarios con rol Cliente: esos se consultan en Clientes (HU-16).
- El listado se ordena por rol y después por correo, y puedo filtrar por rol.
- Nunca se muestra la contraseña ni su hash.
- Solo el Gerente General y el Administrador del Sistema acceden; el RE, el RF y el Cliente no.

**Implementación.** `GET /api/usuarios` en el mismo módulo que HU-30. Modificar y dar de baja
usuarios quedan para el Sprint 5 (HU-30 y HU-31 del backlog).

## HU-32 — Modificar servicio

Como Responsable de Eventos, quiero modificar un servicio del catálogo, para mantenerlo actualizado
sin tener que cargarlo de nuevo.

Criterios propuestos:

- Modifico el nombre, la descripción, la unidad de medida, el precio, si se cobra por persona, si es
  tercerizado, si admite modalidad (RN-11) y la categoría de un servicio.
- El nombre es obligatorio y único; uno que ya es de otro servicio se rechaza.
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

**A definir.** Si se puede cambiar la habilitación de los seis medios del catálogo inicial, que fija
RN-14 (ver «Puntos a definir»). La baja de un medio es HU-39 del backlog (Sprint 6).

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
tarjeta «Cuenta del evento» del detalle muestran todo esto. Se cierra pasando la historia a la
Definición del Producto y referenciando los tests de HU-21; conviene re-estimarla.

## HU-35 — Anular pago de un evento

Como Responsable de Finanzas, quiero anular un pago registrado por error sin borrarlo, para que el
estado de cuenta refleje lo que el cliente pagó de verdad.

Criterios propuestos (lo que no depende de los puntos abiertos):

- Puedo anular un pago de un evento, previa confirmación explícita.
- El pago anulado **no se borra**: sigue en el estado de cuenta, marcado como anulado, y deja de
  sumar al total abonado y al saldo.
- Un pago ya anulado no se puede anular de nuevo.
- Solo el personal interno anula pagos; el rol Cliente no.

**A definir (bloquea la historia).** Qué datos guarda la anulación (fecha, usuario, motivo); quién
puede anular; y qué pasa con el estado del evento si lo abonado baja del 20% (`Reservado`) o del
100% (`Cobrado`) de la base de cobro. Esto último toca la máquina de estados (`dominio.md`), así que
no se construye hasta que el PO lo defina.

**Implementación.** Hoy `Pago` no se edita ni se borra (comentario en `schema.prisma`). Anular
necesita columnas nuevas en `Pago` (por ejemplo, `anuladoEn`, `anuladoPorId`, `motivoAnulacion`):
cambio de modelo a confirmar. El saldo, `senaAlcanzada`, `completaSena` y `completaPago` del estado
de cuenta pasan a ignorar los pagos anulados.

## HU-36 — Generar y emitir un recibo como comprobante válido de pago

Como Responsable de Finanzas, quiero emitir un recibo de cada pago, para entregarle al cliente un
comprobante de lo que pagó.

Criterios propuestos (lo que no depende de los puntos abiertos):

- Desde el estado de cuenta del evento genero el recibo de un pago registrado y lo imprimo o lo
  guardo como PDF.
- El recibo **no es una factura**: la facturación electrónica está fuera de alcance (EXC-02) y el
  recibo lo dice.
- Un pago anulado (HU-35) no emite recibo, o el recibo lo muestra como anulado (a definir con
  HU-35).
- Solo el personal interno emite recibos; el rol Cliente no.

**A definir (bloquea la historia).** Qué datos lleva el recibo y si tiene numeración propia. Una
numeración correlativa es cambio de modelo. La historia se estima recién con eso definido.

**Implementación sugerida.** Igual que el presupuesto y la comanda: una hoja impresa con
`window.print()`, sin dependencias nuevas (`PresupuestoEstimado.tsx`, `ComandaEvento.tsx`).

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

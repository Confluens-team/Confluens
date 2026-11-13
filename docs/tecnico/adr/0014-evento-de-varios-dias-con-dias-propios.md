# ADR 0014 — Evento de varios días: una tabla de días y el solapamiento por día en la base

**Fecha:** 2026-11 · **Estado:** aceptada por el PO el 12/11/2026 (diseño y decisiones de detalle); se construye en partes

## Contexto

HU-50 (`backlog.md`, `dominio.md`, «Evento de varios días») pide que un evento dure de 1 a 32 días
corridos consecutivos. Cada día tiene su fecha, su horario, su jornada, sus salones con su
distribución, su cantidad de personas y sus servicios. Todo va en **un solo evento, un solo
presupuesto, un solo total y una sola seña**, con un único estado.

Hoy `Evento` tiene una sola fecha, un solo horario (`inicio`, `fin`), una sola jornada y una sola
cantidad de personas, y sus salones comparten ese horario (ADR 0011). El no solapamiento de RN-12
lo garantiza la base: `EventoSalon` lleva una copia de `inicio`, `fin` y `estado` del evento,
mantenida por triggers, y una restricción de exclusión sobre `(salonId, tsrange(inicio, fin))`.

Medida del impacto en el código de hoy (archivos que no son tests): `inicio` se usa en 6 archivos de
la API y 7 de la web; `cantidadPersonas`, en 5 y 16; `tipoJornada`, en 2 y 9; las horas estimadas,
en 2 y 8. Cinco piezas de la base dependen de que el evento tenga un solo horario: las
restricciones `evento_horario_obligatorio`, `evento_salon_sin_solapamiento` y
`evento_reservado_con_salon`, y los dos triggers que copian el horario a `EventoSalon`.

## Decisión

Los días de un evento viven en una tabla nueva, **`EventoDia`**, y **cada salón se reserva por día**.
Un evento de un solo día, que es todo lo que existe hoy, es un evento con un único día.

```
Evento (1) ──< EventoDia (1..32) ──< EventoSalon (≥1 por día)
   │                 └───────────────< LineaPresupuesto (cada línea, de un día)
   └──< Presupuesto (1)   └──< Pago
```

**`EventoDia`**: `id`, `eventoId` (cascada), `fecha` (Date), `inicio` y `fin` (nullables mientras el
evento está `EnConsulta`, como hoy), `tipoJornada`, `cantidadPersonas`. Única por
`(eventoId, fecha)`.

**`EventoSalon`** pasa a ser por día: se le agrega `diaId` y la clave pasa a `(diaId, salonId)`. Sigue
llevando `eventoId` (para consultar) y la copia de `inicio`, `fin` y `estado`, pero ahora el horario
se copia **del día** y el estado, del evento.

**`LineaPresupuesto`** gana `diaId`: cada línea (el salón de un día, o un servicio o adicional de un
día) pertenece a un día. El presupuesto sigue siendo uno y su total suma todas las líneas.

**`Evento`** conserva `fecha`, `inicio`, `fin`, `cantidadPersonas` y `tipoJornada` como **resumen
derivado**: primer día, inicio del primer día, fin del último día, y el máximo de personas y la
jornada del primer día. Se agrega `fechaFin` (último día). Los **escribe un trigger a partir de los
días**, nunca la aplicación, con el mismo criterio de ADR 0011: si cada camino de escritura tuviera
que acordarse de sincronizar, el día que se agregue uno nuevo la base dejaría de ser coherente sin que
nadie se entere. Con esto la agenda dibuja **una sola barra larga** (de `inicio` a `fin`) y los
filtros por fecha, el plazo de 7 días y las 48 horas leen siempre el primer día (`fecha`).

### Lo que la base garantiza

| Regla | Cómo |
|---|---|
| Sin solapamiento por día y por salón (RN-12) | La **misma** restricción de exclusión de hoy sobre `EventoSalon`, que ahora tiene una fila por día y por salón: `(salonId, tsrange(inicio, fin))` con `estado` `Reservado` o `Cobrado`. No cambia: cada día se controla solo. |
| Días consecutivos y como máximo 32 | Constraint trigger diferido sobre `EventoDia`: al cerrar la transacción, `max(fecha) − min(fecha) + 1` es igual a la cantidad de días y no pasa de 32. |
| Un evento `Reservado` o `Cobrado` tiene horario y al menos un salón **en cada día** | `evento_horario_obligatorio` y `evento_reservado_con_salon` pasan a mirar cada día: todo día tiene `inicio` y `fin` y al menos un `EventoSalon`. |
| El horario de `EventoSalon` es el del día | `evento_salon_copia_horario` lo toma de `EventoDia`; un trigger nuevo propaga a los salones del día cuando el día cambia (reemplaza a `evento_propaga_horario`). |
| El resumen de `Evento` es el de sus días | Trigger sobre `EventoDia` que recalcula `fecha`, `fechaFin`, `inicio`, `fin`, `cantidadPersonas` y `tipoJornada` del evento. |

### Migración de los eventos que ya existen

Es un cambio de datos, no solo de estructura. Todos los eventos de hoy son de un día, así que:

1. Se crea `EventoDia` y por cada `Evento` se inserta **un día** con su `fecha`, `inicio`, `fin`,
   `tipoJornada` y `cantidadPersonas`.
2. A cada `EventoSalon` se le pone el `diaId` de ese único día, y a cada `LineaPresupuesto` también.
3. Se agrega `Evento.fechaFin` (igual a `fecha`) y se crean los triggers.
4. Recién ahí `diaId` pasa a `NOT NULL`.

Se hace en el mismo orden *expand / contract* que ADR 0011, dentro de una migración nueva. Las
migraciones aplicadas no se tocan.

## Consecuencias

**A favor.**

- **La garantía más delicada no cambia de forma**: sigue siendo la misma restricción de exclusión, y
  un salón puede estar ocupado un día por un evento y el siguiente por otro.
- **Un solo evento, presupuesto, seña y estado**, como pidió el PO. Los pagos, la cancelación
  (entera, no por día), la auditoría de eventos y el correo no cambian de modelo.
- Los eventos de un solo día, que son todos los de hoy, siguen funcionando igual: tienen un día.
- La agenda y los filtros siguen leyendo `Evento` (el resumen), sin tener que unir con los días.

**En contra.**

- **Es el cambio más grande del modelo desde ADR 0011.** Toca el esquema, tres o cuatro triggers y
  restricciones, una migración de datos y todos los caminos que hoy escriben `inicio`, `fin`,
  `cantidadPersonas` o `tipoJornada` del evento: crear la consulta (cotizador y social), modificar el
  presupuesto, agendar, reubicar el horario al cambiar la fecha, repetir un evento y el recálculo.
- **Hay dato derivado** (el resumen de `Evento`). Está asumido a conciencia, por el mismo motivo
  que la copia de `EventoSalon` en ADR 0011.
- Las restricciones de la base **no se pueden probar con los tests de hoy**, que usan un cliente de
  base falso. La no superposición por día, la consecutividad y el tope de 32 hay que probarlas con
  SQL contra la base local (un script en `apps/api/prisma/` que se corre a mano con los casos de
  `backlog.md`) y, si el equipo lo quiere, con una base real en el CI.
- Hasta que se cierre la fase, `Evento` tiene columnas que ya no escribe la aplicación.

**Alternativas descartadas.**

- **Un evento por día, agrupados.** Reusaría la restricción tal cual, pero rompe lo que el PO
  definió: un solo presupuesto, una sola seña y un solo estado. Cancelar, cobrar y recalcular tendrían
  que coordinar varios eventos.
- **Los días como un arreglo o JSON dentro de `Evento`.** No permite una restricción de exclusión por
  día y por salón: la garantía que la aplicación no puede saltear se perdería.
- **Mantener `Evento.inicio` y `fin` como fuente y solo repetir la jornada y las personas.** No
  alcanza: los días pueden tener horarios y salones distintos, y la exclusión necesita el horario de
  cada día junto al salón.

## Aviso de solapamientos

La restricción de exclusión es la red de seguridad, pero **no sirve para avisar**: Postgres corta en
el **primer** choque y no dice con qué evento choca. HU-50 pide listar **todos** los choques de la
franja, por día y por salón (`backlog.md`, «Aviso de solapamientos»). Por eso la aplicación mira
antes, y la base queda como respaldo:

- `buscarSolapamiento` (hoy devuelve un único evento) pasa a devolver **la lista de choques**: por
  cada día del evento y cada uno de sus salones, el evento que ya ocupa ese salón en ese horario
  (número, cliente, estado, salón, fecha y horario). Se consulta con todos los días a la vez.
- El rechazo es un 409 `CONFLICT` con un mensaje claro y **un detalle por choque** en `details`, que
  es la forma estándar de error de `AGENTS.md` §4 (`campo` es la fecha y el salón; `mensaje`, el
  texto). `ErrorApi.conflicto` hoy no acepta detalles y hay que extenderlo; `DetalleError` de
  `packages/shared` ya alcanza, no se toca.
- El aviso **preventivo** de la consulta usa la misma consulta, solo lectura, y la pantalla lo
  muestra día por día. Una consulta `EnConsulta` marcada «en conflicto» no bloquea nada (RN-12).
- Si dos reservas compiten a la vez y gana la otra, la restricción de la base responde y la
  aplicación devuelve un 409 que pide volver a intentar: ahí el detalle ya no se puede dar.

## Decisiones de detalle (PO, 12/11/2026)

1. **Personas del evento.** Las pantallas muestran el **rango** de la franja (mínimo a máximo); un
   solo número si todos los días coinciden. Se calcula de los días al leer el evento.
   `Evento.cantidadPersonas` queda como el **máximo** de los días, porque es una columna obligatoria y
   conviene que ordene y filtre bien.
2. **Jornada del evento.** Si todos los días tienen la misma, se muestra cuál; si varían, **«Varía»**
   con las dos. Tampoco se guarda: se calcula de los días. `Evento.tipoJornada` toma la del primer
   día solo como valor de compatibilidad. El cobro de cada día usa la suya y no cambia ningún precio.
3. **Cómo se prueban las reglas de la base.** Con un **script SQL** que se corre a mano contra una
   base local (`apps/api/prisma/pruebas/evento-varios-dias.sql`), con los casos de la tabla de
   `backlog.md`. No se agrega una base real al CI por ahora: eso tocaría `.github/`.

## Lo que se construyó en la parte 1

Migración `20261113120000_evento_varios_dias`, `EventoDia`, `EventoSalon` por día y `diaId` en las
líneas, con los eventos de hoy convertidos a un día cada uno. Dos ajustes al diseño original que
salieron de probarlo contra una base real:

- **La restricción de exclusión lleva `"eventoId" WITH <>`.** Así las filas de un mismo evento nunca
  chocan entre sí (un día que pasa la medianoche, o correr una franja reservada menos días de los que
  dura). El solapamiento es siempre contra OTRO evento.
- **Un renglón `Reservado` o `Cobrado` tiene horario (`evento_salon_horario_obligatorio`).** Con límites
  `NULL` el rango es infinito y bloquea el salón para siempre. El script de pruebas lo encontró: un día
  sin horario de un evento reservado chocaba con eventos de otras fechas. Antes lo cubría el CHECK de
  `Evento`, que ahora solo mira el primer y el último día.

La guarda del resumen usa una variable de transacción (`confluens.resumen_de_dias`) que enciende
solamente el trigger que recalcula el resumen, no `pg_trigger_depth()`: es explícita y no depende de
cómo se encadenen otros triggers.

**La aplicación.** Se mantienen las firmas de los repositorios: `crearEvento`, `actualizarEvento`,
`agendarConDistribuciones`, `reemplazarSalonesDelEvento` y las escrituras de líneas reciben lo mismo de
siempre y por dentro escriben el día (hoy, el único del evento) y completan `diaId`. Por eso casi todos
los tests de los servicios, que mockean los repositorios, no cambiaron.

**Cómo se probó.** (1) `apps/api/prisma/pruebas/evento-varios-dias.sql`: 31 casos contra una base real,
cada uno en una subtransacción que se revierte, y con una prueba inversa (se quita la restricción o la
guarda y el script lo detecta). (2) La migración sobre una copia de la base de demo: los eventos son
idénticos antes y después, cada uno tiene su único día y ningún salón ni línea quedó sin día.
(3) Un recorrido de la API real contra esa copia: modificar una consulta, agendar, cobrar la seña,
rechazo por solapamiento, mover la fecha de un evento reservado, reutilizar, recálculo masivo y
cancelar.

### Lo que NO se puede habilitar hasta la parte 2

La parte 1 solo es correcta mientras **todos los eventos tienen un único día**. Antes de permitir crear
uno de varios días hay que cambiar todo esto, que hoy busca «el» día del evento o mira el resumen:

| Dónde | Hoy | Hay que |
|---|---|---|
| `buscarSolapamiento` (eventos y pagos) | Consulta el resumen del evento (`inicio`, `fin`) y devuelve un solo choque | Consultar `EventoSalon` por día y devolver **todos** los choques, con fecha, salón, evento y horario (aviso de solapamientos de `backlog.md`) |
| `primerDiaDelEvento` en `actualizarEvento`, `reemplazarSalonesDelEvento`, `crearPresupuesto` y `reemplazarLineas` | Toma el primer día | Recibir el día al que se refiere cada cambio |
| `agendarConDistribuciones` y `quitarSalonesDelEvento` | Escriben por `eventoId` | Escribir por día |
| La agenda y los filtros por fecha | Filtran por `Evento.fecha` | Filtrar por el rango `fecha` a `fechaFin` |
| El recálculo (HU-54) y `reubicarHorario` | Mueven un día | Mover toda la franja, con el último día como referencia del incremento |
| La restricción de exclusión | No es `DEFERRABLE` | Revisar: correr una franja reservada de varios días puede pisar un día con otro mientras se actualizan de a uno |

## Lo que se construyó en la parte 2 (cotizador y presupuesto por día)

**Contrato** (`packages/shared`, con el OK del PO del 12/11/2026). El pedido de un solo día sigue
valiendo con los campos sueltos de siempre, así que nada de lo que ya funcionaba cambió; el de varios
días trae `dias[]`. Las dos formas llegan al servicio como la misma lista (`diasDeCotizacion`,
`diasDeModificacion`):

- `POST /presupuestos`: `dias[]` con fecha, personas, jornada, salones y servicios de cada día.
- `PATCH /presupuestos/:id`: `dias[]` con el estado completo de cada día (salones, servicios y
  adicionales). Cada día se identifica por su fecha: mandar una fecha de más o de menos en un extremo
  extiende o achica la franja. Un pedido con los campos sueltos **no** puede tocar un evento de varios
  días (se leería como achicarlo a uno y borraría el resto): responde 422.
- `POST /presupuestos/social`: `fechaFin` opcional; los días entran vacíos, con las personas y la
  jornada del cliente.
- `GET /presupuestos/:id`: `evento.fechaFin`, `dias` (con sus salones) y `diaId` en cada línea. El
  listado trae `fechaFinEvento`.

**Precio.** Un solo presupuesto, un solo total y una sola seña. Los precios se proyectan a la fecha del
**último día** (RN-13) para todo el presupuesto. Si al modificar cambia el último día, todo se
reprecia; si solo cambia el primero, lo que ya estaba conserva su precio. Cada servicio se controla
contra las personas de **su** día (RN-04).

**Cambiar la franja** (`reemplazarDiasYLineas`). Si la franja entera se corrió, cada fila conserva su
lugar y se mueve a su fecha nueva (hacia adelante desde el último día y hacia atrás desde el primero,
porque la fecha es única por evento: `@@unique([eventoId, fecha])`); si se extendió o achicó, se
conservan los días que siguen, se sacan los que quedaron afuera y los nuevos entran vacíos. Las líneas
se reemplazan todas, así que ninguna impide sacar un día (`LineaPresupuesto.diaId` es Restrict).

**Pantallas.** Selector de franja (un clic = un día; un segundo clic conecta; hasta 32 días, con los
posteriores deshabilitados), cotizador con una pestaña por día y «copiar el día anterior», documento del
presupuesto día por día con un único total, y editor del panel día por día para la consulta (también
para completar una consulta social). El listado muestra hasta cuándo dura.

### Decisiones de esta parte que el PO tiene que mirar

1. **Hora de inicio estimada: una para todo el evento.** `backlog.md` pide que el cliente elija el
   horario de cada día del cotizador corporativo, pero `EventoDia` no tiene dónde guardar una hora
   estimada por día (`inicio` y `fin` son el horario real, que se carga al agendar). Hasta decidir si se
   agrega esa columna, la hora estimada es una sola y vale para todos los días; el horario exacto de
   cada día lo fija el Responsable de Eventos al agendar (parte 3). Pendiente `S-16` en `pendientes.md`.
2. **Reservar, cobrar la seña y reutilizar un evento de varios días responden 422** hasta la parte 3:
   siguen mirando un solo horario por evento y darían un falso solapamiento o un día sin mover. Un evento
   reservado tampoco se puede estirar a varios días. El recálculo masivo del incremento (HU-54) **sí**
   alcanza a un evento de varios días y proyecta al último.

### Lo que NO se puede habilitar hasta la parte 3

Se mantienen los puntos de la parte 1 que siguen abiertos: `buscarSolapamiento` (que hoy mira el resumen
del evento) y el aviso de **todos** los choques por día y salón, la agenda y los filtros por fecha, el
horario por día al agendar, y la restricción de exclusión no diferida. Con la guarda de arriba nada de
eso se puede alcanzar con un evento de varios días.

## Lo que se construyó en la parte 3 (agenda, reserva y comanda por día)

Esta parte **levanta las guardas de la parte 2 para agendar y cobrar la seña**: un evento de varios días
ya se agenda día por día, se reserva entero con la seña y se controla contra los eventos de cada día.
Reutilizar un evento de varios días sigue respondiendo 422 hasta la parte 4.

**Contrato** (`packages/shared`, el mismo patrón de las partes anteriores: lo de siempre sigue valiendo y
`dias` es la forma nueva):

- `POST /eventos/:id/agendar`: `dias[{ fecha, inicio, fin }]`, uno por cada día del evento. Un evento de
  un solo día sigue mandando `inicio` y `fin` sueltos; uno de varios días con el horario suelto responde
  422. Las distribuciones siguen siendo una por salón y valen en todos los días en que se usa ese salón.
- El detalle del evento y la agenda traen `dias` (con su horario, personas, jornada y salones) y
  `fechaFin`; los salones del resumen no se repiten.
- `GET /presupuestos/:id/choques`: el aviso preventivo de una consulta (ver abajo).
- `ChoqueDeSalon`: día, salón y el evento que lo ocupa (número, cliente, estado y horario).

**RN-12 por día.** El solapamiento se compara contra el horario de **cada día** de los otros eventos (el
renglón `EventoSalon` de ese día), nunca contra el resumen del evento: el resumen va del inicio del primer
día al fin del último y daría choques falsos en las noches entre un día y el otro. Lo cambió
`buscarSolapamiento` (también para un evento de un solo día), `buscarConsultasSuperpuestas` y
`buscarSalonesReservadosEseDia`. La restricción de exclusión de la base sigue siendo la red de seguridad
final. No hizo falta diferirla: las filas de un mismo evento no chocan entre sí (parte 1) y cada fila va
directo a su fecha final.

**Todos los choques, por día y por salón** (decisión del PO, 12/11/2026). Al agendar o al reservar con la
seña, un evento de varios días se rechaza con **409** y un mensaje que lista cada choque (día, salón,
evento con su número y cliente, y horario) y dice cuántos días quedan libres; el detalle del error trae
una línea por choque con la fecha como `campo`. Un choque en cualquier día impide reservar el evento
entero. Ejemplo:

> No se puede reservar el evento: 2 de sus 5 días tienen un salón ocupado.
> - viernes 14/05/2027 · Salón Pucará: reservado por el evento #52 (Constructora Medina SRL), de 09:00 a 18:00.
> - sábado 15/05/2027 · Salón Iguazú: reservado por el evento #61 (Agustina Herrera), de 08:00 a 12:00.
>
> Los otros 3 días están libres. Hablá con el cliente para mover el día, el horario o el salón.

**Aviso preventivo** en el panel, al armar o revisar una consulta: los salones que otros eventos ya ocupan
en los días de la consulta, con su horario. La consulta no bloquea el salón (RN-12). El cliente en el canal
público no lo ve.

**Seña de un evento de varios días.** Antes de aceptar la plata se controla que **cada día** tenga horario
y salón (si no, 422 que dice cuál; sin eso el error aparecía recién al cerrar la transacción) y que ningún
día choque. El estado, el salón y la seña son del evento entero.

**Pantallas.** El formulario de horario pide el de cada día (con «mismo horario que el día anterior»); la
agenda muestra el evento como **una sola barra larga** y, en las tarjetas y el listado, el rango de
personas, «Varía» si la jornada cambia y el horario si es el mismo todos los días; el detalle del evento
suma un bloque día por día y marca cada línea del presupuesto con su día; la **comanda sale una por día**
(salones, horario, personas y gastronomía de ese día, y las notas del evento repetidas en cada hoja).

**Cómo se probó.** Tests de servicio (agendar y reservar con repositorio de mentira), del mensaje de
choques y de las consultas de Prisma, y un recorrido contra la base real: reservar un evento de tres días,
un evento a la noche entre dos de sus horarios (no choca), uno que pisa el día 2 (409), uno con dos días en
choque (409 con las dos líneas), un día del medio sin horario (422, no 500), el aviso preventivo y la agenda
por rango.

## Cómo se entrega (propuesta)

HU-50 se parte en cuatro partes que se entregan por separado. **Esta ADR cubre la primera**:

1. **Modelo y solapamiento por día** (esta ADR, **construida**): `EventoDia`, `EventoSalon` por día, `diaId` en las
   líneas, las restricciones, los triggers y la migración, con los flujos de hoy adaptados para que
   todo siga funcionando con eventos de un día. **No cambia ninguna pantalla.**
2. Cotizador y presupuesto por día (**construida**): contrato `dias[]`, selector de franja, pestañas por día, editor del panel y documento por día.
3. Agenda y comanda por día (**construida**): horario por día al agendar, solapamiento por día con el aviso de todos los choques, reserva del evento entero con la seña, agenda en barra larga y comanda por día.
4. Repetir evento y recálculo con el último día como referencia.

Los cambios de `schema.prisma`, la migración y `packages/shared` (el esquema del día y la validación
de la franja de 32 días) necesitan la confirmación del PO (`AGENTS.md` §6) **sobre este diseño** antes
de escribirse.

# ADR 0014 — Evento de varios días: una tabla de días y el solapamiento por día en la base

**Fecha:** 2026-11 · **Estado:** propuesta (pendiente de la revisión del PO; no se escribió código ni `schema.prisma`)

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

## Detalles de diseño para revisar

Tres puntos donde la propuesta elige algo que el PO puede querer distinto:

1. **Personas en el resumen del evento.** `Evento.cantidadPersonas` pasa a ser el **máximo** de los
   días, porque la agenda y la tarjeta muestran un solo número. El detalle por día vive en
   `EventoDia`.
2. **Jornada en el resumen del evento.** `Evento.tipoJornada` toma la del **primer** día. Sirve a los
   eventos de un día y a lo que hoy lo lee; el cobro de cada día usa la jornada de ese día.
3. **Cómo se prueba la base.** Un script SQL con los casos de `backlog.md` (la tabla del tope y el
   solapamiento por día) contra la base local, a mano, o una base real en el CI. Lo segundo es una
   decisión del equipo y toca `.github/`.

## Cómo se entrega (propuesta)

HU-50 se parte en cuatro partes que se entregan por separado. **Esta ADR cubre la primera**:

1. **Modelo y solapamiento por día** (esta ADR): `EventoDia`, `EventoSalon` por día, `diaId` en las
   líneas, las restricciones, los triggers y la migración, con los flujos de hoy adaptados para que
   todo siga funcionando con eventos de un día. **No cambia ninguna pantalla.**
2. Cotizador y presupuesto por día.
3. Agenda y comanda por día.
4. Repetir evento y recálculo con el último día como referencia.

Los cambios de `schema.prisma`, la migración y `packages/shared` (el esquema del día y la validación
de la franja de 32 días) necesitan la confirmación del PO (`AGENTS.md` §6) **sobre este diseño** antes
de escribirse.

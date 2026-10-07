# ADR 0008 — Las consultas sociales no pasan por el cotizador

**Fecha:** 2026-10  ·  **Estado:** aceptada

## Contexto

El Responsable de Eventos trabaja con dos tipos de evento muy distintos (decisión del PO,
07/10/2026):

- **Corporativo**: capacitaciones, reuniones, congresos. Salón, jornada y servicios del catálogo
  alcanzan para cotizarlo, y el cotizador del canal público ya lo resuelve solo.
- **Social**: cumpleaños, casamiento, fiesta de 15, bautismo, fiesta corporativa u otro. Cada uno
  es tan personalizable que un presupuesto automático no sirve: lo tiene que armar él con el
  cliente. Todavía no hay una plantilla con los datos propios de un evento social.

El modelo asumía que todo evento nace con salón (`Evento.salonId` obligatorio) y que todo
presupuesto vence a los 10 días desde que se emite (`Presupuesto.venceEn` obligatorio). Una
consulta social no tiene ni salón ni presupuesto que pueda vencer. Además, la pestaña Consultas
lista presupuestos, y cada evento tiene un solo presupuesto (decisión del PO, 06/10/2026).

## Decisión

El cotizador pregunta primero por el evento (fecha, personas, jornada, hora de inicio estimada
opcional) y después por el tipo. Si es **corporativo**, sigue como antes. Si es **social**, el
cliente elige qué celebra y `POST /presupuestos/social` registra un evento `EnConsulta` tipo
`Social`, **sin salón**, con su único presupuesto `Estimado` **sin armar**: sin líneas, en 0 y con
`venceEn` en `NULL`.

El Responsable de Eventos arma ese presupuesto desde la consulta, con la misma pantalla de HU-12.
La vigencia de 10 días arranca cuando el presupuesto tiene su primera línea (decisión del PO,
07/10/2026). Desde ahí sigue el mismo circuito que un corporativo: agendar y cobrar la seña del 20%
(ADR 0007).

El salón es obligatorio para reservar, no desde `EnConsulta`. Lo exige el CHECK
`evento_salon_obligatorio`, igual que `evento_horario_obligatorio` exige el horario. Agendar y el
pago que cruza el 20% rechazan un evento sin salón con `422`.

## Consecuencias

**A favor.** Fran recibe las consultas sociales sin que el cliente vea precios que no van a
valer, y las ve en la misma pestaña que las corporativas, distinguidas por color. No hace falta una
entidad nueva ni una pantalla aparte para armar el presupuesto. Las restricciones de la base
siguen impidiendo reservar un salón que no existe.

**En contra.** `Evento.salon` y `Presupuesto.venceEn` pueden ser `NULL`, y todo el código que los
lee tiene que contemplarlo (listado, detalle, agenda, calendario). La jornada ya no se puede
deducir siempre de la línea del salón, así que se guarda en `Evento.tipoJornada`; en los eventos
anteriores sigue saliendo de la línea. La plantilla del evento social queda pendiente
(`pendientes.md`): el detalle muestra ese bloque vacío.

**Alternativas descartadas.**

- *Crear un presupuesto vacío que venza a los 10 días:* no cambia el schema, pero las consultas
  sociales aparecerían como «vencida, recalcular» antes de que nadie las arme.
- *Registrar la consulta social solo como `Solicitud`, sin evento:* la pestaña Consultas, la
  modificación y el cobro trabajan sobre el presupuesto del evento. Habría que duplicar ese
  circuito para los sociales.
- *Asignar un salón cualquiera para cumplir el NOT NULL:* es un dato falso, y el salón decide el
  solapamiento (RN-12).

# ADR 0011 — Varios salones por evento, con el horario replicado por trigger

**Fecha:** 2026-10 · **Estado:** aceptada

## Contexto

Un evento puede realizarse en más de un salón a la vez: se reparte la gente entre varios espacios,
y la cantidad de salones no cambia la duración del evento, que sigue teniendo un solo horario
(decisión del equipo, 09/10/2026). Hasta ahora `Evento.salonId` era una sola clave foránea.

El problema no es la relación en sí, es lo que cuelga de ella. El no solapamiento de RN-12 se
garantiza en la base con una restricción de exclusión sobre `Evento`:

```sql
EXCLUDE USING gist ("salonId" WITH =, tsrange("inicio", "fin") WITH &&)
  WHERE (estado IN ('Reservado', 'Cobrado'))
```

`modelo-datos.md` es explícito sobre por qué existe: es la validación **que la aplicación no puede
saltear**. Una restricción de exclusión necesita todas sus columnas **en la misma fila**, y al
pasar los salones a una tabla aparte el salón y el rango horario dejan de estar juntos: el salón
queda en `EventoSalon` y el horario en `Evento`.

## Decisión

Los salones de un evento viven en **`EventoSalon`**, con su distribución. La tabla lleva **copia**
de `inicio`, `fin` y `estado` del evento, y la restricción de exclusión se muda ahí. Esas tres
columnas las mantienen **dos triggers**, nunca la aplicación:

- `evento_propaga_horario`, en `Evento` después de actualizar `inicio`, `fin` o `estado`, las
  propaga a todos los salones del evento.
- `evento_salon_copia_horario`, en `EventoSalon` antes de insertar o actualizar, las toma del
  evento, descartando lo que venga en el `INSERT`.

El cambio se hizo en dos pasos (*expand / contract*): primero se creó `EventoSalon` copiando el
salón de cada evento y la aplicación pasó a leerla; después se borraron `Evento.salonId` y
`Evento.distribucionId`. El CHECK `evento_salon_obligatorio` (ADR 0008) miraba `Evento.salonId`,
así que lo reemplazan dos *constraint triggers* diferidos (`evento_reservado_con_salon`): un evento
fuera de `EnConsulta` y `Cancelado` tiene que tener al menos un renglón en `EventoSalon` al cerrar
la transacción.

## Consecuencias

**A favor.**

- La garantía de la base sobrevive al cambio de relación, que era el punto a cuidar: un evento
  `Reservado` sigue sin poder pisar a otro en el mismo salón y horario, ahora por cada salón que
  ocupe.
- **Es imposible desincronizar los datos.** El estado del evento cambia al registrar un pago, al
  cancelar y al modificar el presupuesto, y el horario cambia al agendar y al correr la fecha de
  un evento confirmado. Si cada uno de esos caminos tuviera que acordarse de actualizar
  `EventoSalon`, el día que se agregue un camino nuevo la base dejaría de garantizar el no
  solapamiento **sin que nadie se entere**. Con los triggers, el camino nuevo no tiene que saber
  que la tabla existe.
- La aplicación se ocupa solo de qué salones están vinculados, que es la parte que realmente
  decide.

**En contra.**

- Hay dato duplicado. Está asumido a conciencia: es el precio de conservar la restricción de
  exclusión, que no admite columnas de otra tabla.
- Lógica en la base, que no se ve leyendo el código de la API. Por eso los triggers están
  comentados en la migración, el modelo de Prisma avisa **no escribir estas tres columnas a mano**
  y existe esta ADR.
- Prisma no conoce los triggers: al leer `EventoSalon` justo después de escribir en `Evento` en la
  misma transacción, hay que releer la fila en vez de confiar en lo que se mandó.

**Alternativas descartadas.**

- **Que la aplicación sincronice las copias.** Es lo mismo pero frágil, y falla justo en el caso
  que importa: el camino nuevo que nadie actualizó.
- **Dejar el no solapamiento solo en la aplicación.** Es renunciar a la red que `modelo-datos.md`
  pide explícitamente. Una condición de carrera entre dos pagos simultáneos alcanzaría para
  reservar dos veces el mismo salón.
- **Mover `inicio` y `fin` a `EventoSalon`** y que cada salón tenga su horario. El modelo quedaría
  sin duplicación y habilitaría usar salones en momentos distintos, pero el horario es del evento:
  la cantidad de salones no cambia cuándo empieza ni cuándo termina. Habría dos fuentes de verdad
  para una sola hora y nada impediría que dos salones del mismo evento quedaran con horarios
  distintos.
- **Dejar `Evento.salonId` como "salón principal"** y sumar los demás aparte. Dos fuentes de verdad
  para la misma pregunta; se contradicen el día que alguien actualice una sola.

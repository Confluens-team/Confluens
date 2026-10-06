# ADR 0007 — La reserva la dispara el pago, y `/reservar` pasa a `/agendar`

**Fecha:** 2026-10 · **Estado:** aceptada

## Contexto

El Sprint 1 dejó `POST /api/eventos/:id/reservar`: cargaba distribución y horario, pasaba el evento
a `Reservado`, el presupuesto a `Confirmado` y fijaba `senaVenceEn`. El salón quedaba tomado **sin
que el cliente hubiera pagado nada**, y un trabajo horario (`senas.trabajo.ts`) cancelaba las
reservas cuya seña vencía.

Las dos cosas contradicen la documentación aprobada:

- `dominio.md:21` dibuja la máquina de estados como
  `EnConsulta ──registrarPago()──> Reservado ──registrarPago()──> Cobrado`.
- `dominio.md:30` dice que `Cancelado` es «siempre manual» y `dominio.md:36` que «no hay cancelación
  automática».
- `sprint-02.md:116` dice que HU-13 **no tiene endpoint propio**: la confirmación la dispara el
  registro de un pago (HU-14) al cruzar el 20%, dentro de la misma transacción.
- `sprint-02.md:149` marca el comportamiento del Sprint 1 como un ajuste pendiente.

Borrar el endpoint tampoco servía. El evento guarda la `fecha`, pero para tomar un salón hacen
falta además `inicio`, `fin` y `distribucionId`, y en todo el sistema hay **un solo lugar** que
carga esos tres datos: ese endpoint. Revisadas las 7 historias del Sprint 2, ninguna agrega otro. Y
RN-12 (`sprint-02.md:113`) exige comparar horarios para saber si el salón está libre: con solo la
fecha no hay con qué comparar.

## Decisión

El evento se reserva **cuando entra la plata**, no cuando alguien aprieta un botón:
`POST /api/eventos/:id/pagos` registra el pago y, en la misma transacción, confirma el presupuesto y
pasa el evento a `Reservado` si el acumulado cruza el 20% de la base de cobro (RN-01), y a `Cobrado`
si llega al 100%.

`POST /api/eventos/:id/reservar` se renombra a `POST /api/eventos/:id/agendar`: conserva todas sus
validaciones (distribución del salón, capacidad, `fin > inicio`, solapamiento) pero **no cambia
ningún estado**. Después de agendar, el evento sigue `EnConsulta` y su presupuesto sigue `Estimado`.
Agendar es el prerrequisito de cobrar la seña, no un sustituto: si un pago fuera a cruzar el 20% y
el evento no tiene horario cargado, el pago se **rechaza** con `422` pidiendo agendarlo primero.

## Consecuencias

**A favor.** El estado del evento deja de ser una afirmación manual y pasa a ser consecuencia de un
hecho verificable: la suma de los pagos. Un salón no puede quedar bloqueado por alguien que nunca
pagó. La máquina de estados del código queda igual a la de `dominio.md`. Y como todo ocurre en una
transacción, no existe el estado intermedio «pago registrado pero evento sin reservar».

**En contra.** Un pago puede fallar por un motivo que no tiene que ver con el pago: el horario no
está cargado (`422`) o el salón ya lo tomó otro evento (`409`). El mensaje de error lo explica, pero
es un acoplamiento real entre dos acciones que el usuario percibe como separadas. Además, con base
de cobro **con IVA** el 20% casi nunca da un monto exacto en centavos (576.487,56 × 20% =
115.297,512), así que la pantalla redondea la seña para arriba al centavo para no pedir plata
imposible de entregar.

**Alternativas descartadas.**

- *Borrar `/reservar` y cargar el horario en otro lado:* no hay otro lado. Ninguna historia del
  Sprint 2 agrega una pantalla que cargue distribución y horario.
- *Dejar que el pago reserve a ciegas, sin horario:* sin `inicio`/`fin` no se puede evaluar RN-12 y
  el mismo salón podría venderse dos veces en la misma franja.
- *Aceptar el pago en silencio y no reservar:* el cliente pagó la seña y nadie se entera de que el
  salón no quedó tomado. Peor que rechazar con un mensaje claro.
- *Mantener el botón «confirmar reserva» además del pago:* son dos fuentes de verdad para el mismo
  estado. Es exactamente lo que `dominio.md` no quiere.

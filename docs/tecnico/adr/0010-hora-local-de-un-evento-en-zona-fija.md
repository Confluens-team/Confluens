# ADR 0010 — La hora local de un evento se resuelve con una zona horaria fija

**Fecha:** 2026-10 · **Estado:** aceptada

## Contexto

`Evento.inicio` y `Evento.fin` son `DateTime`: Postgres guarda un **instante absoluto**, en UTC.
La hora a la que se espera un servicio del presupuesto (`LineaPresupuesto.horaEstimada`) es, en
cambio, un **reloj de pared**: el texto `"13:00"`.

Al validar que la hora de un servicio caiga dentro del horario del evento hay que comparar las dos
cosas, y para eso hay que convertir el instante a hora de reloj. Esa conversión **obliga a elegir
una zona horaria**: no hay respuesta neutra. Un evento guardado como `15:00Z`–`21:00Z` es de 12:00
a 18:00 leído en Córdoba y de 15:00 a 21:00 leído en UTC; un servicio a las 13:00 entra en el
primer caso y se rechaza en el segundo.

Lo natural sería usar la hora local del proceso (`fecha.getHours()`), pero eso no sirve: en las
máquinas del equipo el sistema está en hora argentina y en Render el contenedor corre en UTC. La
misma consulta se validaría distinto en desarrollo y en producción, y el CI tampoco lo detectaría
porque también corre en UTC.

A esto se suma que la web ya venía mostrando los horarios con `toLocaleTimeString('es-AR')` **sin**
zona explícita, o sea con la del navegador. Mientras todos miran desde Córdoba coincide con la del
servidor y no se nota, pero son dos criterios distintos conviviendo: alcanza con abrir el panel
desde una máquina con otra zona para que la pantalla muestre una franja y la API valide contra
otra.

## Decisión

La hora local de un evento se resuelve **siempre** con la zona fija
`America/Argentina/Cordoba`, declarada una sola vez en `packages/shared`
(`ZONA_HORARIA_EVENTOS`) y aplicada por `horaDelEvento()`, que la API y la web usan por igual.
Ningún lado vuelve a depender de la zona del proceso ni de la del navegador.

## Consecuencias

**A favor.**

- El resultado es el mismo corra donde corra: la máquina de cualquier integrante, el CI, Render.
  No hace falta configurar `TZ` en ningún entorno ni acordarse de hacerlo en el próximo deploy.
- La web y la API muestran y validan la misma franja, así que el límite del selector de hora y el
  `422` de la API no pueden contradecirse.
- El negocio es un solo hotel en Córdoba y **Argentina no tiene horario de verano desde 2009**:
  el desfase es un `-03:00` estable, sin horas ambiguas ni saltadas, que es lo que suele complicar
  este tipo de código.

**En contra.**

- Queda escrita la suposición de que todos los eventos son en Argentina. Si el negocio abriera una
  sede en otro país habría que guardar la zona por salón o por evento y pasarla a la función. Es
  una constante en un solo archivo, pero es una suposición al fin.
- La hora que ve el usuario deja de ser la de su propio reloj. Para el personal del hotel es lo
  correcto —el horario del evento es el del salón, no el de quien mira la pantalla—, pero puede
  sorprender a quien abra el panel desde otra zona.

**Alternativas descartadas.**

- **`TZ=America/Argentina/Cordoba` como variable de entorno en Render.** Funciona, pero deja la
  regla colgando de configuración invisible: no está declarada en `.env.example`, `cargarEntorno`
  no la valida y un servicio nuevo que se olvide de setearla rompe la validación en silencio. Un
  error de configuración no debería cambiar una regla de negocio.
- **Usar la hora local del proceso y del navegador.** Es lo que había y es justamente el problema:
  da distinto en desarrollo y en producción, y entre el servidor y el cliente.
- **Guardar hora de pared en vez de instante.** Resuelve la ambigüedad de raíz y es lo que haría
  un sistema multi-sede, pero cambia el modelo del evento, la restricción de no solapamiento de
  RN-12 (que compara `tsrange(inicio, fin)`) y todo lo que hoy lee esos campos. Desproporcionado
  para un hotel en una sola ciudad.

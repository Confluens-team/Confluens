# Backlog — Confluens

Las 53 historias del Product Backlog, alineadas con el Seguimiento del Proyecto.
Una línea por historia: para los criterios de aceptación completos ver el archivo del sprint
en curso. **Jira es la fuente de verdad del estado**; este archivo solo dice qué existe y dónde cae.

Total: 53 historias · 226 + 6 story points\* · 9 historias sin estimar (HU-48 a HU-56) · 12 Epics

> **Cambios por la reunión con el cliente del 05/11/2026** (validados por el PO el 06/11/2026; las
> reglas están en `dominio.md`, con la marca «Reunión 05/11/2026 → HU-xx»):
> - Se **agregan siete historias**, HU-50 a HU-56, sin puntos: se estiman en el Sprint Planning.
>   Los códigos son de este archivo y se cargan en Jira al planificarlas.
> - **HU-34** suma los tramos consecutivos del porcentaje general y el porcentaje propio por
>   servicio (RN-10, RN-13).
> - **HU-28 a HU-31** (usuarios) pasan a la sección **Personal** de Configuración de negocio: el
>   GG y el ADM registran, modifican y dan de baja (lógica) al personal, con un rol por usuario y
>   siempre al menos un GG y un ADM. El GG asigna GG, RE y RF; el ADM, cualquier rol. Los permisos
>   de cada rol van en HU-56.
> - Se resuelven sin historia nueva: corregir un pago registrado con error y pasar un pago a otro
>   evento (los dos con la anulación, HU-35 del Sprint 4), y modificar un evento de fecha pasada (ya
>   no hay ningún control por fecha; falta probarlo en la web).
> - Correcciones que van a Jira sin historia: el nombre del PDF del presupuesto pasa a ser
>   `presupuesto-AAAA-MM-DD-apellido.pdf` con la fecha del evento; los campos de importe solo dejan
>   tipear dígitos y un separador decimal; el botón «Salir» del cotizador no funciona y tiene que
>   pedir confirmación («¿Seguro que querés salir? Tu consulta todavía no se completó»).

> **Cambios por la entrevista con el Responsable de Eventos (24/09/2026)**:
> - Se **elimina HU-08** (baja de cliente por inactividad): el cliente no quiere baja por inactividad.
> - Se **agregan HU-48** (registro del cliente) y **HU-49** (presupuesto dinámico y confirmación de la consulta en el canal público). Sin puntos: se estiman en el Sprint Planning.
> - **HU-34** cambia de actor (Responsable de Eventos, no Gerente General) y de alcance: porcentaje mensual editable más aumentos globales o por servicio en cualquier momento.
> - **HU-24** ya no envía el presupuesto por WhatsApp: el botón `wa.me` solo avisa la recepción de la consulta y el resumen se descarga en PDF para enviarlo a mano.
> - Las reglas que cambian criterios de historias existentes (vigencia de 10 días, sin cancelación automática, IVA, recargos, tercerizados con precio) están en `dominio.md`. Al escribir los criterios de cada historia en su sprint, **manda `dominio.md`** sobre cualquier documento anterior.

> **Notas de esta corrección** (ahora usando `Seguimiento del Proyecto`, sección 2.1.6/2.1.7, como fuente de verdad para la numeración de Epics — no `Definición del Producto`):
> - Se renumeraron los 12 Epics para que coincidan con Seguimiento del Proyecto: Gestión de Servicios pasa de EPIC-09 a **EPIC-04**; Gestión de Reservas de Eventos de EPIC-04 a **EPIC-05**; Gestión de Pagos de Clientes de EPIC-11 a **EPIC-06**; Notificaciones y Alertas de EPIC-06 a **EPIC-07**; Auditoría de Cambios de EPIC-07 a **EPIC-08**; Gestión de Medios de Pago de EPIC-10 a **EPIC-09**; Gestión de la Landing Page de EPIC-12 a **EPIC-10**; Reportes e Indicadores de EPIC-05 a **EPIC-11**; Administración de Accesos de EPIC-08 a **EPIC-12**. Salones, Clientes y Presupuestos no cambian de número.
> - **HU-43 (Emitir el presupuesto confirmado)** se mueve de "Reportes e Indicadores" a **"Gestión de Presupuestos de Eventos"**, porque así la agrupa el Story Map de Seguimiento del Proyecto.
> - Las historias en sí (HU-01 a HU-47), sus puntos, RD y actor no cambian: ese nivel de detalle solo existe en la Definición del Producto v0.3 (Seguimiento del Proyecto no numera historias ni asigna puntos). Los totales de puntos por Epic se recalcularon según el nuevo agrupamiento, pero el total general (235 pts) es el mismo.
> - El Story Map de Seguimiento (2.1.7) menciona 4 títulos sin HU/RD/puntos propios en la Definición del Producto: **Cerrar sesión** y **Cambiar contraseña** (bajo Administración de Accesos), y **Consultar pagos de un evento** y **Generar y emitir un recibo como comprobante válido de pago** (bajo Pagos de Clientes). Quedan listados al pie del Epic correspondiente como pendientes: a definir si necesitan HU propia o ya están cubiertas por los criterios de HU-27, HU-30, HU-41 y HU-11.
> - Aviso: los códigos RG-XX de cada Epic (heredados de la Definición del Producto/Plan de Proyecto) ya **no coinciden numéricamente** con el nuevo EPIC-XX — p. ej. Servicios sigue citado como RG-09 aunque ahora es EPIC-04. No los renumeré por no tener acceso al Plan de Proyecto para confirmar si el RG es un código fijo independiente del orden de Epics. Conviene chequearlo ahí.
> - \* HU-46 y HU-47 (Landing Page) figuran como pendientes de Planning Poker en la Definición del Producto v0.3, pero el Sprint 1 (más reciente) ya las trabajó con 3 puntos cada una — ver nota de EPIC-10.

## EPIC-01 — Gestión de Salones

RG-01. Gestionar los salones de eventos y su disponibilidad.  ·  3 historias  ·  11 pts  ·  Must have

| HU | Título | RD | Pts | Sprint | Actor |
|---|---|---|---|---|---|
| HU-01 | Consultar salones y su capacidad | RD-01.2 | 3 | 1 | Responsable de Eventos |
| HU-02 | Registrar las distribuciones posibles de un salón | RD-01.1 | 5 | 4 | Responsable de Eventos |
| HU-03 | Modificar los datos de un salón | RD-01.3 | 3 | 4 | Responsable de Eventos |

## EPIC-02 — Gestión de Clientes

RG-02. Gestionar los clientes de la organización.  ·  4 historias  ·  13 pts  ·  Must have

| HU | Título | RD | Pts | Sprint | Actor |
|---|---|---|---|---|---|
| HU-04 | Registrar un cliente | RD-02.1 | 3 | 2 | Responsable de Eventos |
| HU-05 | Consultar clientes | RD-02.4 | 3 | 3 | Responsable de Eventos |
| HU-06 | Modificar los datos de un cliente | RD-02.2 | 2 | 3 | Responsable de Eventos |
| HU-07 | Consultar el historial de eventos de un cliente | RD-02.3 | 5 | 3 | Responsable de Eventos |

~~HU-08 Registrar la baja de un cliente por inactividad~~: eliminada, no hay baja por inactividad (entrevista 24/09/2026). El código HU-08 no se reasigna.

## EPIC-03 — Gestión de Presupuestos de Eventos

RG-03. Gestionar los presupuestos.  ·  13 historias  ·  37 pts + HU-49 y HU-51 a HU-55 sin estimar  ·  Alta

| HU | Título | RD | Pts | Sprint | Actor |
|---|---|---|---|---|---|
| HU-09 | Generar un presupuesto estimado | RD-03.1 | 13 | 1 | Responsable de Eventos |
| HU-10 | Consultar el listado de presupuestos | RD-03.2 | 3 | 2 | Responsable de Eventos |
| HU-11 | Consultar el detalle de un presupuesto | RD-03.4 | 3 | 2 | Responsable de Eventos |
| HU-12 | Modificar un presupuesto | RD-03.3 | 8 | 2 | Responsable de Eventos |
| HU-13 | Registrar un presupuesto confirmado | RD-03.5 | 5 | 2 | Responsable de Eventos |
| HU-45 | Registrar un presupuesto cancelado | RD-03.6 | 2 | 3 | Responsable de Eventos |
| HU-43 | Emitir el presupuesto confirmado | RD-05.3 | 3 | 5 | Responsable de Eventos |
| HU-49 | Armar un presupuesto estimado y confirmar la consulta en el canal público | — | a estimar | a definir | Cliente |
| HU-51 | Agregar servicios propios a un evento | — | a estimar | a definir | Responsable de Eventos |
| HU-52 | Registrar lo pagado de más como no reintegrable | — | a estimar | a definir | Responsable de Eventos |
| HU-53 | Calcular todo presupuesto nuevo con IVA | — | a estimar | 4 | Sistema |
| HU-54 | Recalcular el presupuesto automáticamente | — | a estimar | a definir | Sistema |
| HU-55 | Cobrar la seña de un presupuesto vencido | — | a estimar | 5 | Responsable de Finanzas |

**HU-51.** Desde el detalle del presupuesto, el personal agrega servicios que no están en el
catálogo, propios de ese evento: cada uno es una línea con precio, cantidad y su propia
observación, suma al total y sale en el PDF del presupuesto y en la comanda. No se guarda en el
catálogo. Se construye sobre los adicionales escritos a mano y reemplaza a la caja de texto única
del evento social.

**HU-52.** Si un cambio baja el total por debajo de lo pagado, un cartel lo avisa y pide
confirmarlo. Confirmado, el saldo queda en $0 y lo pagado de más se registra como «no
reintegrable», informativo en la cuenta del evento; lo que se agregue después se paga completo.
Reemplaza el saldo a favor. Cambia el modelo.

**HU-53.** Se saca la casilla Con o Sin factura: todo presupuesto nuevo requiere factura y su base
de cobro es el total con IVA (RN-01). Los existentes conservan su marca. Todos los medios de pago
quedan habilitados en todos los cobros (RN-14) y el alta y la modificación de medios dejan de pedir
el caso. Sin cambio de modelo: `requiereFactura` sigue en uso para los anteriores y los nuevos se
crean con `true`.

**HU-54.** Se saca el botón Recalcular. Al cambiar la fecha del evento se recalcula con los precios
de la fecha nueva, en cualquier estado, y se reinicia la vigencia; al cambiar el porcentaje (o un
tramo, HU-34) se recalculan solo los presupuestos `Estimado` de eventos `EnConsulta`, sin
reiniciar la vigencia. Un `Expirado` se recalcula solo si cambia su fecha. Corrige HU-27 del
Sprint 4, que deja recalcular un presupuesto confirmado. **El recálculo por cambio de fecha ya está
construido** (09/11/2026, ver «Recálculo automático» en `dominio.md`); faltan el del porcentaje y
sacar el botón Recalcular.

**HU-55.** La seña se registra aunque el presupuesto esté `Expirado`, sin recalcular: la vigencia
de 10 días es una leyenda para el cliente (RN-06, RN-08). Agrega `Expirado → Confirmado` a la
máquina del presupuesto.

**HU-49.** El cliente registrado carga sus datos y la fecha; ve precios proyectados a esa fecha (RN-13); elige salón, distribución, jornada, personas, servicios con modalidad (RN-11) y audiovisual; ve en vivo subtotal sin IVA, IVA 21% y total (RN-05); confirma y recibe un correo de consulta recibida. Se guarda como Solicitud con sus líneas. No bloquea el salón. Depende de HU-48 y de S-11 (proveedor de correo).

## EPIC-04 — Gestión de Servicios

RG-09. Gestionar servicios.  ·  4 historias  ·  23 pts  ·  Media

| HU | Título | RD | Pts | Sprint | Actor |
|---|---|---|---|---|---|
| HU-32 | Registrar un servicio | RD-09.1 | 5 | 1 | Responsable de Eventos |
| HU-33 | Modificar un servicio | RD-09.2 | 3 | 4 | Responsable de Eventos |
| HU-34 | Configurar el incremento de precios (mensual automático, global o por servicio) | RD-09.3 | 13 | 5 | Responsable de Eventos |
| HU-35 | Dar de baja un servicio | RD-09.4 | 2 | 6 | Responsable de Eventos |

**HU-34** (alcance ampliado el 05/11/2026). El porcentaje general se carga en tramos con fecha de
inicio y de fin («+» para sumar): consecutivos, el inicio de cada uno lo completa el sistema al día
siguiente del fin del anterior, y el último no tiene fin. Si se cambia el fin de un tramo, el
siguiente se corre solo; si el fin nuevo pasa el fin del siguiente, se rechaza. Un servicio puede
tener su propio porcentaje, que reemplaza al general; al cambiar el general, el sistema avisa y deja
elegir en cada servicio si conserva el suyo. La proyección de RN-13 usa el porcentaje de cada mes.
Conviene re-estimarla.

## EPIC-05 — Gestión de Reservas de Eventos

RG-04. Gestionar eventos.  ·  9 historias  ·  62 pts + HU-50 sin estimar  ·  Alta

| HU | Título | RD | Pts | Sprint | Actor |
|---|---|---|---|---|---|
| HU-14 | Registrar un evento en consulta | RD-04.2 | 5 | 1 | Cliente |
| HU-15 | Registrar la reserva de un evento | RD-04.1 | 13 | 1 | Responsable de Eventos |
| HU-16 | Modificar los datos de un evento | RD-04.3 | 5 | 4 | Responsable de Eventos |
| HU-17 | Consultar el calendario de eventos | RD-04.5 | 13 | 2 | Responsable de Eventos |
| HU-18 | Reasignar un evento a otro salón | RD-04.3 / RD-04.5 | 8 | 4 | Responsable de Eventos |
| HU-19 | Reutilizar la configuración de un evento anterior | RD-04.4 | 8 | 3 | Responsable de Eventos |
| HU-20 | Registrar un evento como pagado | RD-04.6 | 5 | 4 | Responsable de Finanzas |
| HU-44 | Registrar un evento cancelado | RD-04.7 | 5 | 3 | Responsable de Eventos |
| HU-50 | Reservar un evento de varios días | — | a estimar | a definir | Responsable de Eventos |

**HU-50.** Un evento abarca varios días consecutivos, cada uno con su horario, jornada, salones,
servicios y cantidad de personas; el salón se cobra según la jornada de cada día. El solapamiento
(RN-12) se controla por día y por salón, sale una comanda por día, y todo va en un solo presupuesto
con una sola seña. Cambia el modelo del evento. Es grande: hay que estimarla en la Planning.

**Definición del PO (12/11/2026).** Reglas en `dominio.md`, «Evento de varios días».

Como Responsable de Eventos y como Cliente, quiero reservar un evento que dure varios días
consecutivos, para cotizarlo, señarlo y organizarlo como un solo evento.

Criterios (decisiones del PO, 12/11/2026, salvo lo marcado como propuesto):

- **Días consecutivos, hasta 32.** El evento tiene de 1 a 32 días corridos seguidos, **contando el
  de inicio y el de fin**, sin días libres en el medio. El tope se mide **en cantidad de días, no
  en meses del calendario**: una franja puede empezar a fin de un mes y terminar a fin del
  siguiente. El PO estima que lo habitual son una o dos semanas y pone el tope en un mes, fijado en
  **32 días** para que entre una franja de fin de mes a fin del mes siguiente (del 30/04 al 31/05):
  «mejor que sobre y no que falte».
- **Cada día se configura por separado.** Cada día tiene su fecha, su horario de inicio y fin, su
  jornada (media o completa), sus salones con su distribución, su cantidad de personas y sus
  servicios, y los de un día pueden ser distintos de los de otro. **Los servicios y los adicionales
  escritos a mano pertenecen a un día**: no se cargan una vez para toda la franja. Uno que se repite
  todos los días se carga en cada día.
- **Precio por día.** El salón de cada día se cobra con el precio de media jornada o de jornada
  completa según la jornada de ese día. Los servicios de un día se cotizan con la cantidad de
  personas de ese día.
- **Un solo presupuesto, un solo total, una sola seña.** El total suma todos los días. La seña es el
  20% de la base de cobro de ese total (RN-01), no de cada día; el evento pasa a `Reservado` al
  llegar a ese 20% y a `Cobrado` al llegar al 100%, como hoy.
- **Solapamiento por día y por salón (RN-12).** Un salón puede estar reservado un día por un evento
  y el día siguiente por otro. Cada día se controla por separado, con el mismo borde de siempre: un
  evento que termina a las 18:00 y otro que empieza a las 18:00 no chocan.
- **Agenda.** El evento se muestra como **una sola barra larga**, del inicio del primer día al fin
  del último, igual que hoy un evento que termina después de la medianoche.
- **Comanda.** Sale **una por día**, con los salones, el horario, las personas y los servicios de
  gastronomía de ese día.
- **Cancelación (RN-07).** Se cancela **el evento entero**, no un día suelto. Propuesto: las 48
  horas se cuentan desde el inicio del **primer** día.
- **Selección de la franja: día de inicio y día de fin** (PO, 12/11/2026). Es la misma pantalla
  para el cotizador, la consulta social y el panel:
  - **Un clic** elige el día de inicio. Si no hay un segundo clic, el evento dura **un solo día**.
  - **Un segundo clic** elige el día de fin: el calendario **conecta** los dos días y resalta la
    franja entera. El segundo clic en el mismo día también deja un solo día.
  - Mientras se elige, el calendario permite **cambiar de mes** entre los dos clics sin perder el
    día de inicio, porque la franja puede cruzar el fin de un mes.
  - Con el día de inicio elegido, los días que harían pasar el evento de los 32 días **quedan
    deshabilitados** y se avisa por qué («El evento puede durar hasta 32 días»). No hace falta
    llegar a equivocarse para enterarse del tope.
  - Un segundo clic en un día **anterior** al de inicio lo toma como nuevo inicio, y un tercer
    clic empieza una elección nueva (confirmado por el PO, 12/11/2026).
  - La API vuelve a validar el tope y rechaza una franja de más de 32 días, sin depender de la
    pantalla.
- **Cambiar la franja.** No se suma ni se corta un día suelto: se **cambia la fecha** con el mismo
  selector y la franja se extiende o se achica. Cada día se identifica por su fecha: mover la
  franja entera los corre a todos; cambiar solo el día de inicio o el de fin suma o saca días en
  ese extremo. No se puede sacar un día del medio, porque la franja tiene que seguir siendo
  consecutiva. Un día nuevo entra sin salones ni servicios hasta que se lo configura (propuesto).
- **Cuándo se puede cambiar la franja.** Con las mismas políticas de estado que hoy rigen el cambio
  de fecha de un evento (RN-09 y `modificarPresupuesto`); ver la tabla de abajo.
- **Repetir evento.** Repetir un evento de varios días copia la misma franja: la misma cantidad de
  días consecutivos y la configuración de cada día. El cliente elige la fecha de inicio.
- **Recálculo por cambio de fecha (HU-54).** Al cambiar la fecha o la franja, el incremento de
  RN-13 es el que corresponde al **último día** de la franja, y se aplica a todo el presupuesto.
- **Eventos existentes.** Los que ya están cargados son de un solo día y siguen igual. Solo los
  eventos nuevos pueden durar varios días.
- **Cotizador (evento corporativo).** El cliente elige la fecha de inicio y cuántos días dura el
  evento, y configura cada día. El presupuesto estimado y el PDF muestran el detalle por día y un
  único total.
- **Consulta social.** También se define con una franja de fechas (inicio y fin), porque el cliente
  elige las fechas. Sigue sin salón ni servicios (ADR 0008): el Responsable de Eventos arma el
  detalle de cada día al armar el presupuesto.

**Casos de prueba de la validación del tope.** Los días se cuentan como fechas del calendario
(`AAAA-MM-DD`, sin horas ni zona), contando el de inicio y el de fin, así que el cambio de mes, el
año bisiesto y el cambio de año no pueden correr la cuenta:

| Inicio | Fin | Días | Resultado |
|---|---|---|---|
| 15/05 | 15/05 | 1 | Permitido: un solo día (sin segundo clic o con el mismo día). |
| 28/04 | 28/05 | 31 | **Permitido**: cruza de abril a mayo. |
| 30/04 | 30/05 | 31 | **Permitido**: empieza a fin de abril y termina a fin de mayo. |
| 30/04 | 31/05 | 32 | **Permitido**: de fin de abril a fin de mayo, justo en el tope. |
| 30/04 | 01/06 | 33 | Rechazado: un día más que el tope. |
| 01/05 | 31/05 | 31 | Permitido: un mes completo. |
| 01/03 | 31/03 | 31 | Permitido. |
| 01/02 | 29/02 (año bisiesto) | 29 | Permitido: no se corta en el fin de febrero. |
| 20/12 | 19/01 (año siguiente) | 31 | Permitido: cruza el año. |
| 20/12 | 20/01 (año siguiente) | 32 | Permitido: cruza el año, justo en el tope. |
| 20/12 | 21/01 (año siguiente) | 33 | Rechazado. |
| 10/05 | 09/05 | — | Un día de fin anterior al de inicio no es una franja: se toma como nuevo inicio (confirmado por el PO). |

El caso que el PO pidió cuidar es el de las filas 2, 3 y 4: **el tope no puede bloquear una franja
que empieza a fin de mes y termina a fin del mes siguiente**. Por eso el tope es de 32 días y no de
31: del 30/04 al 31/05 son 32 días.

**Cambio de fecha o de franja según el estado, contrastado con las políticas de hoy.** Hoy se puede
modificar una consulta (también la fecha) con el presupuesto `Estimado` o `Expirado` y el evento
`EnConsulta`, o con el presupuesto `Confirmado` y el evento `Reservado` o `Cobrado`; cualquier otro
caso es un 409 (RN-09, `modificarPresupuesto`). Con varios días rige lo mismo:

| Evento / presupuesto | Hoy, cambio de fecha | Con varios días, cambio de franja |
|---|---|---|
| `EnConsulta`, presupuesto `Estimado` o `Expirado` | Permitido. Recalcula, reinicia la vigencia y un `Expirado` vuelve a `Estimado`. | Igual: se puede mover, extender o achicar la franja. |
| `Reservado`, presupuesto `Confirmado` | Permitido, con el salón libre en la fecha nueva (RN-12). Recalcula, reinicia la vigencia y corre el horario. | Igual, y cada día que se suma necesita su salón libre. Todo día de un evento `Reservado` necesita al menos un salón (propuesto, como hoy el evento). |
| `Cobrado` | Permitido. El evento vuelve a `Reservado` si lo pagado ya no cubre el total nuevo. | Igual: extender la franja sube el total y puede devolverlo a `Reservado`. Achicarla lo baja y, si lo pagado supera el total, queda saldo negativo (decisión de Franco, 08/10/2026). |
| `Cancelado` | Bloqueado (409): liberó el salón y no vuelve atrás. | Igual. |
| El cliente, en el canal público | Hasta 7 días antes de la fecha del evento (RN-09); el personal, sin límite. | Hasta 7 días antes del **primer** día (propuesto). El personal, sin límite. |

**Preguntas abiertas** (supuestos propuestos, a confirmar con el PO antes de estimar):

1. **Extender un evento confirmado.** Si se suma un día al final, el último día cambia y, con la
   regla de «incremento del último día», **cambian los precios de todo el presupuesto**, también los
   de los días que ya estaban señados. Es coherente con HU-54 (un cambio de fecha recalcula aun un
   `Confirmado`), pero conviene que el PO lo confirme explícitamente.
2. **Horario en la consulta social.** El cliente carga hoy una hora estimada de inicio y de fin.
   Con varios días, propuesto: se piden una sola vez y valen para cada día; el Responsable de
   Eventos las ajusta por día al armar el presupuesto.
3. **Plazo del cliente (RN-09).** Propuesto: los 7 días se cuentan desde el primer día del evento.
4. **Día nuevo.** Propuesto: entra vacío, con un atajo opcional «copiar el día anterior» para no
   cargar a mano los salones y servicios de una semana entera.

**Impacto técnico (para estimar).** Hoy `Evento` tiene una sola fecha, un horario y una jornada, y
sus salones comparten ese horario (ADR 0011); el no solapamiento lo garantiza una restricción de la
base sobre un rango horario por salón, mantenida por triggers. HU-50 pide una entidad nueva, por
ejemplo un «día del evento», que lleve horario, jornada, salones y personas, y que el horario y el
rango de la agenda del evento se deriven de sus días. Toca:

- el modelo y la restricción de no solapamiento (cambio de `schema.prisma` y migración de los
  eventos existentes, que pasan a tener un único día);
- el cotizador, el presupuesto (cada línea pertenece a un día), el cálculo de la seña y los recargos;
- la agenda y el detalle del evento, la comanda y el PDF del presupuesto;
- un **selector de rango de fechas** (clic de inicio y clic de fin) sobre el calendario propio de
  `SelectorFechaHora.tsx`, sin dependencia nueva, para reemplazar el selector de un solo día en el
  cotizador, la consulta social y el panel;
- la validación del tope de 32 días como regla compartida en `packages/shared` (la usan la pantalla
  y la API), con los casos de la tabla de arriba como tests;
- Repetir evento y el recálculo por cambio de fecha (HU-54);
- los esquemas de `packages/shared`, la auditoría y los tests.

Para la Planning se propone **partirla en historias** que se puedan entregar por separado: (a) modelo
y solapamiento por día, (b) cotizador y presupuesto por día, (c) agenda y comanda por día, (d)
Repetir evento y recálculo. Sin puntos hasta la Planning Poker.

## EPIC-06 — Gestión de Pagos de Clientes de los Eventos

RG-11. Gestionar los pagos y cobros de los eventos.  ·  2 historias  ·  21 pts  ·  Alta

| HU | Título | RD | Pts | Sprint | Actor |
|---|---|---|---|---|---|
| HU-40 | Registrar el pago de un evento | RD-11.1 | 13 | 2 | Responsable de Finanzas |
| HU-41 | Consultar el estado de cuenta de un evento | RD-11.1 | 8 | 3 | Responsable de Finanzas |

**Pendiente de HU propia** (mencionadas en el Story Map de Seguimiento del Proyecto, sin HU/RD/puntos en la Definición del Producto): *Consultar pagos de un evento*, *Generar y emitir un recibo como comprobante válido de pago*. La Definición del Producto sugiere que podrían estar ya cubiertas por HU-41 y HU-11 respectivamente — a confirmar con el equipo. **El recibo se eliminó (PO, 06/11/2026):** era HU-36 del Sprint 4 y no se construye.

## EPIC-07 — Notificaciones y Alertas

RG-06. Gestionar las notificaciones y alertas del sistema.  ·  2 historias  ·  13 pts  ·  Baja

| HU | Título | RD | Pts | Sprint | Actor |
|---|---|---|---|---|---|
| HU-23 | Notificar el próximo vencimiento de un pago | RD-06.1 | 8 | 6 | Responsable de Finanzas |
| HU-24 | Avisar por WhatsApp la recepción de la consulta y descargar su resumen en PDF | RD-06.2 | 5 | 5 | Responsable de Eventos |

**HU-24.** Desde el detalle de la consulta, un botón abre `wa.me` con el teléfono del cliente y un mensaje prearmado (consulta recibida, próximo contacto). No envía el presupuesto. Otro botón descarga el resumen en PDF (pdfmake) para que el Responsable de Eventos lo envíe a mano.

## EPIC-08 — Auditoría de Cambios

RG-07. Administrar la auditoría de cambios del sistema.  ·  1 historia  ·  8 pts  ·  Baja

| HU | Título | RD | Pts | Sprint | Actor |
|---|---|---|---|---|---|
| HU-25 | Registrar el usuario y la fecha de cada modificación | RD-07.1 | 8 | 5 | Sistema |

## EPIC-09 — Gestión de Medios de Pago

RG-10. Gestionar medios de pago.  ·  4 historias  ·  7 pts  ·  Media

| HU | Título | RD | Pts | Sprint | Actor |
|---|---|---|---|---|---|
| HU-36 | Registrar un medio de pago | RD-10.1 | 2 | 3 | Responsable de Finanzas |
| HU-37 | Consultar los medios de pago | RD-10.4 | 1 | 3 | Responsable de Finanzas |
| HU-38 | Modificar un medio de pago | RD-10.2 | 2 | 4 | Responsable de Finanzas |
| HU-39 | Dar de baja un medio de pago | RD-10.3 | 2 | 6 | Responsable de Finanzas |

## EPIC-10 — Gestión de la Landing Page

RG-12. Gestionar información de la landing page.  ·  2 historias  ·  6 pts\*  ·  Alta

| HU | Título | RD | Pts | Sprint | Actor |
|---|---|---|---|---|---|
| HU-46 | Consultar información de salones en la landing page | RD-12.1 | 3\* | 1\* | Cliente |
| HU-47 | Registrar y actualizar la información de salones publicada en la landing page | RD-12.2 | 3\* | 1\* | Responsable de Eventos |

\* La Definición del Producto v0.3 marca estos dos valores como pendientes de Planning Poker; los puntos y el sprint que se muestran acá son los que el equipo ya usó de hecho en el documento de Sprint 1.

## EPIC-11 — Reportes e Indicadores

RG-05. Gestionar reportes e indicadores del negocio.  ·  2 historias  ·  13 pts  ·  Baja

| HU | Título | RD | Pts | Sprint | Actor |
|---|---|---|---|---|---|
| HU-21 | Generar el reporte de ingresos | RD-05.1 | 8 | 6 | Gerente General |
| HU-22 | Generar el reporte de servicios contratados | RD-05.2 | 5 | 4 | Gerente General |

## EPIC-12 — Administración de Accesos al Sistema

RG-08. Administrar los accesos al sistema.  ·  7 historias  ·  18 pts + HU-48 y HU-56 sin estimar  ·  Media

| HU | Título | RD | Pts | Sprint | Actor |
|---|---|---|---|---|---|
| HU-27 | Autenticar a un usuario según su rol | RD-08.1 | 8 | 1 | Responsable de Eventos |
| HU-28 | Registrar un usuario | RD-08.2 | 3 | 4 | Gerente General |
| HU-29 | Consultar usuarios | RD-08.3 | 2 | 4 | Gerente General |
| HU-30 | Modificar un usuario | RD-08.5 | 3 | 5 | Gerente General |
| HU-31 | Dar de baja un usuario | RD-08.4 | 2 | 5 | Gerente General |
| HU-48 | Registrarse como cliente en el canal público | — | a estimar | a definir | Cliente |
| HU-56 | Restringir el panel interno según el rol | — | a estimar | a definir | Gerente General |

**HU-28 a HU-31** (alcance actualizado el 05/11/2026). Se gestionan desde la sección **Personal**
de Configuración de negocio, que usan solo el GG y el ADM. Listan solo al personal; registrar
incluye la contraseña inicial, que carga el GG o el ADM; un usuario tiene un solo rol; el GG asigna
GG, RE y RF y el ADM cualquiera; siempre queda al menos un GG y un ADM activos; el GG no toca a un
ADM ni se quitan el rol entre sí. Dar de baja es **baja lógica** (activo / inactivo, reactivable),
que cambia el modelo de `Usuario`.

**HU-56.** Cada rol ve en Configuración de negocio solo lo suyo: el RE, Salones y Servicios y
precios; el RF, lo mismo más Medios de pago; el GG, todo menos el contenido de la landing (solo sus
fotos); el ADM, todo. Fuera de la configuración los cuatro ven todo el panel, y la auditoría la ven
el GG y el ADM. La API rechaza con `403` lo que el rol no puede hacer. Reemplaza la decisión
provisoria del PO del 06/10/2026.

**HU-48.** Desde la landing, el cliente se registra con nombre, apellido, correo, contraseña y teléfono (autorregistro abierto, sin aprobación) y después inicia sesión. Se crean `Usuario` con rol `CLIENTE` y su `Cliente`. Correo duplicado se rechaza. Con sesión ve precios; sin sesión, la landing nunca los muestra. `dominio.md` lo planifica para el Sprint 2.

**Pendiente de HU propia** (mencionadas en el Story Map de Seguimiento del Proyecto, sin HU/RD/puntos en la Definición del Producto): *Cerrar sesión*, *Cambiar contraseña*. La Definición del Producto sugiere que podrían estar ya cubiertas por el criterio 5 de HU-27 (cierre de sesión) y el criterio 3 de HU-30 (restablecer contraseña) — a confirmar con el equipo.

## Distribución por sprint

| Sprint | Historias | Pts |
|---|---|---|
| 1 | HU-01 · HU-09 · HU-14 · HU-15 · HU-27 · HU-32 · HU-46\* · HU-47\* | 53\* |
| 2 | HU-04 · HU-10 · HU-11 · HU-12 · HU-13 · HU-17 · HU-40 | 48 |
| 3 | HU-05 · HU-06 · HU-07 · HU-45 · HU-19 · HU-44 · HU-36 · HU-37 · HU-41 | 36 |
| 4 | HU-02 · HU-03 · HU-16 · HU-18 · HU-20 · HU-22 · HU-28 · HU-29 · HU-33 · HU-38 · HU-53 | 41 + HU-53 |
| 5 | HU-43 · HU-24 · HU-25 · HU-30 · HU-31 · HU-34 · HU-55 | 34 + HU-55 |
| 6 | HU-21 · HU-23 · HU-35 · HU-39 | 20 |
| a definir | HU-48 · HU-49 · HU-50 · HU-51 · HU-52 · HU-54 · HU-56 | sin estimar |

Los puntos son los del backlog general (con HU-46 y HU-47 marcadas \*, ver nota de EPIC-10). Cada Sprint Planning re-estima según el alcance real: el Sprint 1 se cerró en 8 historias y 31 puntos tras re-estimar HU-27, HU-32, HU-01 y HU-09 a la baja (ver el documento de Sprint 1, que usa numeración local HU-01 a HU-08 para este subconjunto).

## Historias consolidadas

Dos historias de la versión anterior del backlog no figuran por separado; su alcance está
cubierto como criterios de aceptación:

- **HU-26** Consultar el registro de auditoría → criterio 5 de HU-25.
- **HU-42** Confirmar la reserva mediante el registro de la seña → criterio 4 de HU-15 y criterio 3 de HU-40.

Los códigos HU-26 y HU-42 no se reasignan. Por el mismo motivo, HU-46 y HU-47 (EPIC-10) continúan la numeración existente en lugar de insertarse en un rango intermedio.

Además de estas dos, hay 4 títulos que aparecen en el Story Map de Seguimiento del Proyecto sin HU propia en la Definición del Producto (ver notas de EPIC-06 y EPIC-12 más arriba); a diferencia de HU-26/HU-42, esa consolidación no está documentada explícitamente en ningún lado — es una observación de esta corrección, pendiente de que el equipo la confirme.

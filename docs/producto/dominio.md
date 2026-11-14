# Dominio — Confluens

Vocabulario, estados y reglas del negocio de Los Abuelos Servicios Gastronómicos.
Todo nombre de entidad, campo, enum y endpoint tiene que corresponderse con este archivo.

Fuentes: Plan de Proyecto, Seguimiento del Proyecto, Sprint 1 y máquina de estados (drawio),
todos aprobados por la cátedra, más la **entrevista con el Responsable de Eventos del 24/09/2026**,
que redefinió el canal público, la vigencia del presupuesto, el IVA y la política de precios, y la
**reunión con el cliente del 05/11/2026** (validada por el PO el 06/11/2026), que cambió los roles,
la factura, el saldo, el recálculo, el incremento de precios y los eventos de varios días.
Donde este archivo contradiga a un documento anterior, vale este archivo.

**Decidido, todavía sin construir.** Las reglas de la reunión del 05/11/2026 que el código todavía
no cumple llevan la marca **«Reunión 05/11/2026 → HU-xx»** con la historia del backlog que las
implementa, y dicen cómo funciona el sistema hasta entonces. No «corregir» el código por una regla
con esa marca fuera de su historia.

---

## Estados

Los nombres de estos estados son los de la máquina de estados aprobada. **Se usan literalmente
como valores de enum en Prisma.** No inventar sinónimos ni traducir.

### Evento

```
Inicio ──primer contacto──> EnConsulta ──registrarPago()──> Reservado ──registrarPago()──> Cobrado
                                          [acumulado ≥ 20%]              [acumulado = 100%]
```

| Estado | Significado |
|---|---|
| `EnConsulta` | Primer contacto. Hay cliente, fecha deseada y cantidad estimada. **No bloquea el salón**: puede haber varios eventos `EnConsulta` en el mismo salón, fecha y horario. |
| `Reservado` | Se acreditó la seña (20% del total). El salón queda tomado en la agenda. **El cliente lo llama "confirmado"**: en pantallas internas y comunicaciones al cliente se puede mostrar la etiqueta "Confirmado", pero el valor del enum sigue siendo `Reservado`. |
| `Cobrado` | Los pagos acumulados cubren el 100% del total. |
| `Cancelado` | Salida posible desde `EnConsulta` y desde `Reservado`, vía `cancelar()`. **Siempre manual**: la decide el Responsable de Eventos. |

Un evento `Reservado` **sigue siendo modificable** (fecha, horario, salón, servicios,
asistentes). Si se reprograma, el horario anterior queda libre en ese mismo momento. Las
restricciones de quién puede modificar y hasta cuándo están en RN-09.

**No hay cancelación automática.** Que venza el presupuesto no cancela el evento (ver RN-06 y
RN-08).

### Presupuesto

```
Estimado ──confirmar()──> Confirmado
    │
    ├──cancelar()──> Cancelado
    └──controlarVigencia()──> Expirado ──modificar()──> Estimado
                                  │
                                  ├──confirmar()──> Confirmado
                                  └──cancelar()──> Cancelado
```

`Expirado ──confirmar()──> Confirmado` es nueva (reunión 05/11/2026, ver RN-06): la seña se cobra
aunque el presupuesto esté vencido, sin recalcularlo. Construido con HU-55 (Sprint 5).

| Estado | Significado |
|---|---|
| `Estimado` | Recién generado. Editable. Vigente durante 10 días desde su emisión o su última modificación (RN-08). |
| `Confirmado` | Se abonó la seña, esté vigente o vencido el presupuesto (RN-06). **La seña congela el presupuesto**: sus precios ya no cambian aunque suba el tarifario o cambie el porcentaje de incremento. Solo los mueve un cambio de fecha del evento (ver «Recálculo automático»). Bloqueado para edición por el cliente. |
| `Cancelado` | Dado de baja sin confirmarse. Solo manual. |
| `Expirado` | Pasaron 10 días sin seña. **No se borra ni cancela nada**: el presupuesto queda visible, marcado con un aviso de que está vencido. Se puede modificar (vuelve a `Estimado`), confirmar con la seña o dar de baja. |

**Recálculo automático** (reunión 05/11/2026). **No hay botón Recalcular: el sistema recalcula
solo**, siempre sobre **ese mismo** presupuesto, en dos casos:
- **Cambia la fecha del evento** (la cambie el cliente o el Responsable de Eventos): se toman los
  precios de la fecha nueva, proyectados con RN-13. Por ejemplo, de enero a febrero se aplica el
  porcentaje de febrero. Vale **en cualquier estado**, también con el presupuesto `Confirmado`: con
  otra fecha no tiene sentido que los precios queden congelados. **Reinicia la vigencia** de 10 días
  como cualquier modificación (RN-08), así que un `Expirado` vuelve a `Estimado` y su aviso
  desaparece.
- **Cambia el porcentaje de incremento** (o un tramo, RN-10): se recalculan **solo los presupuestos
  `Estimado` de eventos `EnConsulta`**. Los `Confirmado` quedan congelados y los `Expirado` esperan a
  que se les cambie la fecha, para no calcular de más. **No reinicia la vigencia**: es un recálculo
  masivo que nadie le comunica al cliente.

Si el recálculo cambia el total de un evento con pagos, valen las reglas de siempre: si lo pagado
no cubre el total nuevo, un `Cobrado` vuelve a `Reservado` (como al modificar, HU-12 del Sprint 2);
si lo deja por debajo de lo pagado, vale «Saldo».

Construido con HU-54 (Sprint 5). En el detalle de la consulta, al elegir otra fecha, el salón y los
servicios propios del catálogo toman en el momento el precio vigente proyectado a la fecha nueva
(RN-13); los tercerizados y los adicionales escritos a mano no cambian. Volver a la fecha original
recupera los precios guardados. La pantalla marca cada precio que cambió con el anterior, muestra el
total antes y después, y al guardar pide confirmar los precios nuevos. Lo calcula la pantalla y la
API guarda los precios que recibe. **No hay botón Recalcular** (reunión 05/11/2026): sin cambio de
fecha no hay recálculo. Al cambiar el porcentaje, el recálculo masivo corre en la misma
transacción que lo guarda. **Un precio ajustado a mano (RN-03) en una línea del catálogo se pisa**
con el recálculo: el modelo no distingue un precio ajustado de uno tomado del catálogo.

Modificar un presupuesto `Expirado` también edita el mismo presupuesto, pero las líneas que no se
tocan conservan su precio; el evento sigue `EnConsulta` (decisiones del PO, 05/10/2026). **Cada
evento tiene un solo presupuesto** (decisión del PO, 06/10/2026), así que dar de baja una consulta
cancela también su evento.

**Presupuesto sin armar.** El de una consulta social recién llegada: `Estimado`, sin líneas, en 0 y
**sin vencimiento**. Los 10 días de RN-08 empiezan a correr cuando el Responsable de Eventos lo
guarda con el salón o algún servicio (decisión del PO, 07/10/2026, ADR 0008).

---

## Canal público (landing + cliente registrado)

Definido en la entrevista del 24/09/2026. Es el recorrido completo que hace el cliente:

1. **Landing sin sesión.** Muestra información de la organización, salones, distribuciones,
   servicios y fotos. **Nunca muestra precios** (ADR 0004).
2. **Registro / inicio de sesión.** Un botón de la landing lleva al registro. Datos: nombre,
   apellido, correo, contraseña y teléfono. **Autorregistro abierto**: sin aprobación previa del
   personal. No se pidió validación de correo; no se implementa salvo que se defina.
3. **Vista con precios.** El cliente registrado ve salones y servicios **con precio** y un
   formulario para armar su evento.
4. **Formulario con presupuesto dinámico.** Primero carga **sus datos y la fecha del evento**;
   recién entonces se muestran los precios, **proyectados a esa fecha** con el incremento mensual
   vigente (RN-10). Después elige salón, distribución, jornada, cantidad de personas, servicios
   (con modalidad continuo o en mesa cuando aplique, RN-11) y audiovisual. El presupuesto
   estimado se recalcula en pantalla con cada selección y muestra **subtotal sin IVA, IVA (21%) y
   total** (RN-05).

   **Social o corporativo (decisión del PO, 07/10/2026, ADR 0008).** El formulario pide primero el
   evento: fecha, cantidad de personas, media o jornada completa y una hora de inicio estimada
   (opcional). Después, el **tipo de evento**:
   - **Corporativo**: sigue el recorrido de arriba (salón según la cantidad de invitados,
     servicios y presupuesto estimado en vivo).
   - **Social**: el cliente elige qué celebra (cumpleaños, casamiento, fiesta de 15, bautismo,
     fiesta empresarial u otro, contando cuál) y manda la consulta. **No ve salones, servicios ni
     precios y no se genera presupuesto**: los eventos sociales son muy variables y el Responsable
     de Eventos lo arma con el cliente.
5. **Confirmación del cliente.** El cliente confirma el formulario: se crea la **Solicitud** con
   todo lo elegido y el sistema le **envía un correo** confirmando que la consulta fue recibida.
   Esto **no reserva nada**: es una consulta.
6. **Vista interna.** El Responsable de Eventos abre la consulta y ve los datos del cliente y el
   detalle elegido. Desde ahí:
   - un botón de **WhatsApp (`wa.me`)** abre el chat con el cliente con un mensaje prearmado que
     avisa que la consulta se recibió y que lo van a contactar. **Es solo un aviso**: no manda el
     presupuesto.
   - puede **descargar el resumen en PDF**, que envía él a mano al cliente.
7. A partir de ahí sigue el circuito interno: la consulta se convierte en evento `EnConsulta` con
   su presupuesto `Estimado`, y la seña lo pasa a `Reservado`.

---

## Entidades

**Salón.** Espacio físico del evento. Son cinco: Paraná, Iguazú, Pucará, Bariloche y Auditorio.
De ellos sale el nombre del producto. Tiene capacidad máxima, superficie y dos precios: jornada
completa y media jornada. Capacidades y precios reales en `../negocio/tarifario-2026.md`.

**Jornada.** **Media jornada: hasta 4 horas inclusive** (un alquiler de exactamente 4 horas es
media jornada). **Jornada completa: más de 4 horas.** Se deriva del horario del evento.

**Distribución.** Forma de armado de un salón con su propia capacidad: conferencia, mesas de
trabajo, banquete. Nombre único por salón. Su capacidad nunca supera la del salón. **Baja lógica**
(PO, 06/11/2026): se da de baja aunque la use un evento. Dada de baja no se ofrece al presupuestar
ni al agendar, ni se publica en la landing, pero los eventos que ya la tienen la conservan. Sigue
ocupando su nombre en el salón y se puede reactivar. Dar de baja o reactivar no pide confirmación,
porque se puede deshacer (PO, 06/11/2026).

**Cliente.** Persona u organización que contrata. Datos: nombre, apellido (o razón social),
teléfono y correo. **No hay baja por inactividad**: el cliente se conserva siempre con su
historial.

**Teléfono del cliente.** Es el canal de contacto principal (WhatsApp, `wa.me`), así que en el
registro tiene que ser un **celular válido** y se guarda en formato internacional E.164
(`+5493516123456`). El cliente elige el país en un selector (Argentina por defecto) y escribe solo
el número nacional (`3516167991`): el código del país y el 9 de los celulares argentinos los
agrega el sistema. También se aceptan el 0 y el 15 si el cliente los escribe. Verificar que el número exista con un proveedor (código por SMS o WhatsApp)
queda para una iteración futura. Decisión del equipo, 04/10/2026.

**Correo de la cuenta.** Se guarda en minúsculas y sin espacios: `Juan@Mail.com` y
`juan@mail.com` son la misma cuenta.

**Etiqueta del cliente.** Muchas empresas contratan eventos, pero la cuenta la crea un empleado con
su correo y su celular, así que el evento queda a nombre de esa persona. Para saber para qué empresa
es, el personal le puede poner al cliente una **etiqueta** (por ejemplo, "Empresa1"):
- Las etiquetas forman una **lista reutilizable**: varios clientes comparten la misma. El nombre es
  único **sin distinguir mayúsculas** ("empresa1" y "Empresa1" son la misma).
- Cada cliente tiene **como máximo una**, y es opcional.
- Se asigna desde el listado de clientes: se elige una existente o, si no está, **se crea al
  asignarla**. Renombrar y borrar etiquetas no está implementado.
- Se muestra junto al nombre del cliente en Consultas, la agenda, el calendario y el detalle del
  evento, y el filtro de cliente de Consultas también busca por ella.
- **Solo la ve el personal**: el cliente nunca la ve, ni en su perfil ni en el canal público.

Pedido del 09/10/2026; todavía sin HU en Jira.

**Olvidé mi contraseña.** El cliente y el personal pueden pedir un enlace por correo para elegir
una contraseña nueva. El enlace vence a los 30 minutos y sirve una sola vez. La respuesta es la
misma exista o no una cuenta con ese correo, para no revelar qué correos están registrados. Al
guardar la contraseña nueva queda la sesión iniciada.

**Es usuario del sistema**: para ver precios y armar un presupuesto en el canal público debe
registrarse e iniciar sesión (ver "Canal público"). Planificado para el Sprint 2.

**El personal no crea clientes.** El cliente se da de alta solo, registrándose en la landing;
ningún rol del personal carga clientes a mano. Decisión del equipo, 04/10/2026. Las fichas de
Cliente cargadas por el personal antes de esa decisión (al tomar consultas o generar presupuestos
en el Sprint 1) pueden no tener usuario: si esa persona se registra con el mismo correo, su cuenta
se vincula a la ficha existente en lugar de crear otra, y el teléfono pasa a ser el celular
validado del registro (C7 de HU-09 del Sprint 2).

**Datos de contacto del cliente.** El personal puede corregir **nombre, apellido y teléfono** de
cualquier cliente desde su ficha (por ejemplo, cuando avisa que cambió de celular). El **correo**
solo lo puede cambiar el personal si el cliente **no tiene cuenta**: en un cliente con cuenta el
correo es su usuario para iniciar sesión, y lo cambia él. Decisión del PO, 16/10/2026 (HU-17 del
Sprint 3; cierra S-15).

**Solicitud (consulta).** Lo que el cliente confirma desde el formulario del canal público. Llega
asociada al cliente que la envió y guarda **todo lo que eligió**: fecha, horario, salón,
distribución, cantidad de personas, servicios con su modalidad, y el presupuesto estimado que vio.
El Responsable de Eventos la toma y la convierte en un evento `EnConsulta` (con un presupuesto
`Estimado` armado con esas mismas líneas), o la descarta. Es una entidad distinta del evento:
puede descartarse sin convertirse en nada.

**Servicio.** Ítem del catálogo: nombre, descripción, unidad de medida y precio sin IVA. Puede
cobrarse por persona y contratarse para una cantidad menor a la de asistentes (RN-04).

**Servicio tercerizado.** Lo provee un tercero (hoy: el audiovisual de Mediterráneo Eventos y las
pantallas LED del Auditorio). **Se muestra con precio, el cliente lo puede seleccionar y entra en
el total del presupuesto** como cualquier otro servicio. Diferencias con un servicio propio:
- **no le aplica el incremento mensual automático**: su precio lo actualiza a mano el Responsable
  de Eventos, en general cada 6 meses;
- puede no tener precio fijo ("**a cotizar**"): se puede seleccionar, aparece en el presupuesto
  sin importe y con la leyenda "a cotizar", **no suma al total**, y el Responsable de Eventos
  completa el precio a mano después de averiguarlo con el proveedor.

**Modalidad de servicio.** Para los servicios que la admiten (hoy los coffee breaks), el cliente
elige la modalidad de cada uno: normal, **continuo en salón (+20%)** o **en mesas con mozo
(+30%)**. Ver RN-11. Se implementa en el Sprint 3 (decisión del PO, 16/10/2026): la elige el
cliente en el cotizador o el Responsable de Eventos al armar o modificar el presupuesto, y se copia
al reutilizar un evento. Mientras S-09 siga abierto, **una sola modalidad por servicio**.

**Hora esperada del servicio.** Cada servicio del presupuesto puede llevar **una hora opcional**
(`HH:mm`) que dice en qué momento del evento se lo espera: el coffee a las 10:30, el almuerzo a las
13:00. La carga el cliente en el cotizador, al elegir cada servicio, o el Responsable de Eventos al
armar o modificar el presupuesto, y también la pueden llevar los adicionales escritos a mano. El
salón no: su horario es el del evento. **Es una preferencia, no una obligación**: un servicio sin
hora es válido y no cambia nada del cálculo. Mientras el evento está `EnConsulta` todavía no tiene
horario cargado, así que se acepta cualquier hora; una vez **agendado** (con `inicio` y `fin`), una
hora fuera de esa franja se rechaza. Decisión del equipo, 08/10/2026.

**Eventos que terminan después de la medianoche** (PO, 07/11/2026). Un evento puede seguir pasada
la medianoche: lo que cae después de las 00:00 se toma como del **día siguiente**, y el evento
termina ese día. En esos eventos la hora esperada de un servicio **no se controla** contra la
franja, porque el rango da la vuelta: se acepta cualquier hora. Vale lo mismo que para el resto del
evento: el día del evento se lee en la hora de Córdoba (ADR 0010).

**Servicio propio de un evento** (reunión 05/11/2026). Un servicio que no está en el catálogo y
se agrega a un evento puntual, social o corporativo. **No se guarda en el catálogo** ni lo ve nadie
fuera de ese evento.
- Lo crea el personal (RE, RF, GG o ADM) desde el detalle del presupuesto. Es una **línea** con su
  precio y su cantidad, y **suma al total**. Se construye sobre los adicionales escritos a mano que
  ya existen.
- **Cada línea lleva su propia observación**, para saber a qué corresponde. Reemplaza a la caja de
  texto única del evento social, y en la observación no se escriben importes.
- Sale en el **PDF del presupuesto** y en la **comanda** (eso último puede cambiar más adelante).
- **Puede valer $0** (PO, 08/11/2026): una cortesía de la casa. Es una línea con precio —no «a
  cotizar»—, sale en el presupuesto y no suma al total. Vale para los adicionales escritos a mano, que
  son la base de esta funcionalidad.

**Reunión 05/11/2026 → HU-51.** Hasta entonces los adicionales no llevan observación propia.

**Presupuesto.** Valorización del evento, detallada línea por línea. Guarda los importes **sin
IVA** y se presenta con **subtotal sin IVA, IVA 21% y total**. Al emitirse congela los precios de
sus líneas, aunque después cambie el catálogo; solo los mueve el recálculo automático (ver
«Recálculo automático» en Estados). Lleva la leyenda **"Este presupuesto tiene una validez de 10
días"**.

**Requiere factura.** Marca del presupuesto que define la **base de cobro** (ver RN-01). **Por
ahora se elimina el caso sin factura** (reunión 05/11/2026): todo presupuesto nuevo nace con la
marca y se calcula con el 21% de IVA, y **no hay casilla** para cambiarla. Los presupuestos que ya
existían **conservan su marca**, con su base de cobro, su seña y su saldo, aunque después se
modifiquen o se recalculen. Si más adelante vuelve el caso sin factura, tiene que ser **explícito**
(por ejemplo, un campo que solo activa el ADM desde el panel, que se ve siempre ahí y no sale en el
PDF del cliente), nunca escondido bajo un servicio u otro dato. Construido con HU-53, que el PO
adelantó al cierre del Sprint 4 (06/11/2026).

**Base de cobro.** Importe contra el que se miden la seña, el saldo y el cierre del evento. Si el
presupuesto **requiere factura** es el **total con IVA**; si no, el **subtotal sin IVA** (total ÷
1,21, no el total menos el 21%). No se guarda: se calcula a partir del presupuesto y de su marca de
factura. Desde HU-53, la de todo presupuesto nuevo es el total con IVA.

**Varios salones.** Un evento puede realizarse en **más de un salón a la vez**, hasta los cinco:
se reparte la gente entre varios espacios según cómo convenga armarlos. Todos comparten el horario
del evento —la cantidad de salones no cambia cuándo empieza ni cuándo termina— y cada uno lleva su
propia distribución. La **capacidad de un salón no limita la elección**: es un dato que se informa,
no un tope, porque la misma cantidad de gente se reparte de maneras muy distintas. El no
solapamiento de RN-12 se mide por cada salón que el evento ocupa. Decisión del equipo, 09/10/2026.

**Evento.** Entidad central: cliente, tipo de evento, salón, distribución, fecha, horario,
cantidad de personas, servicios, presupuesto y pagos. El salón es obligatorio para reservar; una
consulta social puede estar `EnConsulta` sin salón hasta que el Responsable de Eventos lo carga
(ADR 0008). El personal puede modificarlo **aunque su fecha ya haya pasado** (por ejemplo, sumar un
servicio de último momento): ningún control bloquea un evento por su fecha, y el evento se cierra
por pago (`Cobrado`), nunca por fecha (reunión 05/11/2026).

**Evento de varios días** (reunión 05/11/2026; definido por el PO el 12/11/2026). Un evento se
puede reservar por varios **días consecutivos**, sin días libres en el medio:
- Cada día tiene **su propio horario, su jornada, sus salones, sus servicios y su cantidad de
  personas**. La jornada sale de cada día, así que el salón se cobra con el precio de media o de
  jornada completa según el día.
- El no solapamiento (RN-12) se controla **por día y por salón**.
- La comanda sale **una por día**.
- Todo va en **un solo presupuesto, un solo total y una sola seña**: el evento es uno solo, y la
  seña es el 20% de la base de cobro de ese total (RN-01), no de cada día. El estado del evento
  (`Reservado`, `Cobrado`) sigue siendo uno.
- En la **agenda** se muestra como **una sola barra larga**, del inicio del primer día al fin del
  último, como hoy se muestra un evento cuyo horario de fin pasa la medianoche.
- Los **servicios y los adicionales a mano pertenecen a un día**: no se cargan una vez para toda la
  franja, porque cada día puede tener otros salones, otra cantidad de personas y otros servicios.
- **Tope: 32 días corridos**, contando el de inicio y el de fin. Se mide en cantidad de días y no
  en meses del calendario: una franja puede empezar a fin de un mes y terminar a fin del siguiente
  (del 30/04 al 31/05 son 32 días y se puede; al 01/06 son 33 y no). El PO estima que lo habitual
  son una o dos semanas.
- Las fechas se eligen con **un clic en el día de inicio y otro en el día de fin**: sin el segundo
  clic el evento dura un solo día, y con los dos se conecta la franja.
- **Cancelar** cancela **el evento entero**, no un día suelto.
- **Cambiar un día** no existe como acción: se **cambia la fecha** y la franja se extiende o se
  achica. Se puede mientras el estado lo permita, con las mismas políticas que hoy rigen el cambio
  de fecha (RN-09): también con el evento `Reservado` o `Cobrado`, nunca `Cancelado`. No se puede
  sacar un día del medio.
- El **plazo de 7 días** del cliente para modificar (RN-09) se cuenta desde el **primer** día.
- Un **día nuevo** (al extender la franja) entra **vacío**: se puede copiar el día anterior o cargarlo
  de forma personalizada, y se puede explorar entre los días sin que la carga sea tosca.
- Aplica también a la **consulta social**, al definir las fechas: la hora estimada de inicio y de
  fin que carga el cliente vale para todos los días, y el Responsable de Eventos detalla después
  cada uno.
- El **último día** de la franja es siempre la referencia del incremento de precios, también al
  extender un evento: los precios de todo el presupuesto se muestran para esa fecha.
- **Repetir un evento** de varios días cubre **la misma franja**: la misma cantidad de días
  consecutivos, con la configuración de cada día. La fecha de inicio la elige el cliente.
- El **recálculo por cambio de fecha** toma el incremento (RN-13) que corresponde al **último día**
  de la franja, y lo aplica a todo el presupuesto.
- Los eventos que ya existen son de un solo día y no cambian. Los **eventos nuevos** pueden durar
  varios días.

Cambia el modelo del evento. **Reunión 05/11/2026 → HU-50**: definida por el PO el 12/11/2026,
falta estimarla y resolver las preguntas abiertas de `backlog.md`. Hasta que se construya, un evento
ocupa un solo día.

**Pago.** Importe recibido con fecha y medio de pago. Monto libre, sin mínimo. Un pago que excede
el saldo se rechaza: un pago nunca genera saldo a favor.
- **Tope por pago: $500.000.000** (PO, 08/11/2026; antes era de 100 millones y lo subió «por las
  dudas»). No es una regla del negocio sino una red de seguridad contra un cero de más al tipear.
- **La fecha del pago no tiene límite** (PO, 07/11/2026): se puede cargar un pago de cualquier día,
  anterior o posterior a hoy. Solo tiene que ser una fecha real.

**Saldo.** Base de cobro menos la suma de los pagos registrados, **nunca negativo**. Si un cambio
baja el total por debajo de lo pagado (quitar un servicio, bajar la cantidad de personas, quitar un
salón; por ejemplo, el cliente quita un servicio que ya pagó), el sistema muestra antes un
**cartel** que avisa la situación y pregunta si se sigue con el cambio o se cancela. Si se confirma:
- el saldo queda en **$0**;
- lo pagado de más se registra aparte como **no reintegrable**: se muestra en la cuenta del evento a
  modo informativo y no se descuenta de nada;
- lo que se agregue después se suma desde $0 y el cliente lo paga completo.

Lo pagado de más **no se devuelve ni queda como crédito**: si el cliente pagó de más es porque lo
pidió, y concuerda con la cláusula g) de las condiciones de contratación («el monto de la reserva no
será reintegrado»). El sistema no compensa nada por su cuenta; trasladar un pago a otro evento del
mismo cliente lo hace el personal a mano (ver «Pasar un pago a otro evento»). Reemplaza el saldo a
favor del cliente que había decidido el PO el 16/10/2026. **Reunión 05/11/2026 → HU-52** (cambia el
modelo). Hasta entonces el saldo puede quedar negativo y se muestra como saldo a favor.

**Pasar un pago a otro evento.** Caso poco frecuente: el cliente pagó un servicio que no usó y se
lo pasa a otro evento **suyo**. Se hace a mano: se **anula** el pago en el evento original (HU-35
del Sprint 4) y se registra en el otro. No hay una acción de «transferir». Si el evento original
queda por debajo de la seña, **sigue `Reservado`** y el sistema avisa que lo pagado no cubre la
seña: no hay transición `Reservado → EnConsulta`. Si estaba `Cobrado` y lo pagado queda por debajo
del total, **vuelve a `Reservado`** hasta cobrar la diferencia, como al modificar el presupuesto
(reunión 05/11/2026; PO, 06/11/2026). La misma anulación sirve para corregir un pago registrado con un error, por ejemplo en su observación: se anula y se
registra de nuevo. La anulación guarda la fecha y el usuario que anuló, sin motivo, y la puede hacer
cualquier rol del personal (PO, 06/11/2026). El pago anulado sigue en la cuenta del evento, marcado,
y no suma a lo pagado. En un evento `Cancelado` no se anulan pagos, igual que no se registran: su
cuenta queda como estaba al cancelarse (PO, 06/11/2026).

**Medio de pago.** El catálogo inicial es Efectivo, Transferencia, Débito, Crédito, Cheque y A la
habitación. El Responsable de Finanzas puede dar de alta otros. Baja lógica: un medio dado de baja
se sigue viendo en los pagos ya registrados. **Todos los medios activos se pueden usar en todos los
cobros** (RN-14, reunión 05/11/2026): deja de elegirse si un medio va con factura, sin factura o en
los dos casos. Construido con HU-53: las marcas de habilitación de cada medio siguen en la base,
sin uso.

**Auditoría.** Registro inmutable de usuario, fecha, entidad, valor anterior y valor nuevo, solo
de los campos que cambiaron. Nadie lo edita ni lo borra (la base lo rechaza). Se audita todo el panel
interno; lo que hace el cliente desde el canal público no (PO, 07/11/2026). Lo que hace el Sistema
(tareas programadas, el recálculo por el incremento) queda con usuario vacío. Se escribe en la misma
transacción que el cambio, con un helper común sobre `audit_log` (HU-25 del backlog, ADR 0013).

**Solapamiento.** Dos eventos **`Reservado` o `Cobrado`** en el mismo salón, fecha y horario.
Prohibido. Se valida en la aplicación **y** con una restricción de exclusión de PostgreSQL
usando `btree_gist`. Los eventos `EnConsulta` no cuentan: pueden coincidir entre sí y con un
evento reservado (ver RN-12).

**Tipo de evento.** Social o corporativo (decisión del PO, 07/10/2026; antes se llamaba
"empresarial"). El social se clasifica en cumpleaños, casamiento, fiesta de 15, bautismo, fiesta
empresarial u otro (con una descripción de cuál). Las consultas corporativas pasan por el cotizador;
las sociales llegan **sin salón y con el presupuesto sin armar**: el Responsable de Eventos carga
salón, servicios y precios desde la consulta. Las dos se distinguen por color en el panel, se
modifican igual y se confirman igual, con la seña del 20% (ADR 0008). Los datos propios de un evento
social todavía no están definidos (ver `pendientes.md`). Se usa también en el reporte de ingresos
(HU-21).

**Comanda de cocina.** La hoja que el personal imprime y cuelga en la cocina para un evento ya
confirmado. No es una entidad: es una vista del evento y de su presupuesto con fecha, salón,
armado, horario, cantidad de personas, nombre del cliente y los servicios de gastronomía ordenados
por la hora a la que se los espera. **Nunca lleva precios**: no es un documento comercial. Admite
**observaciones** (`Evento.observacionesComanda`): notas internas del personal —menús especiales,
alergias, a quién buscar en el salón— que salen solo en esa hoja y que el cliente nunca ve. No
entran la línea del salón, cuyo horario ya encabeza la hoja, ni los servicios tercerizados, que son
audiovisual y pantallas y no pasan por cocina. Integrarse con el sistema de cocina o con los de los
proveedores sigue fuera de alcance (S-07). Decisión del equipo, 09/10/2026. Lleva también los
servicios propios del evento con su observación (HU-51), y un evento de varios días tiene **una
comanda por día** (HU-50).

**Observaciones del evento.** Texto libre (`EventoDia.observaciones`, hasta 2000 caracteres) para dejar anotado lo que el personal quiere tener presente de un evento: pedidos del cliente, acuerdos, avisos al equipo. **Son de cada día:** un evento de varios días tiene las suyas en cada uno, porque cada día puede tener una observación distinta (decisión del PO, 13/11/2026); un evento de un solo día tiene un solo texto, como antes. Son **internas**: no salen en el presupuesto ni en la comanda y el cliente nunca las ve. No son las observaciones de la comanda (`observacionesComanda`), que son las notas operativas de cocina y salen solo en esa hoja. Las edita cualquier rol del personal, en cualquier estado salvo `Cancelado`, donde quedan de solo lectura. Decisión del PO, 12/11/2026.

**Comedor.** Servicio gastronómico del hotel, con sistema propio. Fuera de alcance (EXC-04).

---

## Roles

| Rol | Código | Alcance |
|---|---|---|
| Responsable de Eventos | `RE` | Ve todo el panel interno. Consulta, presupuesto, agenda y reserva. **También administra los precios**: porcentaje de incremento, ajustes por servicio, precios de los tercerizados y precios de los salones. En Configuración de negocio solo accede a Salones y a Servicios y precios. Mayor uso diario. En las entrevistas es "Fran". |
| Responsable de Finanzas | `RF` | Cobros, medios de pago, seguimiento de deuda. **Por ahora ve y hace lo mismo que el RE, más Medios de pago**, porque todavía no tiene sus módulos definidos. |
| Gerente General | `GG` | Ve y hace todo, incluidos los reportes y la auditoría. Administra al personal desde **Personal**. **También registra pagos**, igual que el RE y el RF (HU-14 del Sprint 2). |
| Administrador del Sistema | `ADM` | A la par del Gerente General: ve y hace todo, incluida Personal. Además es el **único que modifica el contenido de la landing** (qué salones se publican y sus textos); las fotos las cambia también el GG. |
| Sistema | `SYS` | Actor no humano: tareas programadas, cálculos, auditoría, envío de correos. |
| Cliente | `CLI` | Externo a la organización, con credenciales propias. Solo el canal público: ve precios, arma y confirma consultas, consulta las suyas. Nunca accede al panel interno. Se implementa en el Sprint 2. |

«Gerente de pagos», como lo llama a veces el cliente, es el Responsable de Finanzas. La división
por rol se mantiene aunque hoy todos los que usan el sistema son gerentes generales, porque el
sistema está pensado para una estructura jerárquica (reunión 05/11/2026).

**Configuración de negocio por rol** (reunión 05/11/2026):

| Sección | GG | ADM | RE | RF |
|---|---|---|---|---|
| Salones | ✅ | ✅ | ✅ | ✅ |
| Servicios y precios (incluye el incremento) | ✅ | ✅ | ✅ | ✅ |
| Medios de pago | ✅ | ✅ | — | ✅ |
| Landing y fotos | Solo fotos | ✅ | — | — |
| Personal | ✅ | ✅ | — | — |

Fuera de Configuración de negocio, los cuatro ven todo el panel. **La auditoría la ven solo el GG y
el ADM**, como hasta ahora: la reunión no la mencionó.

**Personal.** Sección nueva de Configuración de negocio. La usan solo el GG y el ADM, que son los que
acceden a todo el sistema.
- Muestra los **usuarios del panel interno** (no los clientes). Desde ahí se los **registra,
  modifica y da de baja**. Al registrar un usuario, el GG o el ADM le carga la **contraseña
  inicial**.
- **Política de contraseñas** (PO, 08/11/2026). Rige para toda contraseña que se crea o se cambia:
  la inicial del personal, el registro del cliente, restablecerla por correo y cambiarla desde Mi
  cuenta o por el ADM. Prioriza el largo y frena lo obvio; **no exige mayúsculas, minúsculas ni
  símbolos**, porque empujan a contraseñas como `Contraseña1!` sin hacerlas más fuertes.
  - **Al menos 8 caracteres.** Antes eran 6 (PO, 06/11/2026).
  - **No puede ser solo espacios** ni **un único carácter repetido** (`aaaaaaaa`).
  - **No puede ser una de las contraseñas más comunes** (`12345678`, `password`, `contraseña`,
    `bienvenido`, `confluens`, y unas veinte más). Se compara sin distinguir mayúsculas ni tildes.
  - **Máximo de 72 bytes** (PO, 07/11/2026): el algoritmo que guarda la contraseña (bcrypt) lee solo
    los primeros 72, así que dos contraseñas largas iguales hasta ahí valdrían lo mismo. Se mide en
    bytes: una tilde o un emoji ocupan más de uno.
  - Los espacios de los bordes cuentan como caracteres: la contraseña no se recorta.
  - **El inicio de sesión no aplica la política**, para que entren las cuentas que ya tienen una
    contraseña más corta o común. Tampoco se revisa la contraseña actual al cambiarla.
- Cada usuario tiene **un solo rol a la vez**. Al marcarle un rol nuevo, se desmarca el anterior.
- **Quién asigna qué rol:** el ADM asigna cualquiera (ADM, GG, RE, RF). El GG asigna GG, RE y RF,
  pero **no ADM**.
- **Cantidad por rol:** siempre tiene que haber **al menos un GG y al menos un ADM** activos; el
  sistema rechaza el cambio de rol o la baja que los deje en cero. De RE y RF puede no haber ninguno.
  Ningún rol tiene máximo.
- El GG puede modificar, cambiarle el rol o dar de baja a **otro GG**, siempre que quede al menos
  uno. A un **ADM** no lo puede tocar: ni modificarlo, ni cambiarle el rol, ni darlo de baja.
- **El GG y el ADM no se pueden quitar el rol entre sí**: el sistema nunca queda sin alguien que
  administre al personal. Lo garantiza la regla de cantidad: el ADM le puede cambiar el rol a un GG
  o darlo de baja, siempre que quede al menos un GG activo (PO, 07/11/2026).
- **Nadie se toca a sí mismo desde Personal** (PO, 07/11/2026): no se da de baja ni se cambia el
  propio rol; lo hace otro GG o ADM. El propio correo sí se puede corregir.
- **Contraseñas** (PO, 06/11/2026): **solo el ADM cambia la contraseña de otro usuario**, la de
  cualquiera del personal. Cada usuario cambia la suya desde **Mi cuenta**, con la actual. Al
  cambiarla se cierran las demás sesiones de ese usuario.
- **Baja lógica:** el usuario queda **inactivo**. No puede entrar y se cierran sus sesiones, pero se
  sigue viendo en la auditoría y en lo que registró. Se puede reactivar si después se recupera la
  cuenta.
- **Estado de conexión** (PO, 14/11/2026): el listado muestra una luz por usuario. **En línea**
  (verde) si hizo algo en los últimos 5 minutos, **Ausente** (amarillo) si la sesión sigue abierta
  pero hace más que eso que no hace nada, y **Sin sesión** (gris) si cerró sesión, está dado de baja,
  nunca entró o pasó el tiempo de la sesión (2 horas sin actividad). No hay una conexión permanente
  (la sesión es una cookie): «conectado» se deduce de la última actividad, así que quien tiene el
  panel abierto sin tocar nada pasa a Ausente a los 5 minutos. Lo ven solo el GG y el ADM, porque
  Personal es de ellos, y se actualiza solo cada 30 segundos mientras la pantalla está a la vista.

Personal está construido (HU-30 y HU-31 del Sprint 4; HU-30 y HU-31 del backlog en el Sprint 5,
con `Usuario.activo`). Los permisos por rol (HU-56) también: los cuatro roles del personal entran al
mismo panel interno (`/admin`) y ven todo lo que no sea Configuración de negocio; adentro de la
configuración, cada rol ve las secciones de la tabla de arriba. La API rechaza con `403` lo que el
rol no puede hacer. Eso incluye que el GG cambie las fotos de la landing pero no decida qué salones
se publican, que es solo del ADM. El listado de medios de pago queda abierto a todo el personal
porque el cobro lo necesita; administrarlos (alta y modificación) es del RF, el GG y el ADM. El
Cliente sigue sin acceso al panel. La matriz está en `packages/shared/src/dominio/permisos.ts`.

---

## Reglas de negocio

| Código | Regla |
|---|---|
| RN-01 | La seña equivale al **20% de la base de cobro del evento**. La base depende de si el presupuesto **requiere factura**: **con factura**, la base es el **total con IVA**; **sin factura**, el **subtotal sin IVA** (RN-05). El porcentaje es siempre 20%. **Desde HU-53** (reunión 05/11/2026; PO, 06/11/2026) todo presupuesto nuevo requiere factura y no hay casilla para cambiarlo, así que su base es el total con IVA; los anteriores conservan su marca. |
| RN-02 | La prioridad entre clientes al reasignar salones la define la organización (el Responsable de Eventos). |
| RN-03 | El precio informado es de referencia; el Responsable de Eventos puede ajustarlo comercialmente en casos particulares, y el ajuste queda auditado. |
| RN-04 | Los servicios no necesariamente cubren a todos los asistentes: pueden contratarse para menos. |
| RN-05 | **Todos los importes se guardan sin IVA.** El presupuesto (en pantalla y en PDF) muestra tres renglones: **subtotal sin IVA**, **IVA 21%** calculado sobre ese subtotal, y **total** = subtotal + IVA. La tasa del 21% va en una constante, no desparramada por el código. |
| RN-06 | La seña es lo que congela el presupuesto (`Confirmado`) y pasa el evento a `Reservado`. **Se puede cobrar aunque el presupuesto esté vencido** (`Expirado`), sin recalcularlo: la vigencia de 10 días es para el cliente (RN-08) y el personal lo resuelve desde el panel (reunión 05/11/2026). Si vencen los 10 días sin seña, **no se cancela nada automáticamente**. Lo abonado no es reembolsable, tampoco lo pagado por encima de la seña ni por encima del total (ver «Saldo»). Construido con HU-55 (Sprint 5). |
| RN-07 | La cancelación por parte del cliente requiere un mínimo de **48 horas corridas** de anticipación. **Fines de semana y feriados cuentan** (hay eventos todos los días), así que no hace falta calendario de feriados. El plazo aplica a un evento **confirmado** (`Reservado`); una consulta sin seña (`EnConsulta`) se cancela en cualquier momento (decisión del PO, 16/10/2026). |
| RN-08 | El presupuesto tiene una **vigencia de 10 días** desde su emisión; **cada modificación la reinicia** (decisión del PO, 05/10/2026), también el recálculo por cambio de fecha; el recálculo por cambio de porcentaje **no** la reinicia (ver «Recálculo automático»). **Es una regla para el cliente** (reunión 05/11/2026): ve la leyenda «Este presupuesto tiene una validez de 10 días» en el PDF, en el cotizador, en la landing y en la cláusula o) de las condiciones. En el panel interno **no bloquea nada**: de la vigencia de los precios se encarga el incremento (RN-10) y la seña los congela. Vencida, un control automático lo pasa a `Expirado` y el sistema **muestra un aviso** al Responsable de Eventos («presupuesto vencido»); si le cambia la fecha, se recalcula y el aviso desaparece. El presupuesto **no se borra ni se cancela solo**: solo se da de baja a mano, si el Responsable de Eventos lo decide. |
| RN-09 | **Modificaciones y plazo de 7 días.** El cliente puede modificar su consulta o evento hasta **7 días antes** de la fecha del evento; después, cualquier modificación del lado del cliente se **bloquea** (no solo se avisa). El Responsable de Eventos puede modificar **en todo momento**, sin límite de plazo. Esto reemplaza la condición del PDF sobre confirmar asistentes 7 días antes y sumar hasta 5 personas a 48 hs. |
| RN-10 | **Incremento de precios.** El Responsable de Eventos define un **porcentaje de incremento mensual**, modificable en cualquier momento. Se aplica automáticamente al tarifario una vez por mes. Además puede aplicar aumentos **a mitad de mes**, **a todo el catálogo** o **a servicios puntuales**. No afecta a los servicios tercerizados ni a los presupuestos `Confirmado`; los `Estimado` de eventos `EnConsulta` se recalculan solos (ver «Recálculo automático»). **Tramos y porcentaje por servicio** (reunión 05/11/2026): el porcentaje general se carga en **tramos** con fecha de inicio y de fin, con un botón «+» para sumar tramos. Los tramos son **consecutivos**: el inicio de cada uno es el día siguiente al fin del anterior, y el sistema lo completa solo; si se cambia el fin de un tramo, el inicio del siguiente se corre solo, y si el fin nuevo cae después del fin del siguiente, el cambio se rechaza hasta ajustar o borrar ese tramo. **El último tramo no tiene fin**, así nunca queda un período sin porcentaje. Un servicio puede tener **su propio porcentaje**, que **reemplaza** al general (no se suman); al cambiar el general, el sistema avisa qué servicios tienen porcentaje propio y deja elegir rápido, en cada uno, si lo conserva o pasa al general. **Reunión 05/11/2026 → HU-34 del backlog.** Hasta entonces hay un solo porcentaje mensual (`ConfiguracionPrecios`). |
| RN-11 | **Recargo por modalidad.** Continuo en salón: +20%. En mesas con mozo: +30%. Se aplica **sobre el precio base por persona** del servicio, **sin IVA**, y **por cada servicio** en que el cliente elija esa modalidad (si elige tres coffees y marca continuo en dos, el recargo va solo en esos dos). Es opcional: el cliente elige. |
| RN-12 | **El que seña primero se queda con el salón.** Puede haber varias consultas para el mismo salón, fecha y horario. Cuando una pasa a `Reservado`, las demás `EnConsulta` que se superponen **no se cancelan**: el sistema las marca como "en conflicto" y el Responsable de Eventos gestiona con esos clientes mover la fecha, el horario o el salón. Registrar la seña de una consulta cuyo horario ya está reservado por otro evento se rechaza. En un evento de varios días, el solapamiento se controla **por día y por salón** (HU-50). |
| RN-13 | **Precios proyectados a la fecha del evento.** Cuando el cliente arma un presupuesto para una fecha futura, los precios de los servicios propios y del salón se proyectan aplicando el porcentaje mensual vigente, **compuesto**, una vez por cada mes entre el mes actual y el mes del evento: `precio_actual × (1 + p)^meses`. Sigue siendo compuesta porque se admiten porcentajes con decimales. Con tramos (RN-10), cada mes que atraviesa usa el porcentaje de su tramo, y un servicio con porcentaje propio usa el suyo (reunión 05/11/2026, HU-34 del backlog). Los tercerizados no se proyectan. Casos particulares los arregla a mano el Responsable de Eventos (RN-03). |
| RN-14 | **Todos los medios de pago activos se pueden usar en todos los cobros**, con factura o sin ella (reunión 05/11/2026; HU-53, PO, 06/11/2026). El alta y la modificación de un medio piden solo el nombre. Antes de HU-53 cada medio se habilitaba con factura, sin factura o en los dos casos (HU-19 del Sprint 3, HU-33 del Sprint 4); esas marcas siguen en la base, sin uso. «Tarjeta», el medio de la versión anterior que Débito y Crédito reemplazan, queda con **baja lógica**: los pagos ya registrados con él se siguen mostrando en el historial del evento, pero no se ofrece ni se acepta en un cobro nuevo. |

---

## Decisiones que el agente NO puede tomar solo

- Agregar o renombrar un estado de evento o presupuesto (incluido renombrar `Reservado` a
  `Confirmado`: hoy es solo una etiqueta de pantalla).
- Cambiar el porcentaje de la seña, la base de cobro de RN-01, la vigencia de 10 días, el plazo de
  48 horas o el de 7 días.
- Cambiar el catálogo de medios de pago o volver a habilitarlos por caso (RN-14).
- Cambiar la tasa de IVA o dejar de guardar los importes sin IVA.
- Volver a ofrecer el caso sin factura, o cambiar qué pasa con lo pagado de más («Saldo»).
- Cambiar los permisos por rol, las reglas de Personal o cuándo se recalcula un presupuesto.
- Cancelar o dar de baja automáticamente un evento o un presupuesto: todas las bajas son manuales.
- Cualquier punto abierto de `pendientes.md`.

Ante cualquiera de estas, parar y preguntar.

# Dominio — Confluens

Vocabulario, estados y reglas del negocio de Los Abuelos Servicios Gastronómicos.
Todo nombre de entidad, campo, enum y endpoint tiene que corresponderse con este archivo.

Fuentes: Plan de Proyecto, Seguimiento del Proyecto, Sprint 1 y máquina de estados (drawio),
todos aprobados por la cátedra, más la **entrevista con el Responsable de Eventos del 24/09/2026**,
que redefinió el canal público, la vigencia del presupuesto, el IVA y la política de precios.
Donde este archivo contradiga a un documento anterior, vale este archivo.

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
    └──controlarVigencia()──> Expirado
```

| Estado | Significado |
|---|---|
| `Estimado` | Recién generado. Editable. Vigente durante 10 días desde su emisión (RN-08). |
| `Confirmado` | Se abonó la seña dentro de la vigencia. **La seña congela el presupuesto**: sus precios ya no cambian aunque suba el tarifario. Bloqueado para edición por el cliente. |
| `Cancelado` | Dado de baja sin confirmarse. Solo manual. |
| `Expirado` | Pasaron 10 días sin seña. **No se borra ni cancela nada**: el presupuesto queda visible, marcado con un aviso para que el Responsable de Eventos sepa que hay que recalcularlo. |

Recalcular un presupuesto `Expirado` = generar uno nuevo para el mismo evento con los precios
vigentes (un evento puede tener varios presupuestos). El evento sigue `EnConsulta`.

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
trabajo, banquete. Nombre único por salón. Su capacidad nunca supera la del salón.

**Cliente.** Persona u organización que contrata. Datos: nombre, apellido (o razón social),
teléfono y correo. **No hay baja por inactividad**: el cliente se conserva siempre con su
historial.

**Es usuario del sistema**: para ver precios y armar un presupuesto en el canal público debe
registrarse e iniciar sesión (ver "Canal público"). Planificado para el Sprint 2. Un cliente
cargado a mano por el Responsable de Eventos puede no tener usuario.

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
(+30%)**. Ver RN-11.

**Presupuesto.** Valorización del evento, detallada línea por línea. Guarda los importes **sin
IVA** y se presenta con **subtotal sin IVA, IVA 21% y total**. Al emitirse congela los precios de
sus líneas, aunque después cambie el catálogo. Lleva la leyenda **"Este presupuesto tiene una
validez de 10 días"**.

**Evento.** Entidad central: cliente, salón, distribución, fecha, horario, cantidad de personas,
servicios, presupuesto y pagos.

**Pago.** Importe recibido con fecha y medio de pago. Monto libre, sin mínimo.

**Saldo.** Total acordado menos la suma de los pagos registrados.

**Medio de pago.** Efectivo, tarjeta, a la habitación.

**Auditoría.** Registro inmutable de usuario, fecha, entidad, valor anterior y valor nuevo.
Nadie lo edita ni lo borra. Se implementa con middleware de Prisma sobre `audit_log`.

**Solapamiento.** Dos eventos **`Reservado` o `Cobrado`** en el mismo salón, fecha y horario.
Prohibido. Se valida en la aplicación **y** con una restricción de exclusión de PostgreSQL
usando `btree_gist`. Los eventos `EnConsulta` no cuentan: pueden coincidir entre sí y con un
evento reservado (ver RN-12).

**Tipo de evento.** Social o empresarial. Se usa en el reporte de ingresos (HU-21).

**Comedor.** Servicio gastronómico del hotel, con sistema propio. Fuera de alcance (EXC-04).

---

## Roles

| Rol | Código | Alcance |
|---|---|---|
| Responsable de Eventos | `RE` | Consulta, presupuesto, agenda y reserva. **También administra los precios**: porcentaje de incremento mensual, ajustes por servicio y precios de los tercerizados. Mayor uso diario. En las entrevistas es "Fran". |
| Responsable de Finanzas | `RF` | Cobros, medios de pago, seguimiento de deuda. |
| Gerente General | `GG` | Reportes, usuarios. Lectura de todo. Único que ve la auditoría. |
| Administrador del Sistema | `ADM` | Acceso completo: todo lo del Gerente General más el contenido público de la landing (qué salones se publican y qué fotos se muestran). |
| Sistema | `SYS` | Actor no humano: tareas programadas, cálculos, auditoría, envío de correos. |
| Cliente | `CLI` | Externo a la organización, con credenciales propias. Solo el canal público: ve precios, arma y confirma consultas, consulta las suyas. Nunca accede al panel interno. Se implementa en el Sprint 2. |

---

## Reglas de negocio

| Código | Regla |
|---|---|
| RN-01 | La seña equivale al 20% del total del evento. |
| RN-02 | La prioridad entre clientes al reasignar salones la define la organización (el Responsable de Eventos). |
| RN-03 | El precio informado es de referencia; el Responsable de Eventos puede ajustarlo comercialmente en casos particulares, y el ajuste queda auditado. |
| RN-04 | Los servicios no necesariamente cubren a todos los asistentes: pueden contratarse para menos. |
| RN-05 | **Todos los importes se guardan sin IVA.** El presupuesto (en pantalla y en PDF) muestra tres renglones: **subtotal sin IVA**, **IVA 21%** calculado sobre ese subtotal, y **total** = subtotal + IVA. La tasa del 21% va en una constante, no desparramada por el código. |
| RN-06 | La seña se abona **dentro de la vigencia del presupuesto (10 días)** y es lo que lo congela (`Confirmado`) y pasa el evento a `Reservado`. Si vencen los 10 días sin seña, **no se cancela nada automáticamente**: el presupuesto pasa a `Expirado` y hay que recalcularlo (con los precios vigentes) antes de cobrar la seña. Lo abonado no es reembolsable. |
| RN-07 | La cancelación por parte del cliente requiere un mínimo de **48 horas corridas** de anticipación. **Fines de semana y feriados cuentan** (hay eventos todos los días), así que no hace falta calendario de feriados. |
| RN-08 | El presupuesto tiene una **vigencia de 10 días** desde su emisión. Vencida, un control automático lo pasa a `Expirado` y el sistema **muestra un aviso** al Responsable de Eventos ("presupuesto vencido, recalcular"). El presupuesto **no se borra ni se cancela solo**: solo se da de baja a mano, si el Responsable de Eventos lo decide. |
| RN-09 | **Modificaciones y plazo de 7 días.** El cliente puede modificar su consulta o evento hasta **7 días antes** de la fecha del evento; después, cualquier modificación del lado del cliente se **bloquea** (no solo se avisa). El Responsable de Eventos puede modificar **en todo momento**, sin límite de plazo. Esto reemplaza la condición del PDF sobre confirmar asistentes 7 días antes y sumar hasta 5 personas a 48 hs. |
| RN-10 | **Incremento de precios.** El Responsable de Eventos define un **porcentaje de incremento mensual**, modificable en cualquier momento. Se aplica automáticamente al tarifario una vez por mes. Además puede aplicar aumentos **a mitad de mes**, **a todo el catálogo** o **a servicios puntuales**. No afecta a los servicios tercerizados ni a presupuestos ya emitidos. |
| RN-11 | **Recargo por modalidad.** Continuo en salón: +20%. En mesas con mozo: +30%. Se aplica **sobre el precio base por persona** del servicio, **sin IVA**, y **por cada servicio** en que el cliente elija esa modalidad (si elige tres coffees y marca continuo en dos, el recargo va solo en esos dos). Es opcional: el cliente elige. |
| RN-12 | **El que seña primero se queda con el salón.** Puede haber varias consultas para el mismo salón, fecha y horario. Cuando una pasa a `Reservado`, las demás `EnConsulta` que se superponen **no se cancelan**: el sistema las marca como "en conflicto" y el Responsable de Eventos gestiona con esos clientes mover la fecha, el horario o el salón. Registrar la seña de una consulta cuyo horario ya está reservado por otro evento se rechaza. |
| RN-13 | **Precios proyectados a la fecha del evento.** Cuando el cliente arma un presupuesto para una fecha futura, los precios de los servicios propios y del salón se proyectan aplicando el porcentaje mensual vigente, **compuesto**, una vez por cada mes entre el mes actual y el mes del evento: `precio_actual × (1 + p)^meses`. Los tercerizados no se proyectan. Casos particulares los arregla a mano el Responsable de Eventos (RN-03). |

---

## Decisiones que el agente NO puede tomar solo

- Agregar o renombrar un estado de evento o presupuesto (incluido renombrar `Reservado` a
  `Confirmado`: hoy es solo una etiqueta de pantalla).
- Cambiar el porcentaje de la seña, la vigencia de 10 días, el plazo de 48 horas o el de 7 días.
- Cambiar la tasa de IVA o dejar de guardar los importes sin IVA.
- Definir qué pasa con lo abonado por encima de la seña ante una cancelación en plazo.
- Cancelar o dar de baja automáticamente un evento o un presupuesto: todas las bajas son manuales.
- Cualquier punto abierto de `pendientes.md`.

Ante cualquiera de estas, parar y preguntar.

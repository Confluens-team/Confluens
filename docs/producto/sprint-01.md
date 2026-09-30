# Sprint 1 — Confluens

Del 11/09/2026 al 25/09/2026 · Scrum Master: Tomás Santillán · 8 historias · 31 puntos

> **Notas de esta corrección** (contra `Seguimiento del Proyecto` y `Sprint 1` en Drive):
> - Las fechas del sprint se corrigieron a 11/09/2026–25/09/2026 (ambos viernes; coincide con el día de Sprint Planning y con la tabla de asignación de Scrum Master del Seguimiento del Proyecto). El documento fuente de Sprint 1 todavía dice "9 de septiembre al 23 de septiembre", pero eso contradice esa tabla.
> - Se renumeraron las historias de HU-27/HU-01/HU-32/HU-14/HU-09/HU-15 (numeración del backlog global) a **HU-01–HU-08**, que es la numeración local que usa el documento oficial de Sprint 1.
> - Se agregaron **HU-07** y **HU-08** (landing page de salones), ausentes en la versión anterior, con lo cual el total pasa de 6 historias/25 puntos a 8 historias/31 puntos.
> - El "grupo sugerido" de HU-07 y HU-08 es un supuesto propio (no está definido en la fuente); se marca con *.
> - Se movieron a HU-05 dos criterios de HU-02 (la multiplicación del precio por persona y el cálculo sobre una cantidad parcial de asistentes, RN-04): son comportamiento del armado del presupuesto, no del alta del servicio. El documento de Sprint 1 en Drive repite parte de este criterio en ambas historias (HU-02 "Contratación parcial" y HU-05 "Servicio parcial"); si el equipo está de acuerdo con este ajuste, conviene reflejarlo también en el documento fuente.

> **Criterios superados por la entrevista del 24/09/2026.** Este archivo queda como registro del
> Sprint 1. En sprints futuros, estos criterios **no** se toman de acá sino de `dominio.md`:
> - HU-05: "los servicios tercerizados no se incluyen en el total" → ahora **sí suman** (salvo los "a cotizar"). "Todos los importes se expresan sin IVA" → se guardan sin IVA pero se muestran subtotal, IVA 21% y total (RN-05).
> - HU-06: "si no se registra la seña en 10 días el evento pasa a Cancelado" → **no hay cancelación automática**; vence el presupuesto y se recalcula (RN-06, RN-08). "48 horas" → 48 horas corridas, feriados incluidos (RN-07).
> - HU-04: el formulario sin login fue solo del Sprint 1; desde el Sprint 2 lo arma el cliente registrado con presupuesto dinámico (HU-48, HU-49).

Objetivo: walking skeleton. Que un evento pueda recorrer el circuito completo de punta a punta aunque cada paso sea mínimo, antes de profundizar en ninguna funcionalidad.

Los puntos por historia surgen del acta del Sprint Planning. HU-01, HU-02, HU-03, HU-05 y HU-06 fueron re-estimadas a la baja respecto del backlog general por abordarse con alcance acotado; HU-04, HU-07 y HU-08 conservan su estimación original.

## Alcance

| HU | Título | Actor | Grupo sugerido |
|---|---|---|---|
| HU-01 | Iniciar sesión según su rol | RE | A |
| HU-02 | Registrar servicio | RE | A |
| HU-03 | Consultar salones y su capacidad | RE | A |
| HU-04 | Registrar evento en consulta enviada por el propio cliente | Cliente | B |
| HU-05 | Generar presupuesto estimado | RE | B |
| HU-06 | Registrar confirmación de evento por el personal | RE | B |
| HU-07 | Visualizar información de salones en landing page | Cliente | A* |
| HU-08 | Registrar información de salones en landing page | Administrador del Sistema** | A* |

El corte entre grupos es por límite de módulo, no por capa. El grupo A se lleva accesos y catálogo, el B el circuito del evento. B depende de las entidades de A: el schema.prisma del sprint y los tipos de packages/shared se mergean a main el día 1, antes de que nadie escriba un endpoint.

\* HU-07 y HU-08 se asignan al grupo A por depender del mismo catálogo de salones; esta asignación no figura en el documento fuente.
\** El documento fuente usa el actor "Administrador del Sistema" para HU-08, un rol que no aparece en la tabla de roles Scrum del Seguimiento del Proyecto (donde todo el equipo figura como Equipo de Desarrollo). Se mantiene tal cual está en la fuente.

## HU-01 — Iniciar sesión según su rol

Como Responsable de Eventos, quiero iniciar sesión con mi usuario y contraseña y acceder únicamente a lo que me corresponde, para que cada perfil vea la información de su incumbencia.

- Con credenciales válidas accedo al sistema y veo el menú de mi rol.
- Con contraseña incorrecta se deniega el acceso sin indicar cuál de los dos datos falló.
- Siendo RE, el acceso a administración de usuarios y reportes de ingresos queda denegado.
- Las contraseñas se almacenan cifradas, nunca en texto plano.
- Al cerrar sesión o expirar por inactividad, hay que volver a autenticarse.

**Implementación.** JWT en cookie httpOnly, hash bcrypt. El enum de rol incluye CLIENTE desde ahora aunque no se use en este sprint: se activa en el Sprint 2 y evita migrar la tabla después.

## HU-02 — Registrar servicio

Como Responsable de Eventos, quiero registrar los servicios que ofrece la organización con su precio, para incorporarlos a los presupuestos sin cargarlos manualmente cada vez.

- Al registrar un servicio con nombre, descripción, unidad de medida y precio, queda disponible para seleccionar en un presupuesto.
- La unidad de medida indica si el servicio se cobra por persona o de forma fija por evento; ese dato es el que usa HU-05 para calcular el total en cada presupuesto.
- Un nombre de servicio ya existente se rechaza.

**Datos.** El catálogo real (coffee breaks, desayunos, degustación, lunch-cocktail, almuerzo/cena) está en `../negocio/tarifario-2026.md` y sirve de seed.

## HU-03 — Consultar salones y su capacidad

Como Responsable de Eventos, quiero consultar el listado de salones con su capacidad, superficie y distribuciones posibles, para responderle al cliente qué salón se ajusta a su evento sin recurrir al PDF que se envía hoy por WhatsApp.

- Veo los cinco salones con nombre, capacidad máxima y superficie.
- Filtrando por capacidad mínima N, solo aparecen los salones que la cubren.
- Al seleccionar un salón veo sus distribuciones con la capacidad de cada una.
- Si ningún salón cubre la capacidad pedida, el sistema lo informa y sugiere la mayor disponible.

**Datos.** Capacidades, superficies y precios reales en `../negocio/tarifario-2026.md`. En este sprint los salones se cargan por seed, no hay pantalla de alta (esa historia — modificar datos de un salón — está prevista para el Sprint 4 según el Story Map).

## HU-04 — Registrar evento en consulta enviada por el propio cliente

Como Cliente, quiero registrar a través del formulario público la consulta de un evento con la fecha deseada y los datos preliminares, para consultar la disponibilidad, conocer las opciones de precios y servicios, y coordinar los detalles restantes.

- Al completar el formulario con datos de contacto, fecha deseada y cantidad estimada de personas, se crea una solicitud y recibo confirmación de que fue enviada.
- En este sprint el formulario no requiere autenticación. La ficha de cliente la crea el Responsable de Eventos al tomar la solicitud.
- La solicitud no bloquea el salón: la fecha sigue figurando disponible.
- El Responsable de Eventos ve la solicitud diferenciada visualmente de reservas y eventos.
- Sin datos de contacto o sin fecha, la solicitud se rechaza indicando los campos obligatorios.

**Decidido.** El acceso con credenciales del Cliente se implementa en el Sprint 2. Para que nada de esto se tire: Solicitud lleva clienteId nullable desde el día 1, el endpoint es POST /api/solicitudes en ambos sprints y lo único que se agrega después es el middleware de autenticación adelante. El formulario pide los datos de contacto igual; en el Sprint 2 se prellenan desde la sesión.

**Pendiente antes de publicar.** Rate limit y honeypot: el formulario queda abierto sin login.

## HU-05 — Generar presupuesto estimado

Como Responsable de Eventos, quiero que el sistema genere automáticamente un presupuesto a partir del salón, la fecha, la cantidad de personas y los servicios seleccionados, para responderle al cliente en minutos en lugar de armar la planilla a mano.

- El total se calcula sumando el precio del salón más cada servicio por su cantidad, con detalle línea por línea.
- Un servicio que se cobra por persona multiplica su precio por la cantidad de personas indicada al incorporarlo al presupuesto.
- Un servicio contratado para menos personas que el total del evento se calcula sobre esa cantidad indicada, no sobre el total de asistentes (RN-04).
- Todos los importes se expresan sin IVA y esa condición se indica en el documento (RN-05).
- Los servicios de catering tercerizados no se incluyen en el total, por estar a cargo del cliente frente al tercero.
- Se toman los precios vigentes al mes de emisión.
- El presupuesto nace en estado Estimado, editable y sin requerir pago previo.

## HU-06 — Registrar confirmación de evento por el personal

Como Responsable de Eventos, quiero registrar la reserva de un evento con salón, fecha, distribución, servicios y presupuesto asociado, para dejar formalmente tomado el compromiso con el cliente y bloquear el salón en la agenda.

- Al registrar la reserva, el evento ocupa el salón en la agenda.
- Sin solapamiento: si el salón ya tiene otro evento en esa fecha y horario, se rechaza informando con cuál se superpone.
- Si la cantidad de personas supera la capacidad de la distribución, se advierte y se exige confirmación explícita.
- Confirmación por seña: si no se registra el 20% del total dentro de los 10 días posteriores a la confirmación, el evento pasa a Cancelado y el salón se libera (RN-06).
- Cancelación: solo se admite hasta 48 horas antes de la fecha del evento (RN-07).
- Tres eventos el mismo sábado en salones distintos se aceptan sin conflicto.
- La modalidad salón-restaurante se marca como opción interna, no visible al cliente.

**Implementación.** El no solapamiento se valida en la aplicación y con una restricción de exclusión de PostgreSQL usando btree_gist. Ver `../tecnico/modelo-datos.md`.

## HU-07 — Visualizar información de salones en landing page

Como Cliente, quiero visualizar la información de salones, servicios gastronómicos, ubicación, redes sociales, formato de armado, condiciones de contratación y contenido multimedia general, para decidir si hacer una reserva de evento.

- Veo los cinco salones (Paraná, Iguazú, Pucará, Bariloche y Auditorio) con nombre, capacidad máxima y superficie, sin necesidad de autenticarme.
- Al seleccionar un salón veo sus distribuciones posibles con la capacidad correspondiente a cada una.
- Desde la ficha de un salón puedo avanzar al formulario de consulta de evento (HU-04) con el salón preseleccionado.
- Si el Responsable de Eventos modifica los datos de un salón (HU-03), la landing page muestra la información actualizada sin un paso de publicación manual adicional.
- No se expone ningún dato de clientes, presupuestos o eventos: únicamente la información de referencia del salón.
- Un salón marcado como no visible (HU-08) no aparece en el listado público, aunque siga disponible para uso interno.

## HU-08 — Registrar información de salones en landing page

Como Administrador del Sistema, quiero registrar nueva información o contenido multimedia referido al negocio, para dar a conocer la forma de trabajo de la empresa de manera actualizada.

- Al marcar un salón como visible en la landing page, sus datos (nombre, capacidad, superficie y distribuciones) quedan disponibles para consulta pública.
- Al quitar la visibilidad de un salón, deja de listarse públicamente sin afectar su disponibilidad interna en la agenda.
- Si se modifican los datos de un salón visible (HU-03), la información pública se actualiza de inmediato, sin publicación manual adicional.
- Cada cambio de visibilidad o de datos publicados queda auditado (usuario, fecha y detalle del cambio).
- Sin autenticación o sin el rol correspondiente, la operación se deniega.

## Definición de Terminado

Una historia está terminada cuando sus criterios pasan como tests automatizados, el código fue revisado por otro integrante vía pull request, el CI corre sin errores, la funcionalidad está desplegada y accesible, y las operaciones que modifican datos quedan auditadas.

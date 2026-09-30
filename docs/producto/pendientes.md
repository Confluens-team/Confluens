# Pendientes de definición

Definiciones ausentes o contradictorias entre los documentos de origen. **El agente no las
resuelve por su cuenta**: si una tarea depende de alguno de estos puntos, parar y preguntar.

El Product Owner los valida con el cliente antes del sprint en que se aborda la historia afectada.

## Abiertos

| ID | Tema | Situación | Bloquea |
|---|---|---|---|
| S-01 | Reintegro parcial | RN-06 dice que lo abonado no se reintegra. No está definido qué pasa con lo abonado **por encima** de la seña si el cliente cancela dentro del plazo de 48 hs de RN-07. | HU-44 (S3) |
| S-05 | Vencimiento del saldo | RD-06.1 exige alertar el próximo vencimiento, pero no está definida la fecha de vencimiento del saldo de un evento. | HU-23 (S6) |
| S-08 | Base de la seña y de los pagos | Desde la entrevista del 24/09 el presupuesto muestra total **con** IVA (RN-05). No está definido si el 20% de la seña se calcula sobre el subtotal sin IVA o sobre el total con IVA, ni si los pagos se registran con o sin IVA. Hasta definirlo, no implementar el cálculo del umbral de seña. | HU-40 (S2), HU-41 |
| S-09 | Recargos combinables | RN-11 define continuo (+20%) y en mesa (+30%) por servicio, pero no se aclaró si un mismo servicio puede llevar **las dos** modalidades a la vez. Modelar la modalidad como un valor único por línea (normal / continuo / mesa) hasta que se confirme. | HU-49 |
| S-10 | Día de aplicación del incremento mensual | El cliente dijo que el porcentaje impacta "cada 31, mes a mes". Falta confirmar si es el último día de cada mes o el primero del mes siguiente. Hasta confirmar, usar el primer día de cada mes (misma fecha que usa RN-13 para contar meses). | HU-34 (S5) |
| S-11 | Envío de correos | El canal público manda un correo al confirmar la consulta. El stack no tiene servicio de correo: hay que elegir proveedor (SMTP con Nodemailer, Resend, etc.) y registrarlo en una ADR antes de implementarlo. | HU-49 |
| S-12 | Precios de audiovisual y pantallas LED | Las pantallas LED del Auditorio no tienen precio fijo. El Responsable de Eventos va a pedirle al proveedor precios fijos por 6 meses. Mientras tanto se cargan como servicio tercerizado "a cotizar" (ver `dominio.md`). | Seeds, HU-49 |

## Resueltos

| ID | Tema | Resolución | Fuente |
|---|---|---|---|
| S-02 | Alta de clientes en el canal público | Autorregistro abierto con nombre, apellido, correo, contraseña y teléfono. Sin aprobación previa. Validación de correo: no se pidió. | Entrevista 24/09 |
| S-03 | Inactividad de un cliente | **No hay baja por inactividad.** HU-08 del backlog global se elimina. | Entrevista 24/09 |
| S-04 | Tipos de evento | Social y empresarial. | Refinamiento |
| S-06 | IVA | Los precios del tarifario son **sin IVA**. Se guardan sin IVA y se muestran subtotal, IVA 21% y total (RN-05). | Entrevista 24/09 |
| S-07 | Comandas y proveedores | Fuera de alcance. | Equipo |
| — | Capacidades de los salones | Están en el tarifario vigente. Ver `../negocio/tarifario-2026.md`. | Tarifario |
| — | Vigencia del presupuesto | **10 días** (no 30). Vencido, pasa a `Expirado` con aviso; no se da de baja solo (RN-08). | Entrevista 24/09 |
| — | Plazo de la seña | Dentro de la vigencia de 10 días. **No hay cancelación automática** del evento (RN-06). | Entrevista 24/09 |
| — | Plazo de cancelación | 48 horas **corridas**; feriados y fines de semana cuentan (RN-07). | Entrevista 24/09 |
| — | Cambios de asistentes | El cliente no modifica nada a menos de 7 días del evento; el Responsable de Eventos sí, siempre (RN-09). | Entrevista 24/09 |
| — | Media jornada | Hasta 4 horas **inclusive**. | Entrevista 24/09 |
| — | Audiovisual | Tercerizado, con precio, seleccionable y suma al total. Sin incremento mensual; lo actualiza el Responsable de Eventos. | Entrevista 24/09 |
| — | Incremento de precios | Porcentaje mensual editable por el Responsable de Eventos, más aumentos puntuales globales o por servicio (RN-10). Proyección a fecha futura compuesta (RN-13). | Entrevista 24/09 |
| — | Envío por WhatsApp | Solo un botón `wa.me` con mensaje prearmado de aviso de recepción. El resumen se descarga en PDF y lo envía el Responsable de Eventos a mano. | Entrevista 24/09 |
| — | Conflicto entre consultas | El que seña primero se queda con el salón; las demás consultas quedan marcadas en conflicto para gestión manual (RN-12). | Entrevista 24/09 |
| — | Login del cliente | Se implementa en el Sprint 2. El Sprint 1 fue sin autenticación. | Sprint 1 |
| S-10 | Día de aplicación del incremento mensual| el dia elegido es el priemero de cada mes| Equipo y entrevista con responsable de eventos|

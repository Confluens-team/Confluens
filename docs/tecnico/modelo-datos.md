# Modelo de datos

Entidades y enums del sistema. **Los valores de los enums son los de la máquina de estados
aprobada** (ver `../producto/dominio.md`): no inventar sinónimos ni traducirlos.

Este archivo describe el modelo acordado. El `schema.prisma` es su implementación y se mergea a
main el primer día de cada sprint, antes de que nadie escriba un endpoint.

## Enums

```prisma
enum EstadoEvento {
  EnConsulta
  Reservado
  Cobrado
  Cancelado
}

enum EstadoPresupuesto {
  Estimado
  Confirmado
  Cancelado
  Expirado
}

enum Rol {
  RESPONSABLE_EVENTOS
  RESPONSABLE_FINANZAS
  GERENTE_GENERAL
  ADMINISTRADOR_SISTEMA // contenido público de la landing (ADR 0004)
  CLIENTE               // definido desde el Sprint 1, se activa en el Sprint 2
}

// Recargo opcional por servicio (RN-11). Valor único por línea hasta resolver S-09.
enum ModalidadServicio {
  Normal     // sin recargo
  Continuo   // +20% sobre el precio base por persona
  EnMesa     // +30% sobre el precio base por persona
}

// Social o corporativo (ADR 0008). Antes "Empresarial".
enum TipoEvento {
  Social
  Corporativo
}

enum TipoEventoSocial {
  Cumpleanos
  Casamiento
  FiestaDeQuince
  Bautismo
  FiestaCorporativa
  Otro        // con su descripción en Evento.tipoSocialDetalle
}

// En minúscula para coincidir con esquemaTipoJornada de packages/shared.
enum TipoJornada {
  completa    // más de 4 horas
  media       // hasta 4 horas inclusive
}
```

`Reservado` se muestra como "Confirmado" en pantallas y comunicaciones al cliente (ver
`dominio.md`), pero el valor del enum no cambia.

## Entidades

| Entidad | Notas |
|---|---|
| `Usuario` | Credenciales: email único, hash de contraseña, rol. **Separada de `Cliente`.** |
| `Cliente` | Datos comerciales: nombre, apellido (nullable, para razón social), teléfono, correo. Relación 1-1 opcional con `Usuario`. **No hay baja por inactividad**: `activo` no lo cambia ninguna tarea programada. En el autorregistro se crean juntos el `Usuario` (rol `CLIENTE`) y su `Cliente`. |
| `Salon` | Nombre, capacidad máxima, superficie, precio de referencia jornada completa y media jornada. Contenido de la landing (HU-08): `visibleEnLanding` (booleano, default `true`) y `fotoUrl` (nullable): la URL de la foto en Cloudinary, que se sube desde el panel; la base guarda solo la URL, nunca la imagen (ADR 0009). Un salón no visible sigue disponible para uso interno. |
| `Distribucion` | Pertenece a un salón. Nombre único por salón, capacidad ≤ capacidad del salón. |
| `Servicio` | Nombre único, descripción, unidad de medida, precio sin IVA, si se cobra por persona, si es tercerizado, activo. `precio` **nullable**: `null` significa "a cotizar" (solo tercerizados). `tercerizado` = lo provee un tercero: **entra en el total** del presupuesto pero **no recibe el incremento mensual**. `admiteModalidad` (booleano, default `false`; `true` en los coffee breaks): habilita elegir continuo o en mesa (RN-11). Contenido de la landing: `categoria` (nullable) y `fotoUrl` (nullable, URL de Cloudinary como en `Salon`). |
| `Solicitud` | Consulta confirmada por el cliente en el canal público. `clienteId` nullable (las del Sprint 1 no tienen cliente; desde el Sprint 2 siempre lo tienen). Guarda los datos de contacto, fecha, horario (`inicio`/`fin`, nullable), cantidad de personas, `salonId` y `distribucionId` (nullable) y el subtotal estimado sin IVA que vio el cliente. Puede descartarse: `descartada` (booleano) y `eventoId` (nullable, 1-1) con el evento `EnConsulta` en que se convirtió. |
| `LineaSolicitud` | Lo que eligió el cliente, con la misma forma que `LineaPresupuesto` (servicio, cantidad, modalidad, precio unitario mostrado). Al convertir la solicitud en evento, estas líneas se copian al presupuesto `Estimado`. |
| `Evento` | Cliente, salón, distribución, fecha, horario desde/hasta (`inicio`/`fin`), cantidad de personas, estado, modalidad salón-restaurante. Tipo de evento (ADR 0008): `tipo` (`TipoEvento`, default `Corporativo`), `tipoSocial` (`TipoEventoSocial`, solo en los sociales) y `tipoSocialDetalle` (texto, solo con `Otro`). `tipoJornada` (`TipoJornada`, nullable): la que eligió el cliente; en los eventos anteriores es `null` y la jornada sale de la línea del salón. `horaInicioEstimada` (texto `HH:mm`, nullable): solo de referencia, el horario real lo carga agendar (ADR 0007). El salón (`salonId`) es nullable: una consulta social llega sin salón, y es obligatorio para reservar; la distribución y el horario pueden completarse después (ver restricciones). Ya agendado, la jornada (media / completa) se deriva del horario: ≤ 4 h es media. |
| `Presupuesto` | Pertenece a un evento. Estado, `emitidoEn`, `venceEn` (= emisión + 10 días, RN-08; `null` mientras el presupuesto de una consulta social está sin armar, sin líneas: arranca cuando se guarda la primera, ADR 0008), `subtotal` sin IVA, `requiereFactura` (booleano, default `false`): si el evento se factura, la base de cobro de RN-01 incluye el IVA y la seña del 20% se calcula sobre ese total. IVA y total **no se guardan**: se calculan al mostrar (RN-05). **Cada evento tiene un solo presupuesto** (decisión del PO, 06/10/2026): la aplicación lo crea junto con el evento y recalcular o modificar editan ese mismo presupuesto. En el modelo la relación sigue siendo de uno a muchos. |
| `LineaPresupuesto` | Servicio, descripción, cantidad, `modalidad` (`ModalidadServicio`), precio base congelado, precio unitario congelado (base + recargo), subtotal. `aCotizar` (booleano): la línea no tiene importe y no suma. El precio del salón va como una línea más, con servicio `null`, y es siempre la **primera** línea del presupuesto. Las demás líneas con servicio `null` son adicionales que el personal escribió a mano, con su descripción y su precio (HU-12). `horaEstimada` (texto `HH:mm`, nullable): a qué hora del evento se espera ese servicio, igual formato que `Evento.horaInicioEstimada`. La llevan los servicios y los adicionales, nunca la línea del salón. Si el evento ya tiene `inicio` y `fin`, la aplicación exige que caiga dentro (`422`); mientras está `EnConsulta` sin horario no hay contra qué validarla. |
| `ConfiguracionPrecios` | Fila única. `porcentajeMensual` (Decimal) editable por el Responsable de Eventos (RN-10). |
| `AjustePrecio` | Historial de aumentos: fecha, porcentaje, alcance (`Global` o un `servicioId`), si fue automático o manual, usuario. Sirve para auditar y para explicar por qué cambió un precio. |
| `Pago` | Evento, fecha, monto, medio de pago, observación (nullable). A diferencia del resto de los importes, el `monto` **no** es sin IVA (RN-05): es la plata entregada, y se mide contra la base de cobro de RN-01. |
| `MedioPago` | Efectivo, tarjeta, a la habitación. Baja lógica. |
| `AuditLog` | Usuario, fecha, entidad, id, valor anterior, valor nuevo. Inmutable. Usuario `null` cuando actúa el Sistema (`SYS`). Tabla `audit_log`. |

## Por qué `Usuario` y `Cliente` van separados

El cliente es a la vez una entidad de negocio con historial comercial y, desde el Sprint 2, una
credencial. Se mantienen separados para que los datos comerciales y el historial no dependan de
la cuenta. La relación es 1-1 opcional porque hay fichas sin usuario: las que el personal cargó en
el Sprint 1, antes de que se decidiera que los clientes solo se dan de alta registrándose en la
landing (`dominio.md`). Cuando esa persona se registra, el usuario nuevo se vincula a su ficha.

## No solapamiento de reservas

Un salón no puede tener dos eventos en la misma fecha y horario. Se valida en dos niveles:

1. En el servicio, para devolver un error legible que indique con qué evento se superpone.
2. En la base, con una restricción de exclusión que la aplicación no puede saltear:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Evento" ADD CONSTRAINT evento_sin_solapamiento
  EXCLUDE USING gist (
    "salonId" WITH =,
    tsrange("inicio", "fin") WITH &&
  ) WHERE (estado IN ('Reservado', 'Cobrado'));
```

El `WHERE` es importante: los eventos en `EnConsulta` **no** bloquean el salón, y los
`Cancelado` tampoco. Varias consultas pueden superponerse entre sí y con un evento reservado;
detectar esas consultas "en conflicto" (RN-12) es una consulta de la aplicación, no un dato
guardado.

Como `inicio` y `fin` son opcionales mientras el evento está en `EnConsulta`, la misma migración
agrega un CHECK que los exige en cualquier otro estado. Sin él, un `tsrange` con límites `NULL`
sería infinito y bloquearía el salón para siempre:

```sql
ALTER TABLE "Evento" ADD CONSTRAINT evento_horario_obligatorio
  CHECK (estado IN ('EnConsulta', 'Cancelado') OR ("inicio" IS NOT NULL AND "fin" IS NOT NULL));
```

Con el mismo criterio, desde ADR 0008 el salón también es obligatorio fuera de `EnConsulta` y
`Cancelado` (una consulta social llega sin salón), y el tipo social va solo en los eventos sociales:

```sql
ALTER TABLE "Evento" ADD CONSTRAINT evento_salon_obligatorio
  CHECK (estado IN ('EnConsulta', 'Cancelado') OR "salonId" IS NOT NULL);

ALTER TABLE "Evento" ADD CONSTRAINT evento_tipo_social
  CHECK (
    (tipo = 'Social') = ("tipoSocial" IS NOT NULL)
    AND ("tipoSocial" IS DISTINCT FROM 'Otro' OR "tipoSocialDetalle" IS NOT NULL)
  );
```

Prisma no genera restricciones de exclusión, así que va como SQL crudo dentro de una migración.

## Precios congelados y proyectados

`LineaPresupuesto` guarda el precio unitario al momento de emitir, no una referencia al precio
actual del servicio. Es lo que permite que un incremento mensual no altere presupuestos ya
emitidos (RN-03, HU-34). La seña congela definitivamente el presupuesto (`Confirmado`). Uno
`Expirado` se recalcula (toma los precios vigentes) o se modifica (conserva el precio de las líneas
que no se tocan): en los dos casos es el mismo presupuesto, que vuelve a `Estimado` con `venceEn`
reiniciado (HU-12).

Cuando el evento es en un mes futuro, el precio que se guarda en la línea es el **proyectado**
a ese mes (RN-13): `precio_actual × (1 + porcentajeMensual)^meses`, sin proyectar tercerizados.
La función vive en `packages/shared` para que el front (presupuesto dinámico) y la API calculen
exactamente lo mismo.

## Importes

Todos se almacenan **sin IVA** (RN-05). Usar `Decimal` de Prisma, nunca `Float`. La tasa del IVA
(21%) es una constante única en `packages/shared` (`TASA_IVA`); el IVA y el total se derivan del
subtotal al mostrar, en pantalla y en el PDF.

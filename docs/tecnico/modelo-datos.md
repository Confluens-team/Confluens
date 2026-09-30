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

enum TipoEvento {
  Social
  Empresarial
}
```

`Reservado` se muestra como "Confirmado" en pantallas y comunicaciones al cliente (ver
`dominio.md`), pero el valor del enum no cambia.

## Entidades

| Entidad | Notas |
|---|---|
| `Usuario` | Credenciales: email único, hash de contraseña, rol. **Separada de `Cliente`.** |
| `Cliente` | Datos comerciales: nombre, apellido (nullable, para razón social), teléfono, correo. Relación 1-1 opcional con `Usuario`. **No hay baja por inactividad**: `activo` no lo cambia ninguna tarea programada. En el autorregistro se crean juntos el `Usuario` (rol `CLIENTE`) y su `Cliente`. |
| `Salon` | Nombre, capacidad máxima, superficie, precio de referencia jornada completa y media jornada. Contenido de la landing (HU-08): `visibleEnLanding` (booleano, default `true`) y `fotoUrl` (nullable, URL externa: el sistema no almacena archivos). Un salón no visible sigue disponible para uso interno. |
| `Distribucion` | Pertenece a un salón. Nombre único por salón, capacidad ≤ capacidad del salón. |
| `Servicio` | Nombre único, descripción, unidad de medida, precio sin IVA, si se cobra por persona, si es tercerizado, activo. `precio` **nullable**: `null` significa "a cotizar" (solo tercerizados). `tercerizado` = lo provee un tercero: **entra en el total** del presupuesto pero **no recibe el incremento mensual**. `admiteModalidad` (booleano, default `false`; `true` en los coffee breaks): habilita elegir continuo o en mesa (RN-11). Contenido de la landing: `categoria` (nullable) y `fotoUrl` (nullable). |
| `Solicitud` | Consulta confirmada por el cliente en el canal público. `clienteId` nullable (las del Sprint 1 no tienen cliente; desde el Sprint 2 siempre lo tienen). Guarda los datos de contacto, fecha, horario (`inicio`/`fin`, nullable), cantidad de personas, `salonId` y `distribucionId` (nullable) y el subtotal estimado sin IVA que vio el cliente. Puede descartarse: `descartada` (booleano) y `eventoId` (nullable, 1-1) con el evento `EnConsulta` en que se convirtió. |
| `LineaSolicitud` | Lo que eligió el cliente, con la misma forma que `LineaPresupuesto` (servicio, cantidad, modalidad, precio unitario mostrado). Al convertir la solicitud en evento, estas líneas se copian al presupuesto `Estimado`. |
| `Evento` | Cliente, salón, distribución, fecha, horario desde/hasta (`inicio`/`fin`), cantidad de personas, estado, tipo de evento, modalidad salón-restaurante. El salón es obligatorio desde `EnConsulta`; la distribución y el horario pueden completarse después (ver restricciones). La jornada (media / completa) se deriva del horario: ≤ 4 h es media. |
| `Presupuesto` | Pertenece a un evento. Estado, `emitidoEn`, `venceEn` (= emisión + 10 días, RN-08), `subtotal` sin IVA. IVA y total **no se guardan**: se calculan al mostrar (RN-05). Un evento puede tener varios. |
| `LineaPresupuesto` | Servicio, descripción, cantidad, `modalidad` (`ModalidadServicio`), precio base congelado, precio unitario congelado (base + recargo), subtotal. `aCotizar` (booleano): la línea no tiene importe y no suma. El precio del salón va como una línea más, con servicio `null`. |
| `ConfiguracionPrecios` | Fila única. `porcentajeMensual` (Decimal) editable por el Responsable de Eventos (RN-10). |
| `AjustePrecio` | Historial de aumentos: fecha, porcentaje, alcance (`Global` o un `servicioId`), si fue automático o manual, usuario. Sirve para auditar y para explicar por qué cambió un precio. |
| `Pago` | Evento, fecha, monto, medio de pago. |
| `MedioPago` | Efectivo, tarjeta, a la habitación. Baja lógica. |
| `AuditLog` | Usuario, fecha, entidad, id, valor anterior, valor nuevo. Inmutable. Usuario `null` cuando actúa el Sistema (`SYS`). Tabla `audit_log`. |

## Por qué `Usuario` y `Cliente` van separados

El cliente es a la vez una entidad de negocio con historial comercial y, desde el Sprint 2, una
credencial. Si se unifican, cada cliente que el Responsable de Eventos carga a mano exige una
contraseña que nadie tiene. La relación es 1-1 opcional: hay clientes sin usuario, y el usuario
se crea recién cuando el cliente se registra en el canal público.

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

Prisma no genera restricciones de exclusión, así que va como SQL crudo dentro de una migración.

## Precios congelados y proyectados

`LineaPresupuesto` guarda el precio unitario al momento de emitir, no una referencia al precio
actual del servicio. Es lo que permite que un incremento mensual no altere presupuestos ya
emitidos (RN-03, HU-34). La seña congela definitivamente el presupuesto (`Confirmado`); uno
`Expirado` no se edita: se recalcula generando otro.

Cuando el evento es en un mes futuro, el precio que se guarda en la línea es el **proyectado**
a ese mes (RN-13): `precio_actual × (1 + porcentajeMensual)^meses`, sin proyectar tercerizados.
La función vive en `packages/shared` para que el front (presupuesto dinámico) y la API calculen
exactamente lo mismo.

## Importes

Todos se almacenan **sin IVA** (RN-05). Usar `Decimal` de Prisma, nunca `Float`. La tasa del IVA
(21%) es una constante única en `packages/shared` (`TASA_IVA`); el IVA y el total se derivan del
subtotal al mostrar, en pantalla y en el PDF.

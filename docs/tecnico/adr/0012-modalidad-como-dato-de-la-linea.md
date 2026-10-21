# ADR 0012 — La modalidad del servicio es un dato de la línea, no un servicio aparte

**Fecha:** 2026-10 · **Estado:** aceptada

## Contexto

RN-11 define un recargo opcional por servicio: continuo en salón (+20%) o en mesas con mozo (+30%),
sobre el precio base por persona y sin IVA. Hoy lo admiten los coffee breaks. En el Sprint 1 no
existía dónde guardar qué modalidad eligió el cliente, así que el seed cargó cada coffee tres veces
en el catálogo: el base y dos variantes con el recargo ya sumado al precio («Coffee Refresh —
continuo en salón», «Coffee Refresh — en mesas con mozo»). Son diez servicios de más.

HU-24 (reutilizar la configuración de un evento) pide copiar la modalidad de cada servicio con los
precios vigentes, y el PO decidió el 16/10/2026 que la modalidad se construye en el Sprint 3: se
elige en el cotizador y al armar o modificar el presupuesto. Con las variantes, un aumento de precio
hay que cargarlo tres veces por coffee, y el recargo no se puede recalcular sobre un precio nuevo
porque no se sabe cuál era el base.

## Decisión

La modalidad (`ModalidadServicio`: `Normal`, `Continuo`, `EnMesa`) es una columna de
`LineaPresupuesto`, junto con `precioBase`, el precio antes del recargo, también congelado.
`precioUnitario` sigue siendo el precio final de la línea (base + recargo). `Servicio.admiteModalidad`
dice qué servicios la ofrecen.

La migración `modalidad_y_configuracion_precios` marca los coffees base con `admiteModalidad`, da
de baja lógica las diez variantes y convierte las líneas que las usaban: pasan al coffee base con la
modalidad que tenían incluida y el mismo precio final.

Un mismo servicio puede aparecer más de una vez en un presupuesto si cada línea tiene una modalidad
distinta (un coffee normal a la mañana y uno continuo a la tarde; decisión del equipo, 16/10/2026).
Lo que S-09 deja abierto es si **una** línea puede llevar los dos recargos: hasta resolverlo, una
sola modalidad por línea.

## Consecuencias

**A favor.** Un solo precio por coffee en el catálogo. El recargo se calcula siempre sobre el base,
así que reutilizar un evento o recalcular un presupuesto vencido aplica el recargo al precio
vigente. El cálculo (`aplicarModalidad`) vive en `@confluens/shared` y lo hacen igual la web y la
API.

**En contra.** La unicidad del servicio dentro de un presupuesto pasa a ser por servicio y
modalidad, y modificar un presupuesto tiene que emparejar cada servicio con su línea anterior por
los dos datos. Las variantes quedan en la base, dadas de baja, por si algo las referencia.

**Alternativas descartadas.** Mantener las variantes como servicios: no permite recalcular el
recargo sobre un precio nuevo ni elegir la modalidad con un selector, como pidió el PO. Dejar las
líneas viejas apuntando a las variantes: al reutilizar esos eventos el coffee quedaría afuera por
ser un servicio inactivo.

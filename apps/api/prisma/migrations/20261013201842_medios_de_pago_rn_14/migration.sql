-- Catálogo de medios de pago de RN-14. Va en una migración y no solo en el seed porque el deploy
-- corre `prisma migrate deploy` pero nunca `prisma db seed` (render.yaml): sin esto, el ambiente
-- desplegado se queda con los tres medios de la versión anterior y el desplegable de cobro muestra
-- solo Efectivo, porque la web descarta los medios que la base no tiene cargados.

-- Alta de los medios que faltaban. Idempotente: si alguien ya corrió el seed, no los duplica.
-- `nombre` es UNIQUE, así que ON CONFLICT alcanza. No reactiva ni renombra lo que ya está: un medio
-- dado de baja a propósito sigue de baja (mismo criterio que `cargarMediosPago` en el seed).
INSERT INTO "MedioPago" ("nombre", "activo", "creadoEn", "actualizadoEn")
VALUES
  ('Efectivo',       true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('Transferencia',  true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('Débito',         true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('Crédito',        true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('Cheque',         true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A la habitación', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("nombre") DO NOTHING;

-- Baja lógica de «Tarjeta», que RN-14 reemplaza por Débito y Crédito. Es baja lógica y no DELETE
-- porque `Pago.medioPagoId` lo referencia con ON DELETE RESTRICT: los pagos ya registrados con
-- Tarjeta quedan intactos y se siguen mostrando en el historial del evento, porque la consulta de
-- pagos trae el medio por la FK sin filtrar por `activo`. Lo que cambia es que deja de ofrecerse y
-- de aceptarse en un cobro nuevo.
UPDATE "MedioPago"
   SET "activo" = false, "actualizadoEn" = CURRENT_TIMESTAMP
 WHERE "nombre" = 'Tarjeta' AND "activo" = true;

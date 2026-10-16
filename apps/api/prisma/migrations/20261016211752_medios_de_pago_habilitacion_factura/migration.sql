-- HU-19 (decisión del PO, 16/10/2026): cada medio de pago dice si se puede usar en un cobro con
-- factura, sin factura o en los dos casos, y RN-14 pasa a leer estas marcas en lugar de una lista
-- fija en código. Nacen en false y abajo se cargan las del catálogo actual.
ALTER TABLE "MedioPago" ADD COLUMN     "conFactura" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sinFactura" BOOLEAN NOT NULL DEFAULT false;

-- Los seis medios de RN-14 con la misma habilitación que tenían en código: Efectivo, Transferencia
-- y A la habitación en los dos casos; Débito, Crédito y Cheque solo con factura. Por nombre, porque
-- los ids cambian entre entornos (los cargó la migración 20261013201842_medios_de_pago_rn_14).
-- «Tarjeta» queda como está: dada de baja y sin habilitar, así no se ofrece aunque se reactive.
UPDATE "MedioPago"
   SET "conFactura" = true, "sinFactura" = true
 WHERE "nombre" IN ('Efectivo', 'Transferencia', 'A la habitación');

UPDATE "MedioPago"
   SET "conFactura" = true
 WHERE "nombre" IN ('Débito', 'Crédito', 'Cheque');

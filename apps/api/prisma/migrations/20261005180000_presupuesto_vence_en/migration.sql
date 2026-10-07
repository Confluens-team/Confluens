-- HU-10 / RN-08: vigencia de 10 días desde la emisión.
-- Los presupuestos que ya existen toman su vencimiento de la fecha de emisión.
ALTER TABLE "Presupuesto" ADD COLUMN "venceEn" TIMESTAMP(3);

UPDATE "Presupuesto" SET "venceEn" = "fechaEmision" + INTERVAL '10 days';

ALTER TABLE "Presupuesto" ALTER COLUMN "venceEn" SET NOT NULL;

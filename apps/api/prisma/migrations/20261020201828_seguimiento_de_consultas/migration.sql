-- AlterTable
ALTER TABLE "Presupuesto" ADD COLUMN     "avisoRecepcionEn" TIMESTAMP(3),
ADD COLUMN     "envioFormalEn" TIMESTAMP(3);

-- Las consultas que ya existían se dan por avisadas: el cartel «Nuevo» es para las que entren de
-- acá en adelante (decisión de Franco, 20/10/2026).
UPDATE "Presupuesto" SET "avisoRecepcionEn" = "fechaEmision";

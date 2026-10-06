-- HU-11: un servicio tercerizado puede no tener precio fijo ("a cotizar", dominio.md).
ALTER TABLE "Servicio" ALTER COLUMN "precio" DROP NOT NULL;

-- Solo un tercerizado puede quedar sin precio.
ALTER TABLE "Servicio" ADD CONSTRAINT "servicio_a_cotizar_solo_tercerizado"
  CHECK ("precio" IS NOT NULL OR "tercerizado");

-- La línea de un servicio a cotizar va sin importe y no suma al total.
ALTER TABLE "LineaPresupuesto" ADD COLUMN "aCotizar" BOOLEAN NOT NULL DEFAULT false;

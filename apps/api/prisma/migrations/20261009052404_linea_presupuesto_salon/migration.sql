-- AlterTable
ALTER TABLE "LineaPresupuesto" ADD COLUMN     "salonId" INTEGER;

-- AddForeignKey
ALTER TABLE "LineaPresupuesto" ADD CONSTRAINT "LineaPresupuesto_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "Salon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: hasta ahora la línea del salón era la primera de cada presupuesto sin servicioId, y el
-- salón al que correspondía era el del evento. Se le pone el salonId que le faltaba; las demás
-- líneas sin servicioId son adicionales escritos a mano y quedan en NULL, que es lo correcto.
UPDATE "LineaPresupuesto" lp
   SET "salonId" = e."salonId"
  FROM "Presupuesto" p
  JOIN "Evento" e ON e.id = p."eventoId"
 WHERE lp."presupuestoId" = p.id
   AND e."salonId" IS NOT NULL
   AND lp."servicioId" IS NULL
   AND lp.id = (
     SELECT MIN(primera.id) FROM "LineaPresupuesto" primera
      WHERE primera."presupuestoId" = p.id AND primera."servicioId" IS NULL
   );

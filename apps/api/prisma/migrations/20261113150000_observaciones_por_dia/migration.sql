-- Observaciones por día (HU-50): cada día de un evento puede tener las suyas.
-- AlterTable
ALTER TABLE "EventoDia" ADD COLUMN     "observaciones" TEXT;

-- Las observaciones que el evento ya tenía pasan a su primer día (los eventos de un solo día no
-- cambian). Evento.observaciones queda sin uso: no se borra acá (expand / contract, ADR 0014).
UPDATE "EventoDia" AS d
SET "observaciones" = e."observaciones"
FROM "Evento" AS e
WHERE d."eventoId" = e."id"
  AND e."observaciones" IS NOT NULL
  AND d."fecha" = (SELECT MIN(p."fecha") FROM "EventoDia" AS p WHERE p."eventoId" = e."id");

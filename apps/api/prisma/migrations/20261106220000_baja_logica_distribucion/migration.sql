-- HU-25 del Sprint 4: baja lógica de una distribución (PO, 06/11/2026). Dada de baja no se ofrece
-- al presupuestar ni al agendar; los eventos que ya la tienen no cambian. Las existentes quedan activas.

-- AlterTable
ALTER TABLE "Distribucion" ADD COLUMN     "activo" BOOLEAN NOT NULL DEFAULT true;

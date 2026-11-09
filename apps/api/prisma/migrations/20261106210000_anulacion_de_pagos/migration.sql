-- HU-35 del Sprint 4: un pago registrado por error se anula sin borrarlo. Se guarda cuándo y quién
-- lo anuló (PO, 06/11/2026); el pago anulado deja de sumar a lo abonado y al saldo.

-- AlterTable
ALTER TABLE "Pago" ADD COLUMN     "anuladoEn" TIMESTAMP(3),
ADD COLUMN     "anuladoPorId" INTEGER;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_anuladoPorId_fkey" FOREIGN KEY ("anuladoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Prisma no modela CHECK, así que va como SQL crudo: una anulación lleva siempre la fecha y el
-- usuario, o ninguno de los dos.
ALTER TABLE "Pago" ADD CONSTRAINT "pago_anulacion_completa"
  CHECK (("anuladoEn" IS NULL) = ("anuladoPorId" IS NULL));

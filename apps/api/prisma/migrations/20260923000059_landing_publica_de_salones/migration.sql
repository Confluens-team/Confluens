-- AlterTable
ALTER TABLE "Salon" ADD COLUMN     "fotoUrl" TEXT,
ADD COLUMN     "visibleEnLanding" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Servicio" ADD COLUMN     "categoria" TEXT,
ADD COLUMN     "fotoUrl" TEXT;

-- AlterTable
ALTER TABLE "Solicitud" ADD COLUMN     "salonId" INTEGER;

-- AddForeignKey
ALTER TABLE "Solicitud" ADD CONSTRAINT "Solicitud_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "Salon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Cliente" ADD COLUMN     "etiquetaId" INTEGER;

-- CreateTable
CREATE TABLE "Etiqueta" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Etiqueta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Etiqueta_nombre_key" ON "Etiqueta"("nombre");

-- AddForeignKey
ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_etiquetaId_fkey" FOREIGN KEY ("etiquetaId") REFERENCES "Etiqueta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

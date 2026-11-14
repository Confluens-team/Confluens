-- Estado de conexión del personal: la última actividad de cada usuario.
-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "ultimaActividad" TIMESTAMP(3);

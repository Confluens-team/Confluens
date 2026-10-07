-- Tipo de evento social o corporativo (ADR 0008). Una consulta social llega sin salón y con un
-- presupuesto sin armar (venceEn NULL) que carga el Responsable de Eventos.
-- Los eventos existentes quedan Corporativo por el default.

-- CreateEnum
CREATE TYPE "TipoEvento" AS ENUM ('Social', 'Corporativo');

-- CreateEnum
CREATE TYPE "TipoEventoSocial" AS ENUM ('Cumpleanos', 'Casamiento', 'FiestaDeQuince', 'Bautismo', 'FiestaCorporativa', 'Otro');

-- CreateEnum
CREATE TYPE "TipoJornada" AS ENUM ('completa', 'media');

-- AlterTable
ALTER TABLE "Evento" ADD COLUMN     "horaInicioEstimada" TEXT,
ADD COLUMN     "tipo" "TipoEvento" NOT NULL DEFAULT 'Corporativo',
ADD COLUMN     "tipoJornada" "TipoJornada",
ADD COLUMN     "tipoSocial" "TipoEventoSocial",
ADD COLUMN     "tipoSocialDetalle" TEXT,
ALTER COLUMN "salonId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Presupuesto" ALTER COLUMN "venceEn" DROP NOT NULL;

-- El salón puede faltar solo mientras el evento está EnConsulta (y si se cancela desde ahí): para
-- reservar hace falta, igual que el horario (evento_horario_obligatorio).
ALTER TABLE "Evento" ADD CONSTRAINT evento_salon_obligatorio
  CHECK (estado IN ('EnConsulta', 'Cancelado') OR "salonId" IS NOT NULL);

-- El tipo social va solo en los eventos sociales, y "Otro" lleva su detalle.
ALTER TABLE "Evento" ADD CONSTRAINT evento_tipo_social
  CHECK (
    (tipo = 'Social') = ("tipoSocial" IS NOT NULL)
    AND ("tipoSocial" IS DISTINCT FROM 'Otro' OR "tipoSocialDetalle" IS NOT NULL)
  );

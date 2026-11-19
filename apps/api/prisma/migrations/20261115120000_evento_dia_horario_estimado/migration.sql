-- Horario estimado por día (HU-50, S-16): en el cotizador, el cliente indica la hora de inicio y de
-- fin de cada día de su evento. Es de referencia, como Evento.horaInicioEstimada: el horario real
-- sigue en EventoDia.inicio/fin. Los días que ya existen quedan sin horario estimado propio.
-- AlterTable
ALTER TABLE "EventoDia" ADD COLUMN     "horaFinEstimada" TEXT,
ADD COLUMN     "horaInicioEstimada" TEXT;

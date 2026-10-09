-- ---------------------------------------------------------------------------
-- Varios salones por evento, parte 4: contract (ADR 0011).
-- Evento deja de tener salón y distribución propios: viven en EventoSalon desde la migración
-- 20261009044221_evento_en_varios_salones. No editar esta migración una vez aplicada.
-- ---------------------------------------------------------------------------

-- Antes de borrar se verificó contra la base que no se pierde nada: cada Evento.salonId tiene su
-- renglón en EventoSalon y cada Evento.distribucionId está en el renglón de su salón.

-- El CHECK que exigía salón para reservar dependía de Evento.salonId. No se pierde la garantía:
-- la reemplaza el constraint trigger de abajo, que mira EventoSalon.
ALTER TABLE "Evento" DROP CONSTRAINT evento_salon_obligatorio;

-- DropForeignKey
ALTER TABLE "Evento" DROP CONSTRAINT "Evento_distribucionId_fkey";

-- DropForeignKey
ALTER TABLE "Evento" DROP CONSTRAINT "Evento_salonId_fkey";

-- AlterTable
ALTER TABLE "Evento" DROP COLUMN "distribucionId",
DROP COLUMN "salonId";

-- Un evento Reservado o Cobrado ocupa al menos un salón. Lo que antes era un CHECK sobre
-- Evento.salonId ahora tiene que mirar otra tabla, y un CHECK no puede: va como constraint trigger.
--
-- Es DEFERRABLE INITIALLY DEFERRED a propósito: se evalúa al cerrar la transacción y no fila por
-- fila. Reemplazar los salones de un evento borra los que se van y crea los nuevos en la misma
-- transacción, y en el medio el evento puede quedar un instante sin ninguno; lo que importa es
-- cómo queda al final.
CREATE OR REPLACE FUNCTION evento_reservado_con_salon() RETURNS trigger AS $$
DECLARE
  id_evento integer;
  estado_evento "EstadoEvento";
BEGIN
  IF TG_TABLE_NAME = 'Evento' THEN
    id_evento := NEW.id;
  ELSE
    id_evento := OLD."eventoId";
  END IF;

  SELECT e.estado INTO estado_evento FROM "Evento" e WHERE e.id = id_evento;

  -- Si el evento ya no existe (se borró y se llevó sus salones en cascada) no hay nada que mirar.
  IF estado_evento IN ('Reservado', 'Cobrado')
     AND NOT EXISTS (SELECT 1 FROM "EventoSalon" es WHERE es."eventoId" = id_evento) THEN
    RAISE EXCEPTION 'El evento % está % y no tiene ningún salón', id_evento, estado_evento
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Un evento que pasa a Reservado o Cobrado sin salones.
CREATE CONSTRAINT TRIGGER evento_reservado_con_salon
  AFTER INSERT OR UPDATE OF estado ON "Evento"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION evento_reservado_con_salon();

-- Sacarle el último salón a un evento que ya está Reservado o Cobrado.
CREATE CONSTRAINT TRIGGER evento_salon_no_deja_reservado_sin_salon
  AFTER DELETE ON "EventoSalon"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION evento_reservado_con_salon();

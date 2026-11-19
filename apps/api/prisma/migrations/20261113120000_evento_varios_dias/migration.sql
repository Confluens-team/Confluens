-- HU-50 parte 1 (docs/tecnico/adr/0014-evento-de-varios-dias-con-dias-propios.md): un evento tiene
-- de 1 a 32 días consecutivos, cada uno con su horario, jornada, personas y salones. Prisma no genera
-- triggers ni restricciones de exclusión: van como SQL crudo. No editar esta migración una vez aplicada.
--
-- Orden (expand / contract en una sola migración): se crea EventoDia y se le copia un día por evento;
-- se agrega diaId a EventoSalon y LineaPresupuesto y se completa MIENTRAS siguen los triggers viejos;
-- recién ahí se cambian los triggers, se cierran las claves y se agregan las reglas por día.

-- ---------------------------------------------------------------------------------------------
-- 1. EventoDia, con un día por cada evento que ya existe
-- ---------------------------------------------------------------------------------------------

CREATE TABLE "EventoDia" (
    "id" SERIAL NOT NULL,
    "eventoId" INTEGER NOT NULL,
    "fecha" DATE NOT NULL,
    "inicio" TIMESTAMP(3),
    "fin" TIMESTAMP(3),
    "tipoJornada" "TipoJornada",
    "cantidadPersonas" INTEGER NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventoDia_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EventoDia_eventoId_idx" ON "EventoDia"("eventoId");
CREATE UNIQUE INDEX "EventoDia_eventoId_fecha_key" ON "EventoDia"("eventoId", "fecha");

ALTER TABLE "EventoDia" ADD CONSTRAINT "EventoDia_eventoId_fkey"
  FOREIGN KEY ("eventoId") REFERENCES "Evento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Todos los eventos de hoy son de un solo día: su único día toma lo que hoy tiene el evento.
INSERT INTO "EventoDia" ("eventoId", "fecha", "inicio", "fin", "tipoJornada", "cantidadPersonas",
                         "creadoEn", "actualizadoEn")
SELECT e.id, e."fecha", e."inicio", e."fin", e."tipoJornada", e."cantidadPersonas",
       e."creadoEn", CURRENT_TIMESTAMP
  FROM "Evento" e;

-- ---------------------------------------------------------------------------------------------
-- 2. diaId en EventoSalon y LineaPresupuesto (nullable hasta completarlo)
-- ---------------------------------------------------------------------------------------------

ALTER TABLE "EventoSalon" ADD COLUMN "diaId" INTEGER;
ALTER TABLE "LineaPresupuesto" ADD COLUMN "diaId" INTEGER;

-- Con los triggers viejos todavía en pie: copian del evento lo mismo que ya tiene, sin cambiar nada.
UPDATE "EventoSalon" es
   SET "diaId" = d."id"
  FROM "EventoDia" d
 WHERE d."eventoId" = es."eventoId";

UPDATE "LineaPresupuesto" lp
   SET "diaId" = d."id"
  FROM "Presupuesto" p
  JOIN "EventoDia" d ON d."eventoId" = p."eventoId"
 WHERE lp."presupuestoId" = p."id";

-- ---------------------------------------------------------------------------------------------
-- 3. Evento.fechaFin: el último día. Hoy, igual a la fecha.
-- ---------------------------------------------------------------------------------------------

ALTER TABLE "Evento" ADD COLUMN "fechaFin" DATE NOT NULL DEFAULT CURRENT_DATE;
UPDATE "Evento" SET "fechaFin" = "fecha";

-- Al crear el evento la fecha de fin es la de inicio; después la recalcula el resumen de sus días.
CREATE OR REPLACE FUNCTION evento_fecha_fin_al_crear() RETURNS trigger AS $$
BEGIN
  NEW."fechaFin" := NEW."fecha";
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER evento_fecha_fin_al_crear
  BEFORE INSERT ON "Evento"
  FOR EACH ROW EXECUTE FUNCTION evento_fecha_fin_al_crear();

-- ---------------------------------------------------------------------------------------------
-- 4. El horario de EventoSalon es el del DÍA; el estado, el del evento (reemplaza a ADR 0011)
-- ---------------------------------------------------------------------------------------------

DROP TRIGGER evento_propaga_horario ON "Evento";
DROP FUNCTION evento_propaga_horario();

-- Al insertar o actualizar un renglón, inicio y fin se toman del día y el estado del evento, pase lo
-- que pase. eventoId también sale del día: no puede discrepar con él.
CREATE OR REPLACE FUNCTION evento_salon_copia_horario() RETURNS trigger AS $$
BEGIN
  SELECT d."eventoId", d."inicio", d."fin"
    INTO NEW."eventoId", NEW."inicio", NEW."fin"
    FROM "EventoDia" d
   WHERE d."id" = NEW."diaId";
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El día % no existe', NEW."diaId" USING ERRCODE = 'foreign_key_violation';
  END IF;
  SELECT e."estado" INTO NEW."estado" FROM "Evento" e WHERE e."id" = NEW."eventoId";
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Cuando el evento cambia de estado, se propaga a los salones de todos sus días.
CREATE OR REPLACE FUNCTION evento_propaga_estado() RETURNS trigger AS $$
BEGIN
  UPDATE "EventoSalon"
     SET "estado" = NEW."estado"
   WHERE "eventoId" = NEW."id" AND "estado" IS DISTINCT FROM NEW."estado";
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER evento_propaga_estado
  AFTER UPDATE OF "estado" ON "Evento"
  FOR EACH ROW EXECUTE FUNCTION evento_propaga_estado();

-- Cuando un día cambia de horario, se propaga a los salones de ESE día, no a los de los demás.
CREATE OR REPLACE FUNCTION evento_dia_propaga_horario() RETURNS trigger AS $$
BEGIN
  UPDATE "EventoSalon"
     SET "inicio" = NEW."inicio", "fin" = NEW."fin"
   WHERE "diaId" = NEW."id"
     AND ("inicio" IS DISTINCT FROM NEW."inicio" OR "fin" IS DISTINCT FROM NEW."fin");
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER evento_dia_propaga_horario
  AFTER UPDATE OF "inicio", "fin" ON "EventoDia"
  FOR EACH ROW EXECUTE FUNCTION evento_dia_propaga_horario();

-- ---------------------------------------------------------------------------------------------
-- 5. Claves: diaId obligatorio, EventoSalon por (día, salón) y el no solapamiento por día
-- ---------------------------------------------------------------------------------------------

ALTER TABLE "EventoSalon" ALTER COLUMN "diaId" SET NOT NULL;
ALTER TABLE "EventoSalon" DROP CONSTRAINT "EventoSalon_pkey";
ALTER TABLE "EventoSalon" ADD CONSTRAINT "EventoSalon_pkey" PRIMARY KEY ("diaId", "salonId");
CREATE INDEX "EventoSalon_eventoId_idx" ON "EventoSalon"("eventoId");
ALTER TABLE "EventoSalon" ADD CONSTRAINT "EventoSalon_diaId_fkey"
  FOREIGN KEY ("diaId") REFERENCES "EventoDia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LineaPresupuesto" ALTER COLUMN "diaId" SET NOT NULL;
ALTER TABLE "LineaPresupuesto" ADD CONSTRAINT "LineaPresupuesto_diaId_fkey"
  FOREIGN KEY ("diaId") REFERENCES "EventoDia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RN-12 por día y por salón: EventoSalon ahora tiene una fila por día y por salón, con el horario de
-- ESE día, así que la restricción es la misma de siempre. Se agrega "eventoId" WITH <> para que las
-- filas de un mismo evento nunca choquen entre sí (un día que pasa la medianoche, o correr una franja
-- reservada menos días de los que dura): el solapamiento es siempre contra OTRO evento. EnConsulta y
-- Cancelado no bloquean el salón. No es DEFERRABLE a propósito: el choque se informa en el momento.
-- Un renglón Reservado o Cobrado tiene horario: un tsrange con límites NULL es infinito y la restricción
-- de exclusión bloquearía el salón para siempre. Antes lo garantizaba el CHECK de Evento, pero ahora
-- ese CHECK solo mira el primer y el último día: hay que pedirlo en cada renglón, o sea en cada día.
ALTER TABLE "EventoSalon" ADD CONSTRAINT evento_salon_horario_obligatorio
  CHECK ("estado" NOT IN ('Reservado', 'Cobrado') OR ("inicio" IS NOT NULL AND "fin" IS NOT NULL));

ALTER TABLE "EventoSalon" DROP CONSTRAINT evento_salon_sin_solapamiento;
ALTER TABLE "EventoSalon" ADD CONSTRAINT evento_salon_sin_solapamiento
  EXCLUDE USING gist (
    "salonId" WITH =,
    tsrange("inicio", "fin") WITH &&,
    "eventoId" WITH <>
  ) WHERE ("estado" IN ('Reservado', 'Cobrado'));

-- ---------------------------------------------------------------------------------------------
-- 6. El resumen de Evento lo calculan sus días; la aplicación escribe los días (ADR 0014)
-- ---------------------------------------------------------------------------------------------

-- fecha = primer día, fechaFin = último, inicio = inicio del primero, fin = fin del último,
-- cantidadPersonas = el máximo de los días, tipoJornada = la del primero. Solo escribe si cambia algo.
CREATE OR REPLACE FUNCTION evento_resumen_desde_dias(id_evento integer) RETURNS void AS $$
BEGIN
  PERFORM set_config('confluens.resumen_de_dias', 'on', true);
  UPDATE "Evento" e
     SET "fecha" = r."fecha",
         "fechaFin" = r."fechaFin",
         "inicio" = r."inicio",
         "fin" = r."fin",
         "cantidadPersonas" = r."personas",
         "tipoJornada" = r."jornada"
    FROM (
      SELECT min(d."fecha") AS "fecha",
             max(d."fecha") AS "fechaFin",
             (array_agg(d."inicio" ORDER BY d."fecha" ASC))[1] AS "inicio",
             (array_agg(d."fin" ORDER BY d."fecha" DESC))[1] AS "fin",
             max(d."cantidadPersonas") AS "personas",
             (array_agg(d."tipoJornada" ORDER BY d."fecha" ASC))[1] AS "jornada"
        FROM "EventoDia" d
       WHERE d."eventoId" = id_evento
    ) r
   WHERE e."id" = id_evento
     AND r."fecha" IS NOT NULL
     AND (e."fecha", e."fechaFin", e."inicio", e."fin", e."cantidadPersonas", e."tipoJornada")
         IS DISTINCT FROM (r."fecha", r."fechaFin", r."inicio", r."fin", r."personas", r."jornada");
  PERFORM set_config('confluens.resumen_de_dias', 'off', true);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION evento_dia_actualiza_resumen() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM evento_resumen_desde_dias(OLD."eventoId");
  ELSE
    PERFORM evento_resumen_desde_dias(NEW."eventoId");
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER evento_dia_actualiza_resumen
  AFTER INSERT OR UPDATE OR DELETE ON "EventoDia"
  FOR EACH ROW EXECUTE FUNCTION evento_dia_actualiza_resumen();

-- Guarda: el resumen no se escribe a mano. Si algún camino de la aplicación lo intentara, falla en voz
-- alta la primera vez que corre contra una base real, y no desincroniza en silencio.
CREATE OR REPLACE FUNCTION evento_resumen_no_se_escribe() RETURNS trigger AS $$
BEGIN
  IF (NEW."fecha", NEW."fechaFin", NEW."inicio", NEW."fin", NEW."cantidadPersonas", NEW."tipoJornada")
       IS DISTINCT FROM
     (OLD."fecha", OLD."fechaFin", OLD."inicio", OLD."fin", OLD."cantidadPersonas", OLD."tipoJornada")
     AND COALESCE(current_setting('confluens.resumen_de_dias', true), 'off') <> 'on' THEN
    RAISE EXCEPTION 'El resumen del evento % lo calculan sus días (EventoDia): hay que escribir el día', NEW."id"
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER evento_resumen_no_se_escribe
  BEFORE UPDATE ON "Evento"
  FOR EACH ROW EXECUTE FUNCTION evento_resumen_no_se_escribe();

-- ---------------------------------------------------------------------------------------------
-- 7. Reglas por día, diferidas al cerrar la transacción (constraint triggers)
-- ---------------------------------------------------------------------------------------------

-- Un evento tiene de 1 a 32 días y son consecutivos: sin días libres en el medio.
CREATE OR REPLACE FUNCTION evento_dias_consecutivos() RETURNS trigger AS $$
DECLARE
  id_evento integer;
  cantidad integer;
  primero date;
  ultimo date;
BEGIN
  IF TG_TABLE_NAME = 'Evento' THEN
    id_evento := NEW."id";
  ELSIF TG_OP = 'DELETE' THEN
    id_evento := OLD."eventoId";
  ELSE
    id_evento := NEW."eventoId";
  END IF;

  -- Si el evento ya no existe (se borró y se llevó sus días en cascada) no hay nada que mirar.
  IF NOT EXISTS (SELECT 1 FROM "Evento" e WHERE e."id" = id_evento) THEN
    RETURN NULL;
  END IF;

  SELECT count(*), min(d."fecha"), max(d."fecha") INTO cantidad, primero, ultimo
    FROM "EventoDia" d WHERE d."eventoId" = id_evento;

  IF cantidad = 0 THEN
    RAISE EXCEPTION 'El evento % tiene que tener al menos un día', id_evento
      USING ERRCODE = 'check_violation';
  END IF;
  IF cantidad > 32 THEN
    RAISE EXCEPTION 'El evento % tiene % días: el máximo es 32', id_evento, cantidad
      USING ERRCODE = 'check_violation';
  END IF;
  IF (ultimo - primero) + 1 <> cantidad THEN
    RAISE EXCEPTION 'Los días del evento % no son consecutivos', id_evento
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER evento_dias_consecutivos
  AFTER INSERT ON "Evento"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION evento_dias_consecutivos();

CREATE CONSTRAINT TRIGGER evento_dia_dias_consecutivos
  AFTER INSERT OR UPDATE OF "fecha" OR DELETE ON "EventoDia"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION evento_dias_consecutivos();

-- Un evento Reservado o Cobrado tiene horario y al menos un salón EN CADA DÍA. Reemplaza al control
-- de un solo salón de 20261009070000: sigue diferido, porque reemplazar los salones borra los que se
-- van y crea los nuevos en la misma transacción, y en el medio el día puede quedar sin ninguno.
CREATE OR REPLACE FUNCTION evento_reservado_con_salon() RETURNS trigger AS $$
DECLARE
  id_evento integer;
  estado_evento "EstadoEvento";
  dia record;
BEGIN
  IF TG_TABLE_NAME = 'Evento' THEN
    id_evento := NEW."id";
  ELSIF TG_TABLE_NAME = 'EventoDia' THEN
    id_evento := NEW."eventoId";
  ELSE
    id_evento := OLD."eventoId";
  END IF;

  SELECT e."estado" INTO estado_evento FROM "Evento" e WHERE e."id" = id_evento;

  -- Si el evento ya no existe (se borró y se llevó sus días y salones en cascada) no hay nada que mirar.
  IF estado_evento IN ('Reservado', 'Cobrado') THEN
    FOR dia IN
      SELECT d."id", d."fecha", d."inicio", d."fin" FROM "EventoDia" d WHERE d."eventoId" = id_evento
    LOOP
      IF dia."inicio" IS NULL OR dia."fin" IS NULL THEN
        RAISE EXCEPTION 'El evento % está % y el día % no tiene horario', id_evento, estado_evento, dia."fecha"
          USING ERRCODE = 'check_violation';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM "EventoSalon" es WHERE es."diaId" = dia."id") THEN
        RAISE EXCEPTION 'El evento % está % y el día % no tiene ningún salón', id_evento, estado_evento, dia."fecha"
          USING ERRCODE = 'check_violation';
      END IF;
    END LOOP;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Un día nuevo, o con otro horario, de un evento que ya está Reservado o Cobrado.
CREATE CONSTRAINT TRIGGER evento_dia_reservado_con_salon
  AFTER INSERT OR UPDATE OF "inicio", "fin" ON "EventoDia"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION evento_reservado_con_salon();

-- ---------------------------------------------------------------------------------------------
-- 8. Verificación de la migración: cada evento tiene exactamente un día y nada quedó sin día
-- ---------------------------------------------------------------------------------------------

DO $$
DECLARE
  eventos integer;
  dias integer;
BEGIN
  SELECT count(*) INTO eventos FROM "Evento";
  SELECT count(*) INTO dias FROM "EventoDia";
  IF eventos <> dias THEN
    RAISE EXCEPTION 'La migración de HU-50 dejó % eventos y % días', eventos, dias;
  END IF;
  IF EXISTS (SELECT 1 FROM "EventoSalon" WHERE "diaId" IS NULL)
     OR EXISTS (SELECT 1 FROM "LineaPresupuesto" WHERE "diaId" IS NULL) THEN
    RAISE EXCEPTION 'La migración de HU-50 dejó renglones sin día';
  END IF;
END $$;

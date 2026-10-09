-- CreateTable
CREATE TABLE "EventoSalon" (
    "eventoId" INTEGER NOT NULL,
    "salonId" INTEGER NOT NULL,
    "distribucionId" INTEGER,
    "inicio" TIMESTAMP(3),
    "fin" TIMESTAMP(3),
    "estado" "EstadoEvento" NOT NULL DEFAULT 'EnConsulta',
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventoSalon_pkey" PRIMARY KEY ("eventoId","salonId")
);

-- CreateIndex
CREATE INDEX "EventoSalon_salonId_idx" ON "EventoSalon"("salonId");

-- AddForeignKey
ALTER TABLE "EventoSalon" ADD CONSTRAINT "EventoSalon_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "Evento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoSalon" ADD CONSTRAINT "EventoSalon_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "Salon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoSalon" ADD CONSTRAINT "EventoSalon_distribucionId_fkey" FOREIGN KEY ("distribucionId") REFERENCES "Distribucion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Un evento puede ocupar varios salones (docs/tecnico/modelo-datos.md, ADR 0011).
-- Prisma no genera triggers ni restricciones de exclusión: van como SQL crudo.
-- No editar esta migración una vez aplicada.
-- ---------------------------------------------------------------------------

-- Los eventos que ya existen pasan a tener un renglón con su salón actual. Evento.salonId sigue
-- existiendo durante la migración: se borra en una migración posterior, cuando la aplicación ya
-- no lo lea (expand/contract).
INSERT INTO "EventoSalon" ("eventoId", "salonId", "distribucionId", "inicio", "fin", "estado")
SELECT id, "salonId", "distribucionId", "inicio", "fin", estado
FROM "Evento"
WHERE "salonId" IS NOT NULL;

-- inicio, fin y estado de EventoSalon son copia de los del evento. Se mantienen con triggers y no
-- desde la aplicación: el estado cambia al registrar un pago, al cancelar y al modificar el
-- presupuesto, y si cada camino tuviera que acordarse de sincronizar, el día que se agregue uno
-- nuevo la base dejaría de garantizar el no solapamiento sin que nadie se entere.

-- Al insertar o actualizar un renglón, las tres columnas se toman del evento, pase lo que pase.
CREATE OR REPLACE FUNCTION evento_salon_copia_horario() RETURNS trigger AS $$
BEGIN
  SELECT e."inicio", e."fin", e.estado
    INTO NEW."inicio", NEW."fin", NEW.estado
    FROM "Evento" e
   WHERE e.id = NEW."eventoId";
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER evento_salon_copia_horario
  BEFORE INSERT OR UPDATE ON "EventoSalon"
  FOR EACH ROW EXECUTE FUNCTION evento_salon_copia_horario();

-- Cuando el evento cambia de horario o de estado, se propaga a todos sus salones.
CREATE OR REPLACE FUNCTION evento_propaga_horario() RETURNS trigger AS $$
BEGIN
  UPDATE "EventoSalon"
     SET "inicio" = NEW."inicio", "fin" = NEW."fin", estado = NEW.estado
   WHERE "eventoId" = NEW.id;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER evento_propaga_horario
  AFTER UPDATE OF "inicio", "fin", estado ON "Evento"
  FOR EACH ROW EXECUTE FUNCTION evento_propaga_horario();

-- El no solapamiento de RN-12 se muda de Evento a EventoSalon: ahora es por salón del evento.
-- Mismo criterio que antes: EnConsulta y Cancelado no bloquean el salón.
ALTER TABLE "Evento" DROP CONSTRAINT evento_sin_solapamiento;

ALTER TABLE "EventoSalon" ADD CONSTRAINT evento_salon_sin_solapamiento
  EXCLUDE USING gist (
    "salonId" WITH =,
    tsrange("inicio", "fin") WITH &&
  ) WHERE (estado IN ('Reservado', 'Cobrado'));

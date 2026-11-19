-- HU-25 del backlog (Sprint 5): auditoría de todo el panel interno (ADR 0013).

-- campos: las claves que cambiaron, las mismas de valorAnterior y valorNuevo. Sirve para filtrar
-- la auditoría por campo con un índice, sin recorrer el JSON.
ALTER TABLE "audit_log" ADD COLUMN     "campos" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Las filas que ya había (landing de salones y servicios, HU-08) toman sus campos del JSON.
UPDATE "audit_log"
SET "campos" = ARRAY(
  SELECT jsonb_object_keys(COALESCE("valorNuevo", "valorAnterior", '{}'::jsonb))
  ORDER BY 1
)
WHERE jsonb_typeof(COALESCE("valorNuevo", "valorAnterior")) = 'object';

-- CreateIndex
CREATE INDEX "audit_log_fecha_idx" ON "audit_log"("fecha");

-- CreateIndex
CREATE INDEX "audit_log_campos_idx" ON "audit_log" USING GIN ("campos");

-- El registro es inmutable (dominio.md, «Auditoría»): la base rechaza modificarlo o borrarlo,
-- aunque lo intente el código o alguien con acceso directo a la base.
CREATE FUNCTION audit_log_inmutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log es inmutable: no se modifica ni se borra';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_inmutable
BEFORE UPDATE OR DELETE ON "audit_log"
FOR EACH ROW EXECUTE FUNCTION audit_log_inmutable();

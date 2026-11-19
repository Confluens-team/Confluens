-- Auditoría para Gerencia (15/11/2026): el Gerente General marca como revisado un cambio sensible
-- que hizo otro usuario. Tabla aparte porque audit_log es inmutable (trigger audit_log_inmutable).
-- CreateTable
CREATE TABLE "RevisionAuditoria" (
    "auditLogId" INTEGER NOT NULL,
    "revisadoPorId" INTEGER NOT NULL,
    "revisadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RevisionAuditoria_pkey" PRIMARY KEY ("auditLogId")
);

-- CreateIndex
CREATE INDEX "RevisionAuditoria_revisadoPorId_idx" ON "RevisionAuditoria"("revisadoPorId");

-- AddForeignKey
ALTER TABLE "RevisionAuditoria" ADD CONSTRAINT "RevisionAuditoria_auditLogId_fkey" FOREIGN KEY ("auditLogId") REFERENCES "audit_log"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevisionAuditoria" ADD CONSTRAINT "RevisionAuditoria_revisadoPorId_fkey" FOREIGN KEY ("revisadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- HU-31 del backlog (Sprint 5): baja lógica del personal (dominio.md, «Personal»). Un usuario
-- inactivo no inicia sesión; los que ya existen quedan activos.

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "activo" BOOLEAN NOT NULL DEFAULT true;

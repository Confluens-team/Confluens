-- Comentarios del cliente en la consulta de un evento social: lo que quiere contar de su evento
-- (pedidos, ideas, dudas). Son del cliente; las observaciones internas del personal van en cada día.
-- AlterTable
ALTER TABLE "Evento" ADD COLUMN     "comentariosCliente" TEXT;

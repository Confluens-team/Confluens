import { prisma } from '../../lib/prisma.js';

// Capa de acceso a datos del módulo. Separada del servicio para poder mockearla en
// clientes.rutas.test.ts sin Postgres (ADR 0003), igual que el resto de los módulos.

// Orden alfabético: es un listado de consulta. _count trae eventos y solicitudes en la misma
// consulta, sin pedir el historial de cada cliente.
export async function listarConResumen() {
  return prisma.cliente.findMany({
    orderBy: { nombre: 'asc' },
    include: { _count: { select: { eventos: true, solicitudes: true } } },
  });
}

export type ClientesRepositorio = {
  listarConResumen: typeof listarConResumen;
};

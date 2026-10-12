import { prisma } from '../../lib/prisma.js';

// Capa de acceso a datos del módulo. Separada del servicio para poder mockearla en
// clientes.rutas.test.ts sin Postgres (ADR 0003), igual que el resto de los módulos.

const CON_RESUMEN = {
  etiqueta: { select: { id: true, nombre: true } },
  _count: { select: { eventos: true, solicitudes: true } },
} as const;

// Orden alfabético: es un listado de consulta. _count trae eventos y solicitudes en la misma
// consulta, sin pedir el historial de cada cliente.
export async function listarConResumen() {
  return prisma.cliente.findMany({ orderBy: { nombre: 'asc' }, include: CON_RESUMEN });
}

export async function existeCliente(id: number) {
  return (await prisma.cliente.count({ where: { id } })) > 0;
}

export async function existeEtiqueta(id: number) {
  return (await prisma.etiqueta.count({ where: { id } })) > 0;
}

// Devuelve el cliente con el mismo shape que el listado, para que la web lo reemplace en su lugar.
export async function asignarEtiqueta(clienteId: number, etiquetaId: number | null) {
  return prisma.cliente.update({
    where: { id: clienteId },
    data: { etiquetaId },
    include: CON_RESUMEN,
  });
}

export type ClientesRepositorio = {
  listarConResumen: typeof listarConResumen;
  existeCliente: typeof existeCliente;
  existeEtiqueta: typeof existeEtiqueta;
  asignarEtiqueta: typeof asignarEtiqueta;
};

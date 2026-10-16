import { prisma } from '../../lib/prisma.js';

// Capa de acceso a datos del módulo. Separada del servicio para poder mockearla en
// clientes.rutas.test.ts sin Postgres (ADR 0003), igual que el resto de los módulos.

const CON_RESUMEN = {
  etiqueta: { select: { id: true, nombre: true } },
  _count: { select: { eventos: true, solicitudes: true } },
} as const;

const contiene = (palabra: string) => ({ contains: palabra, mode: 'insensitive' as const });

// HU-16: cada palabra de la búsqueda tiene que aparecer en algún dato del cliente, así «Ana Ruiz»
// encuentra a quien tiene nombre y apellido separados y «empresa1» a todos los de esa etiqueta.
// _count trae eventos y solicitudes en la misma consulta, sin pedir el historial de cada cliente.
// El orden alfabético lo arma el servicio: Prisma no ordena por «apellido o, si no tiene, nombre».
export async function listarConResumen(busqueda?: string) {
  const palabras = busqueda?.split(/\s+/).filter(Boolean) ?? [];
  return prisma.cliente.findMany({
    where: {
      AND: palabras.map((palabra) => ({
        OR: [
          { nombre: contiene(palabra) },
          { apellido: contiene(palabra) },
          { correo: contiene(palabra) },
          { telefono: contiene(palabra) },
          { etiqueta: { nombre: contiene(palabra) } },
        ],
      })),
    },
    include: CON_RESUMEN,
  });
}

// La ficha del cliente (HU-16 C4): el mismo shape que una fila del listado.
export async function buscarConResumen(id: number) {
  return prisma.cliente.findUnique({ where: { id }, include: CON_RESUMEN });
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
  buscarConResumen: typeof buscarConResumen;
  existeCliente: typeof existeCliente;
  existeEtiqueta: typeof existeEtiqueta;
  asignarEtiqueta: typeof asignarEtiqueta;
};

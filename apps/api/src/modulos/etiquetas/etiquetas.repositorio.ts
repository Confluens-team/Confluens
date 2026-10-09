import { prisma } from '../../lib/prisma.js';

// Capa de acceso a datos del módulo. Separada del servicio para poder mockearla en
// etiquetas.rutas.test.ts sin Postgres (ADR 0003), igual que el resto de los módulos.

const SELECCION = { id: true, nombre: true } as const;

export async function listar() {
  return prisma.etiqueta.findMany({ orderBy: { nombre: 'asc' }, select: SELECCION });
}

// El índice único de la base es exacto; "Empresa1" y "empresa1" se tratan como la misma etiqueta
// comparando sin distinguir mayúsculas antes de crear.
export async function buscarPorNombre(nombre: string) {
  return prisma.etiqueta.findFirst({
    where: { nombre: { equals: nombre, mode: 'insensitive' } },
    select: SELECCION,
  });
}

export async function crear(nombre: string) {
  return prisma.etiqueta.create({ data: { nombre }, select: SELECCION });
}

export type EtiquetasRepositorio = {
  listar: typeof listar;
  buscarPorNombre: typeof buscarPorNombre;
  crear: typeof crear;
};

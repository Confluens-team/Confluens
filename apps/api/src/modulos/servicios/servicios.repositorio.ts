import type { CrearServicio } from '@confluens/shared';

import { prisma } from '../../lib/prisma.js';

// Capa de acceso a datos del módulo. Separada del servicio para poder inyectar un fake en
// servicios.servicio.test.ts (sin tocar Prisma) y para poder mockear el módulo entero en
// servicios.rutas.test.ts (sin necesitar Postgres corriendo) — mismo criterio que auth (HU-27).

// Orden alfabético: es un catálogo de consulta (HU-32 solo agrega el alta), no hay un criterio de
// negocio que justifique otro orden como en salones (HU-01, por capacidad).
export async function listarActivos() {
  return prisma.servicio.findMany({
    where: { activo: true },
    orderBy: { nombre: 'asc' },
  });
}

// Catálogo del canal público (HU-07). Solo los activos, igual que el listado interno, y con un
// select explícito que deja afuera precio, unidadMedida, porPersona y tercerizado: son datos de
// presupuestación, no información de referencia. La landing no muestra precios — la vista con
// precios sin IVA es para el cliente registrado (Sprint 2).
// Orden por categoría y después por nombre: la landing agrupa por categoría, así que viene listo
// para recorrer sin reordenar en la web. Los servicios sin categoría quedan al final (nulls last).
export async function listarPublicos() {
  return prisma.servicio.findMany({
    where: { activo: true },
    select: {
      id: true,
      nombre: true,
      descripcion: true,
      categoria: true,
      fotoUrl: true,
    },
    orderBy: [{ categoria: { sort: 'asc', nulls: 'last' } }, { nombre: 'asc' }],
  });
}

// nombre es @unique en el schema: sirve tanto para buscar como para el chequeo de duplicados del
// servicio (criterio 4 de HU-32).
export async function buscarPorNombre(nombre: string) {
  return prisma.servicio.findUnique({ where: { nombre } });
}

// "activo" se fija en true acá, no lo decide quien llama: HU-32 no tiene alta de servicio inactivo
// (ver comentario en packages/shared/src/esquemas/servicio.esquema.ts).
export async function crear(datos: CrearServicio) {
  return prisma.servicio.create({
    data: { ...datos, activo: true },
  });
}

export async function buscarPorId(id: number) {
  return prisma.servicio.findUnique({ where: { id } });
}

// Asigna la foto del servicio en la landing y audita el cambio en la misma transacción, con el
// mismo criterio que salones.repositorio.ts (HU-08, criterio 4).
export async function actualizarLanding(
  id: number,
  fotoUrl: string | null,
  anterior: string | null,
  usuarioId: number,
) {
  return prisma.$transaction(async (tx) => {
    const servicio = await tx.servicio.update({ where: { id }, data: { fotoUrl } });
    await tx.auditLog.create({
      data: {
        usuarioId,
        entidad: 'Servicio',
        entidadId: String(id),
        valorAnterior: { fotoUrl: anterior },
        valorNuevo: { fotoUrl },
      },
    });
    return servicio;
  });
}

export type ServiciosRepositorio = {
  listarActivos: typeof listarActivos;
  listarPublicos: typeof listarPublicos;
  buscarPorNombre: typeof buscarPorNombre;
  buscarPorId: typeof buscarPorId;
  crear: typeof crear;
  actualizarLanding: typeof actualizarLanding;
};

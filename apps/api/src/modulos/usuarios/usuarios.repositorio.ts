import type { RolPersonal } from '@confluens/shared';

import { prisma } from '../../lib/prisma.js';

// Capa de acceso a datos del módulo. Separada del servicio para poder mockearla en
// usuarios.rutas.test.ts sin Postgres (ADR 0003), igual que el resto de los módulos.

// Nunca se selecciona hashContrasena: lo que sale de acá va directo a la respuesta.
const SELECCION = {
  id: true,
  email: true,
  rol: true,
  creadoEn: true,
  actualizadoEn: true,
} as const;

// Usuario.email es único entre todos los roles, clientes incluidos: un correo que ya es de un
// cliente tampoco se puede usar para el personal.
export async function buscarPorEmail(email: string) {
  return prisma.usuario.findUnique({ where: { email }, select: { id: true } });
}

// Un usuario del personal no tiene ficha de Cliente: se crea solo el Usuario.
export async function crear(datos: { email: string; hashContrasena: string; rol: RolPersonal }) {
  return prisma.usuario.create({ data: datos, select: SELECCION });
}

// Ordena por rol en el orden del enum Rol de schema.prisma (RE, RF, GG, ADM), que es el que usa
// Postgres para comparar enums, y después por correo.
export async function listar(rol?: RolPersonal) {
  return prisma.usuario.findMany({
    where: { rol: rol ?? { not: 'CLIENTE' } },
    orderBy: [{ rol: 'asc' }, { email: 'asc' }],
    select: SELECCION,
  });
}

export type UsuariosRepositorio = {
  buscarPorEmail: typeof buscarPorEmail;
  crear: typeof crear;
  listar: typeof listar;
};

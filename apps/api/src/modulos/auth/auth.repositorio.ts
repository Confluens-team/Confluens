import { prisma } from '../../lib/prisma.js';

// Capa de acceso a datos del módulo auth. Separada del servicio para poder
// inyectar un fake en los tests unitarios de auth.servicio.ts sin tocar Prisma
// (ver auth.servicio.test.ts) y para poder mockear el módulo entero
// (`vi.mock('./auth.repositorio.js')`) en los tests de integración de las rutas,
// que así no requieren una base de datos real corriendo en CI.
export async function buscarUsuarioPorEmail(email: string) {
  return prisma.usuario.findUnique({ where: { email } });
}

// Alta de la cuenta del Cliente en el canal público. Usuario y Cliente se crean juntos. Si ya
// existe una ficha con ese correo sin cuenta (las que el personal cargó antes de que los clientes
// solo se dieran de alta registrándose, ver dominio.md), se le vincula el usuario nuevo en vez de
// duplicar la ficha comercial (C7 de HU-48). Al vincular se reemplaza el teléfono por el celular validado del registro: es el
// número al que se le escribe por WhatsApp (wa.me), y el que cargó el personal no pasó por esa
// validación.
export async function crearUsuarioCliente(datos: {
  email: string;
  hashContrasena: string;
  nombre: string;
  apellido: string;
  telefono: string;
}) {
  return prisma.$transaction(async (tx) => {
    const usuario = await tx.usuario.create({
      data: { email: datos.email, hashContrasena: datos.hashContrasena, rol: 'CLIENTE' },
    });

    const clienteExistente = await tx.cliente.findFirst({
      where: { correo: datos.email, usuarioId: null },
    });
    if (clienteExistente) {
      await tx.cliente.update({
        where: { id: clienteExistente.id },
        data: { usuarioId: usuario.id, telefono: datos.telefono },
      });
    } else {
      await tx.cliente.create({
        data: {
          nombre: datos.nombre,
          apellido: datos.apellido,
          telefono: datos.telefono,
          correo: datos.email,
          usuarioId: usuario.id,
        },
      });
    }

    return usuario;
  });
}

export async function buscarUsuarioPorId(id: number) {
  return prisma.usuario.findUnique({ where: { id } });
}

export async function actualizarContrasena(id: number, hashContrasena: string) {
  return prisma.usuario.update({ where: { id }, data: { hashContrasena } });
}

export async function buscarClientePorUsuarioId(usuarioId: number) {
  return prisma.cliente.findUnique({ where: { usuarioId } });
}

export type AuthRepositorio = {
  buscarUsuarioPorEmail: typeof buscarUsuarioPorEmail;
};

export type RestablecimientoRepositorio = AuthRepositorio & {
  buscarUsuarioPorId: typeof buscarUsuarioPorId;
  actualizarContrasena: typeof actualizarContrasena;
};

// Tipo aparte (y no más campos en AuthRepositorio) para que los fakes de iniciarSesion en
// auth.servicio.test.ts no tengan que implementar funciones que ese flujo no usa.
export type RegistroRepositorio = AuthRepositorio & {
  crearUsuarioCliente: typeof crearUsuarioCliente;
};

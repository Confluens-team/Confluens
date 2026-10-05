import type { Credenciales, PerfilCliente, RegistroCliente, Sesion } from '@confluens/shared';

import { Prisma } from '../../generated/prisma/client.js';
import { compararContrasena, hashearContrasena } from '../../lib/contrasena.js';
import { ErrorApi } from '../../lib/errores.js';
import { firmarToken } from '../../lib/jwt.js';
import * as authRepositorioReal from './auth.repositorio.js';
import type { AuthRepositorio, RegistroRepositorio } from './auth.repositorio.js';

// Hash bcrypt fijo de un valor arbitrario, sin usuario asociado. Se compara contra
// él cuando el email no existe, para que iniciarSesion() tarde lo mismo (una
// operación de bcrypt.compare) exista o no la cuenta. Sin esto, un atacante podría
// medir el tiempo de respuesta para enumerar qué emails están registrados: buscar
// en la base es rápido y devolvería antes que un intento con email inexistente.
const HASH_DUMMY = '$2b$10$oXlaoV0.SaEDkKBpGZyhrO2uxZ5F31Sd5wE9reWYpplLsAymkW3Q6';

/**
 * Valida credenciales y, si son correctas, devuelve la sesión y su JWT firmado.
 * `repositorio` tiene un default para uso real; en los tests unitarios se pasa un
 * fake para no tocar Prisma/la base de datos (ver auth.servicio.test.ts).
 *
 * Criterio 2 (sprint-01.md): ante contraseña incorrecta o email inexistente, se
 * responde el mismo error genérico — nunca se indica cuál de los dos datos falló.
 */
export async function iniciarSesion(
  credenciales: Credenciales,
  repositorio: AuthRepositorio = authRepositorioReal,
): Promise<{ sesion: Sesion; token: string }> {
  const usuario = await repositorio.buscarUsuarioPorEmail(credenciales.email);

  const hashAComparar = usuario?.hashContrasena ?? HASH_DUMMY;
  const contrasenaValida = await compararContrasena(credenciales.contrasena, hashAComparar);

  if (!usuario || !contrasenaValida) {
    throw ErrorApi.noAutenticado();
  }

  const sesion: Sesion = { id: usuario.id, email: usuario.email, rol: usuario.rol };
  const token = firmarToken(sesion);
  return { sesion, token };
}

const MENSAJE_EMAIL_REGISTRADO = 'Ya existe una cuenta con ese email. Iniciá sesión.';

/**
 * Crea la cuenta de un Cliente desde la landing y lo deja con la sesión iniciada, para que pase
 * directo al cotizador. El rol es siempre CLIENTE: el canal público nunca da de alta personal.
 *
 * Un email ya registrado se rechaza con 409. A diferencia del login, acá sí se informa: quien se
 * está registrando necesita saber que tiene que iniciar sesión en vez de crear otra cuenta.
 */
export async function registrarCliente(
  datos: RegistroCliente,
  repositorio: RegistroRepositorio = authRepositorioReal,
): Promise<{ sesion: Sesion; token: string }> {
  const existente = await repositorio.buscarUsuarioPorEmail(datos.email);
  if (existente) {
    throw ErrorApi.conflicto(MENSAJE_EMAIL_REGISTRADO);
  }

  let usuario: Awaited<ReturnType<RegistroRepositorio['crearUsuarioCliente']>>;
  try {
    usuario = await repositorio.crearUsuarioCliente({
      email: datos.email,
      hashContrasena: await hashearContrasena(datos.contrasena),
      nombre: datos.nombre,
      apellido: datos.apellido,
      telefono: datos.telefono,
    });
  } catch (error) {
    // Dos registros simultáneos con el mismo email pasan los dos el chequeo de arriba; el índice
    // único de Usuario.email frena al segundo (P2002) y se responde el mismo 409, no un 500.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw ErrorApi.conflicto(MENSAJE_EMAIL_REGISTRADO);
    }
    throw error;
  }

  const sesion: Sesion = { id: usuario.id, email: usuario.email, rol: usuario.rol };
  return { sesion, token: firmarToken(sesion) };
}

// Datos comerciales del Cliente de la sesión. 404 si el usuario no tiene ficha de Cliente (por
// ejemplo, un usuario del personal que llegó acá por error).
export async function obtenerPerfilCliente(usuarioId: number): Promise<PerfilCliente> {
  const cliente = await authRepositorioReal.buscarClientePorUsuarioId(usuarioId);
  if (!cliente) {
    throw ErrorApi.noEncontrado('La sesión no corresponde a un cliente');
  }
  return {
    nombre: cliente.nombre,
    apellido: cliente.apellido,
    telefono: cliente.telefono,
    correo: cliente.correo,
  };
}

import type {
  Credenciales,
  PerfilCliente,
  RegistroCliente,
  RestablecerContrasena,
  Sesion,
} from '@confluens/shared';

import { Prisma } from '../../generated/prisma/client.js';
import { compararContrasena, hashearContrasena } from '../../lib/contrasena.js';
import { type Correo, enviarCorreo } from '../../lib/correo.js';
import { ErrorApi } from '../../lib/errores.js';
import {
  firmarToken,
  firmarTokenRestablecimiento,
  usuarioDelTokenRestablecimiento,
  verificarTokenRestablecimiento,
} from '../../lib/jwt.js';
import * as authRepositorioReal from './auth.repositorio.js';
import type {
  AuthRepositorio,
  RegistroRepositorio,
  RestablecimientoRepositorio,
} from './auth.repositorio.js';

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

// Mismo origen que usa app.ts para CORS: el enlace del correo abre la web.
const URL_FRONTEND = process.env['FRONTEND_URL'] ?? 'http://localhost:5173';

function correoDeRestablecimiento(para: string, enlace: string): Correo {
  const asunto = 'Restablecé tu contraseña de Los Abuelos';
  const texto =
    'Recibimos un pedido para restablecer la contraseña de tu cuenta.\n\n' +
    `Para elegir una nueva, abrí este enlace (vence en 30 minutos y sirve una sola vez):\n${enlace}\n\n` +
    'Si no lo pediste, ignorá este correo: tu contraseña no cambia.';
  const html =
    '<p>Recibimos un pedido para restablecer la contraseña de tu cuenta.</p>' +
    `<p><a href="${enlace}">Elegir una contraseña nueva</a></p>` +
    '<p>El enlace vence en 30 minutos y sirve una sola vez.</p>' +
    '<p>Si no lo pediste, ignorá este correo: tu contraseña no cambia.</p>';
  return { para, asunto, texto, html };
}

/**
 * C8 de HU-48: manda el enlace para restablecer la contraseña, a clientes y al personal. Si el
 * email no tiene cuenta no hace nada: el controlador responde lo mismo en los dos casos, así el
 * formulario no sirve para averiguar qué emails están registrados.
 */
export async function solicitarRestablecimiento(
  email: string,
  repositorio: AuthRepositorio = authRepositorioReal,
  enviar: (correo: Correo) => Promise<void> = enviarCorreo,
): Promise<void> {
  const usuario = await repositorio.buscarUsuarioPorEmail(email);
  if (!usuario) return;

  const token = firmarTokenRestablecimiento(usuario.id, usuario.hashContrasena);
  const enlace = `${URL_FRONTEND}/restablecer-contrasena?token=${encodeURIComponent(token)}`;
  await enviar(correoDeRestablecimiento(usuario.email, enlace));
}

const MENSAJE_ENLACE_INVALIDO = 'El enlace venció o ya se usó. Pedí uno nuevo.';

/**
 * Cambia la contraseña con el token del enlace y deja la sesión iniciada, como el login. Un token
 * vencido, adulterado o ya usado (la contraseña cambió desde que se firmó) se rechaza con 422.
 */
export async function restablecerContrasena(
  { token, contrasena }: RestablecerContrasena,
  repositorio: RestablecimientoRepositorio = authRepositorioReal,
): Promise<{ sesion: Sesion; token: string }> {
  const id = usuarioDelTokenRestablecimiento(token);
  const usuario = id ? await repositorio.buscarUsuarioPorId(id) : null;
  if (!usuario || !verificarTokenRestablecimiento(token, usuario.hashContrasena)) {
    throw ErrorApi.reglaNegocio(MENSAJE_ENLACE_INVALIDO);
  }

  await repositorio.actualizarContrasena(usuario.id, await hashearContrasena(contrasena));
  const sesion: Sesion = { id: usuario.id, email: usuario.email, rol: usuario.rol };
  return { sesion, token: firmarToken(sesion) };
}

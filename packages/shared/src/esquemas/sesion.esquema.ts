import { z } from 'zod';

import { esquemaId } from './comunes.esquema.js';
import { esquemaCelular } from './telefono.esquema.js';
import { esquemaRol } from './usuario.esquema.js';

// Email de una cuenta: sin espacios y en minúsculas antes de validar el formato, en el registro y
// en el login por igual. Así Juan@Mail.com y juan@mail.com son la misma cuenta (C3 de HU-48) y el
// registro encuentra la ficha de Cliente que el personal cargó con ese correo (C7).
const esquemaEmailDeCuenta = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: 'Ingresá un email válido (por ejemplo: nombre@empresa.com)' }));

// Nombre o apellido de la persona que se registra. Letras (con tildes y ñ), el espacio de los
// nombres compuestos, el guión de los apellidos compuestos (García-López) y el apóstrofe
// (D'Angelo), sin separadores al borde ni repetidos. Nada de dígitos ni símbolos: es el nombre con
// el que el equipo la va a llamar, no un campo libre. 30 caracteres alcanzan para cualquiera.
//
// Solo rige en el registro. `Cliente.nombre` también guarda razones sociales cuando el personal
// carga la ficha a mano (modelo-datos.md), y esas llevan puntos, "&" y números: los schemas de
// solicitud y presupuesto quedan sin esta restricción a propósito.
//
// Es una función y no una constante porque el mensaje de campo vacío nombra el campo, y Zod reporta
// los checks en el orden en que se encadenan: con el `min` al final, un campo vacío fallaba primero
// por el regex y mostraba "usá solo letras" en lugar de "ingresá tu nombre".
const esquemaNombreDePersona = (faltante: string) =>
  z
    .string()
    .trim()
    .min(1, { error: faltante })
    .max(30, { error: 'Usá hasta 30 caracteres' })
    .regex(/^\p{L}+(?:[ '’-]\p{L}+)*$/u, {
      error: 'Usá solo letras, sin números ni símbolos',
    });

// Contraseña nueva, en el registro y al restablecerla. El mínimo de 6 caracteres es un piso básico
// para la demo con el cliente; la política de contraseñas definitiva sigue siendo de HU-28.
const esquemaContrasenaNueva = z
  .string()
  .min(6, { error: 'La contraseña debe tener al menos 6 caracteres' });

// Credenciales que viajan en el body de POST /auth/login (HU-27).
// Sin política de longitud/complejidad de contraseña acá: esa regla es de alta de
// usuario (HU-28, Sprint 5), no de inicio de sesión. Inventarla en esta HU sería
// asumir algo que docs/ todavía no define.
//
// Mensajes de error en español y redactados para quien complete el formulario, no
// para quien lea el código: los defaults de Zod ("Invalid email address", "Too
// small...") son en inglés y hablan en términos técnicos (longitud de string) que no
// tienen sentido para alguien llenando un login. Se traduce puntualmente este
// esquema (el que ve el usuario final en IniciarSesion.tsx) y no el resto de
// esquemas de packages/shared, que hoy no tienen mensajes custom: esos son
// formularios internos de personal ya capacitado en el sistema, mientras que el
// login es la primera pantalla que cualquier persona ve.
export const esquemaCredenciales = z.object({
  email: esquemaEmailDeCuenta,
  contrasena: z.string().min(1, { error: 'Ingresá tu contraseña' }),
});
export type Credenciales = z.infer<typeof esquemaCredenciales>;

// Forma de la sesión autenticada: lo que se firma dentro del JWT y lo que devuelven
// POST /auth/login y GET /auth/yo. A propósito NO es esquemaUsuario (que trae
// creadoEn/actualizadoEn): el JWT ya contiene todo lo que un request autenticado
// necesita para decidir permisos, así que no hace falta volver a consultar la base
// en cada request protegido.
export const esquemaSesion = z.object({
  id: esquemaId,
  email: z.email(),
  rol: esquemaRol,
});
export type Sesion = z.infer<typeof esquemaSesion>;

// Body de POST /auth/registro: alta de cuenta del Cliente desde la landing, para acceder al
// cotizador con precios. Mensajes en español por la misma razón que esquemaCredenciales: es un
// formulario de cara al público.
export const esquemaRegistroCliente = z.object({
  nombre: esquemaNombreDePersona('Ingresá tu nombre'),
  apellido: esquemaNombreDePersona('Ingresá tu apellido'),
  email: esquemaEmailDeCuenta,
  // Celular para el contacto por WhatsApp; llega normalizado a E.164 (ver telefono.esquema.ts).
  telefono: esquemaCelular,
  contrasena: esquemaContrasenaNueva,
});
export type RegistroCliente = z.infer<typeof esquemaRegistroCliente>;

// Body de POST /auth/contrasena/olvido (C8 de HU-48): pide el enlace para restablecer la
// contraseña. Lo usan el cliente y el personal.
export const esquemaSolicitarRestablecimiento = z.object({ email: esquemaEmailDeCuenta });
export type SolicitarRestablecimiento = z.infer<typeof esquemaSolicitarRestablecimiento>;

// Body de POST /auth/contrasena/restablecer: el token llega en el enlace del correo.
export const esquemaRestablecerContrasena = z.object({
  token: z.string().min(1, { error: 'El enlace no es válido. Pedí uno nuevo.' }),
  contrasena: esquemaContrasenaNueva,
});
export type RestablecerContrasena = z.infer<typeof esquemaRestablecerContrasena>;

// Respuesta de GET /auth/perfil: los datos comerciales del Cliente vinculado a la sesión. El
// cotizador los usa para armar el presupuesto sin volver a pedirlos.
export const esquemaPerfilCliente = z.object({
  nombre: z.string().min(1),
  apellido: z.string().nullable(),
  telefono: z.string().min(1),
  correo: z.email(),
});
export type PerfilCliente = z.infer<typeof esquemaPerfilCliente>;

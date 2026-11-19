import { z } from 'zod';

import { esquemaId } from './comunes.esquema.js';
import { esquemaCelular } from './telefono.esquema.js';
import { esquemaRol, esquemaRolPersonal } from './usuario.esquema.js';

// Email de una cuenta: sin espacios y en minúsculas antes de validar el formato, en el registro y
// en el login por igual. Así Juan@Mail.com y juan@mail.com son la misma cuenta (C3 de HU-48) y el
// registro encuentra la ficha de Cliente que el personal cargó con ese correo (C7).
// El tope de 254 es el del estándar de correo; es el mismo que ya usa el cotizador (PO, 08/11/2026).
const esquemaEmailDeCuenta = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, { error: 'El email admite hasta 254 caracteres' })
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

// Contraseña nueva: en el registro, al restablecerla, al cambiarla y la inicial que el GG o el ADM le
// cargan a un usuario del personal (HU-30 del Sprint 4). La política (PO, 08/11/2026) prioriza el
// largo y frena lo obvio, sin exigir mayúsculas ni símbolos, que empujan a `Contraseña1!`:
//   - al menos 8 caracteres (antes eran 6, PO 06/11/2026);
//   - no puede ser solo espacios ni un único carácter repetido (`aaaaaaaa`);
//   - no puede estar en la lista de las más comunes de abajo;
//   - hasta 72 bytes: bcrypt lee solo los primeros 72, y sin el tope dos contraseñas largas iguales
//     hasta ahí quedarían con el mismo hash (PO, 07/11/2026). Se mide en bytes y no en caracteres
//     porque una tilde o un emoji ocupan más de uno.
// Rige solo al crear o cambiar una contraseña; el login no la revisa, para que entren las cuentas
// que ya tienen una más corta.
const MINIMO_CONTRASENA = 8;
const MAXIMO_BYTES_CONTRASENA = 72;

// Se compara sin tildes ni mayúsculas, así `Contraseña` y `CONTRASENA` caen en la misma entrada.
const CONTRASENAS_COMUNES = new Set([
  '12345678',
  '123456789',
  '1234567890',
  '12345678910',
  '87654321',
  '11111111',
  '00000000',
  '12341234',
  '123123123',
  '1q2w3e4r',
  'qwertyui',
  'qwertyuiop',
  'qwerty123',
  'abcd1234',
  'abc12345',
  'password',
  'password1',
  'password123',
  'contrasena',
  'contrasena1',
  'contrasena123',
  'contrasenia',
  'admin123',
  'administrador',
  'bienvenido',
  'bienvenida',
  'argentina',
  'confluens',
  'confluens1',
  'confluens123',
  'losabuelos',
]);

const comoSeCompara = (contrasena: string) =>
  contrasena.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

const esquemaContrasenaNueva = z
  .string()
  .min(MINIMO_CONTRASENA, {
    error: `La contraseña debe tener al menos ${MINIMO_CONTRASENA} caracteres`,
  })
  .refine((valor) => valor.trim().length > 0, {
    error: 'La contraseña no puede ser solo espacios',
  })
  .refine((valor) => new Set(valor).size > 1, {
    error: 'La contraseña no puede ser un único carácter repetido',
  })
  .refine((valor) => !CONTRASENAS_COMUNES.has(comoSeCompara(valor)), {
    error: 'Esa contraseña es demasiado común. Elegí otra',
  })
  .refine((valor) => new TextEncoder().encode(valor).length <= MAXIMO_BYTES_CONTRASENA, {
    error: `La contraseña es demasiado larga: usá hasta ${MAXIMO_BYTES_CONTRASENA} caracteres (las tildes y los símbolos cuentan doble)`,
  });

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

// Body de POST /usuarios (HU-30 del Sprint 4): el GG o el ADM dan de alta a un usuario del personal
// con su rol y su contraseña inicial. Qué rol puede asignar cada uno lo decide puedeAsignarRol()
// (dominio/personal.ts) y lo controla la API (403).
export const esquemaRegistrarUsuario = z.object({
  email: esquemaEmailDeCuenta,
  rol: esquemaRolPersonal,
  contrasena: esquemaContrasenaNueva,
});
export type RegistrarUsuario = z.infer<typeof esquemaRegistrarUsuario>;

// Body de PATCH /usuarios/:id (HU-30 del backlog): el correo y el rol de un usuario del personal.
// Qué rol puede asignar cada uno y a quién puede modificar lo controla la API (403).
export const esquemaModificarUsuario = z.object({
  email: esquemaEmailDeCuenta,
  rol: esquemaRolPersonal,
});
export type ModificarUsuario = z.infer<typeof esquemaModificarUsuario>;

// Body de PUT /usuarios/:id/contrasena (HU-30 del backlog): la contraseña nueva que el ADM le carga
// a un usuario. Solo el ADM cambia la contraseña de otro (PO, 06/11/2026).
export const esquemaCambiarContrasenaUsuario = z.object({ contrasena: esquemaContrasenaNueva });
export type CambiarContrasenaUsuario = z.infer<typeof esquemaCambiarContrasenaUsuario>;

// Body de POST /auth/contrasena: cada usuario cambia la suya desde Mi cuenta, con la actual (HU-30
// del backlog; PO, 06/11/2026).
export const esquemaCambiarMiContrasena = z.object({
  actual: z.string().min(1, { error: 'Ingresá tu contraseña actual' }),
  nueva: esquemaContrasenaNueva,
});
export type CambiarMiContrasena = z.infer<typeof esquemaCambiarMiContrasena>;

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

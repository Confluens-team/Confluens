import { AsyncLocalStorage } from 'node:async_hooks';

import type { Rol } from '@confluens/shared';

import type { Prisma } from '../generated/prisma/client.js';
import { prisma } from './prisma.js';

// HU-25 del backlog (ADR 0013). Mecanismo común de auditoría: cada repositorio que modifica datos
// del panel interno llama a registrarAuditoria con el `tx` de su transacción, así el cambio y su
// registro quedan juntos o no queda ninguno.
//
// Quién hizo el cambio sale del contexto de la petición, que abre el middleware autenticar con la
// sesión ya verificada: así no viaja por cada firma de controlador, servicio y repositorio, y nunca
// sale del body. usuarioId null es el Sistema (SYS: tareas programadas, recálculos), y se pasa
// explícito: una escritura sin contexto y sin usuario explícito es un error, no un cambio del
// Sistema, para que un camino olvidado no quede auditado a nombre de nadie.

type ClienteTx = Prisma.TransactionClient;

type ContextoAuditoria = { usuarioId: number; rol: Rol };

const contexto = new AsyncLocalStorage<ContextoAuditoria>();

// Corre `ejecutar` (en Express, el resto de la cadena) con el usuario de la sesión como actor.
export function conActor<T>(actor: ContextoAuditoria, ejecutar: () => T): T {
  return contexto.run(actor, ejecutar);
}

// Undefined: tomar el actor del contexto. null: el Sistema. Un número: ese usuario.
type UsuarioAuditado = number | null | undefined;

// Devuelve el usuario a registrar, o false si el cambio no se audita: lo que hace el cliente desde
// el canal público queda fuera, porque se audita el panel interno (PO, 07/11/2026).
function resolverUsuario(usuarioId: UsuarioAuditado): number | null | false {
  if (usuarioId !== undefined) return usuarioId;
  const actor = contexto.getStore();
  if (!actor) {
    throw new Error('Escritura auditada sin usuario: falta el contexto de la sesión');
  }
  if (actor.rol === 'CLIENTE') return false;
  return actor.usuarioId;
}

// Campos que no se auditan: los mantiene la base o no dicen nada del negocio. El hash de la
// contraseña nunca se guarda; el cambio de contraseña se registra aparte, sin el valor.
const CAMPOS_IGNORADOS = new Set([
  'id',
  'creadoEn',
  'actualizadoEn',
  'hashContrasena',
  'versionSesion',
]);

type Registro = Record<string, unknown>;

// Lleva un valor de Prisma a JSON: Decimal a string, Date a ISO 8601 y lo mismo adentro de
// objetos y listas. Así dos importes iguales se comparan iguales y el registro se lee sin Prisma.
export function normalizar(valor: unknown): Prisma.InputJsonValue | null {
  if (valor === null || valor === undefined) return null;
  if (valor instanceof Date) return valor.toISOString();
  if (Array.isArray(valor)) return valor.map(normalizar) as Prisma.InputJsonValue;
  if (typeof valor === 'object') {
    // Decimal de Prisma (decimal.js): se reconoce por su toFixed, sin importar la clase.
    if ('toFixed' in valor && typeof (valor as { toFixed: unknown }).toFixed === 'function') {
      return (valor as { toFixed: (decimales: number) => string }).toFixed(2);
    }
    return Object.fromEntries(
      Object.entries(valor).map(([clave, v]) => [clave, normalizar(v)]),
    ) as Prisma.InputJsonObject;
  }
  if (typeof valor === 'bigint') return valor.toString();
  return valor as Prisma.InputJsonValue;
}

export type Diferencia = {
  campos: string[];
  valorAnterior: Prisma.InputJsonObject | null;
  valorNuevo: Prisma.InputJsonObject | null;
};

// Solo los campos que cambiaron (criterio 1). Sin `anterior` es un alta: entran todos los campos
// con valor. Se comparan los valores normalizados, no las instancias.
export function calcularDiferencia(anterior: Registro | null, nuevo: Registro): Diferencia | null {
  const valorAnterior: Record<string, Prisma.InputJsonValue | null> = {};
  const valorNuevo: Record<string, Prisma.InputJsonValue | null> = {};

  for (const [campo, valor] of Object.entries(nuevo)) {
    if (CAMPOS_IGNORADOS.has(campo) || valor === undefined) continue;
    const despues = normalizar(valor);
    if (anterior === null) {
      if (despues === null) continue;
      valorNuevo[campo] = despues;
      continue;
    }
    if (!(campo in anterior)) continue;
    const antes = normalizar(anterior[campo]);
    if (JSON.stringify(antes) === JSON.stringify(despues)) continue;
    valorAnterior[campo] = antes;
    valorNuevo[campo] = despues;
  }

  const campos = Object.keys(valorNuevo);
  if (campos.length === 0) return null;
  return {
    campos,
    valorAnterior: anterior === null ? null : (valorAnterior as Prisma.InputJsonObject),
    valorNuevo: valorNuevo as Prisma.InputJsonObject,
  };
}

// Entidades auditadas: la «parte del sistema» por la que se filtra en la pestaña Auditoría.
// Los nombres son los de las entidades de modelo-datos.md.
export type EntidadAuditada =
  | 'Salon'
  | 'Distribucion'
  | 'Servicio'
  | 'ConfiguracionPrecios'
  | 'MedioPago'
  | 'Cliente'
  | 'Etiqueta'
  | 'Solicitud'
  | 'Evento'
  | 'Presupuesto'
  | 'Pago'
  | 'Usuario';

export type CambioAuditado = {
  // Omitido: el usuario de la sesión (ver resolverUsuario).
  usuarioId?: number | null;
  entidad: EntidadAuditada;
  entidadId: number | string;
  // null en un alta.
  anterior: Registro | null;
  // El registro como quedó (o solo los campos que se quieren auditar).
  nuevo: Registro;
};

// Escribe el registro si hubo cambios. Devuelve false cuando no cambió nada, para que el llamador
// no tenga que comparar por su cuenta.
export async function registrarAuditoria(tx: ClienteTx, cambio: CambioAuditado): Promise<boolean> {
  const usuarioId = resolverUsuario(cambio.usuarioId);
  if (usuarioId === false) return false;
  const diferencia = calcularDiferencia(cambio.anterior, cambio.nuevo);
  if (!diferencia) return false;
  await tx.auditLog.create({
    data: {
      usuarioId,
      entidad: cambio.entidad,
      entidadId: String(cambio.entidadId),
      campos: diferencia.campos,
      valorAnterior: diferencia.valorAnterior ?? undefined,
      valorNuevo: diferencia.valorNuevo ?? undefined,
    },
  });
  return true;
}

// Para los repositorios cuyas funciones aceptan un `tx` opcional: si llega el cliente global (no
// hay transacción abierta), abre una para que el cambio y su registro queden juntos.
export async function enTransaccion<T>(
  tx: ClienteTx,
  ejecutar: (tx: ClienteTx) => Promise<T>,
): Promise<T> {
  if (tx === (prisma as unknown as ClienteTx)) return prisma.$transaction(ejecutar);
  return ejecutar(tx);
}

// Varios registros de una sola vez, para las escrituras masivas (updateMany): por ejemplo, la
// tarea que vence presupuestos o la cancelación de un evento con sus presupuestos.
export async function registrarAuditorias(
  tx: ClienteTx,
  cambios: CambioAuditado[],
): Promise<number> {
  const filas = cambios.flatMap((cambio) => {
    const usuarioId = resolverUsuario(cambio.usuarioId);
    if (usuarioId === false) return [];
    const diferencia = calcularDiferencia(cambio.anterior, cambio.nuevo);
    if (!diferencia) return [];
    return [
      {
        usuarioId,
        entidad: cambio.entidad,
        entidadId: String(cambio.entidadId),
        campos: diferencia.campos,
        valorAnterior: diferencia.valorAnterior ?? undefined,
        valorNuevo: diferencia.valorNuevo ?? undefined,
      },
    ];
  });
  if (filas.length === 0) return 0;
  await tx.auditLog.createMany({ data: filas });
  return filas.length;
}

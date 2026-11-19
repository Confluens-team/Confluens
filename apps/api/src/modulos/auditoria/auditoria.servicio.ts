import {
  esCambioSensible,
  type FiltrosAuditoria,
  REGLAS_SENSIBLES,
  type RegistroAuditoria,
  requiereRevision,
  type ResumenAuditoria,
  type RevisionAuditoria,
  type TipoDeAccion,
  tipoDeAccion,
} from '@confluens/shared';

import { Prisma } from '../../generated/prisma/client.js';
import { ErrorApi } from '../../lib/errores.js';
import * as repositorioReal from './auditoria.repositorio.js';
import type { AuditoriaRepositorio, FilaAuditoria } from './auditoria.repositorio.js';

// Los eventos son de Córdoba, en una zona fija sin horario de verano (ADR 0010): un día de
// calendario va de las 00:00 a las 24:00 en UTC-3.
const DESPLAZAMIENTO_ZONA = '-03:00';
const MS_POR_DIA = 24 * 60 * 60 * 1000;

function inicioDelDia(fecha: string): Date {
  return new Date(`${fecha}T00:00:00.000${DESPLAZAMIENTO_ZONA}`);
}

function inicioDelDiaSiguiente(fecha: string): Date {
  const dia = inicioDelDia(fecha);
  dia.setUTCDate(dia.getUTCDate() + 1);
  return dia;
}

// ── Criterios de la auditoría para Gerencia como filtros de la base ─────────────────────────────
// Los mismos que `esCambioSensible`, `requiereRevision` y `tipoDeAccion` de packages/shared, pero
// como `where` de Prisma: así se filtra y se cuenta en la base, sin columnas nuevas en audit_log.

/** Lo que toca plata o permisos (REGLAS_SENSIBLES). */
export function filtroSensible(): Prisma.AuditLogWhereInput {
  return {
    OR: Object.entries(REGLAS_SENSIBLES).map(([entidad, regla]) =>
      regla === 'todos' ? { entidad } : { entidad, campos: { hasSome: [...regla] } },
    ),
  };
}

/** Lo sensible que espera la revisión del GG: no lo hizo el GG ni el Sistema, y nadie lo revisó. */
export function filtroPendiente(): Prisma.AuditLogWhereInput {
  return {
    AND: [
      filtroSensible(),
      { usuario: { is: { rol: { not: 'GERENTE_GENERAL' } } } },
      { revision: { is: null } },
    ],
  };
}

const FILTRO_ALTA: Prisma.AuditLogWhereInput = { valorAnterior: { equals: Prisma.DbNull } };
// Cada comparación del valor va junto con «el campo cambió»: sin eso, en las filas que no tienen
// ese campo la comparación da NULL en SQL y el NOT de las modificaciones las dejaba afuera.
const FILTRO_BAJA: Prisma.AuditLogWhereInput = {
  OR: [
    { campos: { has: 'anuladoEn' } },
    {
      AND: [
        { campos: { has: 'estado' } },
        { valorNuevo: { path: ['estado'], equals: 'Cancelado' } },
      ],
    },
    {
      AND: [{ campos: { has: 'activo' } }, { valorNuevo: { path: ['activo'], equals: false } }],
    },
  ],
};

export function filtroDeTipo(tipo: TipoDeAccion): Prisma.AuditLogWhereInput {
  if (tipo === 'alta') return FILTRO_ALTA;
  if (tipo === 'baja') return { AND: [{ NOT: FILTRO_ALTA }, FILTRO_BAJA] };
  return { AND: [{ NOT: FILTRO_ALTA }, { NOT: FILTRO_BAJA }] };
}

/**
 * HU-25 del backlog: arma la consulta de los filtros. El campo se busca en la lista de campos que
 * cambiaron (índice GIN, ADR 0013); «hasta» incluye el día entero. Sin filtros, `{}`.
 */
export function armarFiltro(
  filtros: Omit<FiltrosAuditoria, 'page' | 'pageSize'>,
): Prisma.AuditLogWhereInput {
  const where: Prisma.AuditLogWhereInput = {};
  if (filtros.entidad) where.entidad = filtros.entidad;
  if (filtros.entidadId) where.entidadId = filtros.entidadId.replace(/^#/, '');
  if (filtros.campo) where.campos = { has: filtros.campo };
  if (filtros.sistema) where.usuarioId = null;
  else if (filtros.usuarioId) where.usuarioId = filtros.usuarioId;
  if (filtros.desde || filtros.hasta) {
    where.fecha = {
      ...(filtros.desde && { gte: inicioDelDia(filtros.desde) }),
      ...(filtros.hasta && { lt: inicioDelDiaSiguiente(filtros.hasta) }),
    };
  }
  const y: Prisma.AuditLogWhereInput[] = [];
  if (filtros.tipo) y.push(filtroDeTipo(filtros.tipo));
  if (filtros.pendientes) y.push(filtroPendiente());
  else if (filtros.sensibles) y.push(filtroSensible());
  if (filtros.buscar) {
    const texto = filtros.buscar.replace(/^#/, '');
    y.push({
      OR: [
        { usuario: { is: { email: { contains: texto, mode: 'insensitive' } } } },
        { entidadId: texto },
        { campos: { has: texto } },
      ],
    });
  }
  if (y.length > 0) where.AND = y;
  return where;
}

// ── De la fila de la base a lo que ve el panel ─────────────────────────────────────────────────

export function aRegistro(fila: FilaAuditoria): RegistroAuditoria {
  const valorAnterior = fila.valorAnterior as Record<string, unknown> | null;
  const valorNuevo = fila.valorNuevo as Record<string, unknown> | null;
  const sensible = esCambioSensible(fila);
  return {
    id: fila.id,
    fecha: fila.fecha.toISOString(),
    usuario: fila.usuario,
    entidad: fila.entidad,
    entidadId: fila.entidadId,
    campos: fila.campos,
    valorAnterior,
    valorNuevo,
    tipo: tipoDeAccion({ campos: fila.campos, valorAnterior, valorNuevo }),
    sensible,
    requiereRevision: requiereRevision({ sensible, usuario: fila.usuario }),
    revision: fila.revision
      ? { usuario: fila.revision.revisadoPor, fecha: fila.revision.revisadoEn.toISOString() }
      : null,
  };
}

export async function listarAuditoria(
  filtros: FiltrosAuditoria,
  repo: AuditoriaRepositorio = repositorioReal,
): Promise<{
  registros: RegistroAuditoria[];
  total: number;
  conteos: Record<'todo' | TipoDeAccion, number>;
}> {
  const { filas, total } = await repo.listar(
    armarFiltro(filtros),
    (filtros.page - 1) * filtros.pageSize,
    filtros.pageSize,
  );
  // Las pestañas Todo / Altas / Modificaciones / Bajas cuentan con los mismos filtros, sin el tipo.
  const sinTipo = { ...filtros, tipo: undefined };
  const [todo, alta, modificacion, baja] = await Promise.all([
    repo.contar(armarFiltro(sinTipo)),
    repo.contar(armarFiltro({ ...sinTipo, tipo: 'alta' })),
    repo.contar(armarFiltro({ ...sinTipo, tipo: 'modificacion' })),
    repo.contar(armarFiltro({ ...sinTipo, tipo: 'baja' })),
  ]);
  return { registros: filas.map(aRegistro), total, conteos: { todo, alta, modificacion, baja } };
}

export async function listarCamposAuditados(
  repo: AuditoriaRepositorio = repositorioReal,
): Promise<string[]> {
  return repo.listarCampos();
}

/**
 * Diseño B (resumen para el Gerente General): lo que pasó en los últimos `dias` días, comparado con
 * el período anterior, más los cambios sensibles que esperan su revisión (de cualquier fecha).
 */
export async function resumirAuditoria(
  dias: number,
  ahora: Date = new Date(),
  repo: AuditoriaRepositorio = repositorioReal,
): Promise<ResumenAuditoria> {
  const desde = new Date(ahora.getTime() - dias * MS_POR_DIA);
  const desdeAnterior = new Date(desde.getTime() - dias * MS_POR_DIA);
  const periodo: Prisma.AuditLogWhereInput = { fecha: { gte: desde } };
  const anterior: Prisma.AuditLogWhereInput = { fecha: { gte: desdeAnterior, lt: desde } };
  const bajas: Prisma.AuditLogWhereInput = { AND: [periodo, filtroDeTipo('baja')] };

  const [
    cambios,
    cambiosPeriodoAnterior,
    sensiblesPendientes,
    cantidadBajas,
    bajasDePagos,
    porUsuario,
    porEntidad,
    pendientes,
  ] = await Promise.all([
    repo.contar(periodo),
    repo.contar(anterior),
    repo.contar(filtroPendiente()),
    repo.contar(bajas),
    repo.contar({ AND: [bajas, { entidad: 'Pago' }] }),
    repo.agruparPorUsuario(periodo),
    repo.agruparPorEntidad(periodo),
    repo.listar(filtroPendiente(), 0, 10),
  ]);

  const usuarios = await repo.buscarUsuarios(
    porUsuario.flatMap(({ usuarioId }) => (usuarioId === null ? [] : [usuarioId])),
  );
  const usuarioPorId = new Map(usuarios.map((usuario) => [usuario.id, usuario]));
  return {
    dias,
    cambios,
    cambiosPeriodoAnterior,
    sensiblesPendientes,
    bajas: cantidadBajas,
    bajasDePagos,
    personas: porUsuario.filter(({ usuarioId }) => usuarioId !== null).length,
    automaticos: porUsuario.find(({ usuarioId }) => usuarioId === null)?.cambios ?? 0,
    porPersona: porUsuario
      .map(({ usuarioId, cambios: deEse }) => ({
        usuario: usuarioId === null ? null : (usuarioPorId.get(usuarioId) ?? null),
        cambios: deEse,
      }))
      .sort((a, b) => b.cambios - a.cambios),
    porEntidad: [...porEntidad].sort((a, b) => b.cambios - a.cambios),
    paraRevisar: pendientes.filas.map(aRegistro),
  };
}

/**
 * Diseño D (historial dentro de cada registro): los cambios de un evento y de lo que cuelga de él
 * (sus presupuestos, sus pagos y la solicitud de la que salió), del más nuevo al más viejo.
 */
export async function historialDeEvento(
  eventoId: number,
  repo: AuditoriaRepositorio = repositorioReal,
): Promise<RegistroAuditoria[]> {
  const ids = await repo.idsDelEvento(eventoId);
  if (!ids) throw ErrorApi.noEncontrado('El evento no existe');
  const deEntidad = (entidad: string, lista: number[]) =>
    lista.length > 0 ? [{ entidad, entidadId: { in: lista.map(String) } }] : [];
  const filas = await repo.listarTodos(
    {
      OR: [
        { entidad: 'Evento', entidadId: String(eventoId) },
        ...deEntidad('Presupuesto', ids.presupuestos),
        ...deEntidad('Pago', ids.pagos),
        ...deEntidad('Solicitud', ids.solicitudes),
      ],
    },
    1000,
  );
  return filas.map(aRegistro);
}

/**
 * El Gerente General marca como revisado un cambio sensible que hizo otro usuario. Lo del propio GG
 * y lo del Sistema no se revisa (Franco, 15/11/2026); un cambio se revisa una sola vez.
 */
export async function marcarRevisado(
  auditLogId: number,
  usuarioId: number,
  repo: AuditoriaRepositorio = repositorioReal,
): Promise<RevisionAuditoria> {
  const fila = await repo.buscarPorId(auditLogId);
  if (!fila) throw ErrorApi.noEncontrado('El cambio no existe');
  const registro = aRegistro(fila);
  if (registro.revision) throw ErrorApi.conflicto('Este cambio ya está revisado');
  if (!registro.requiereRevision) {
    throw ErrorApi.reglaNegocio(
      registro.sensible
        ? 'Los cambios de la gerencia y los automáticos no necesitan revisión'
        : 'Solo se revisan los cambios sensibles',
    );
  }
  const revision = await repo.crearRevision(auditLogId, usuarioId);
  return {
    auditLogId: revision.auditLogId,
    usuario: revision.revisadoPor,
    fecha: revision.revisadoEn.toISOString(),
  };
}

// ── Exportar ─────────────────────────────────────────────────────────────────────────────────

export const TOPE_EXPORTACION = 5000;

const celdaCsv = (valor: unknown) => {
  const texto = valor === null || valor === undefined ? '' : String(valor);
  return /[",\n;]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
};

/** Los cambios con los filtros del Registro, en CSV (hasta TOPE_EXPORTACION filas). */
export async function exportarAuditoria(
  filtros: Omit<FiltrosAuditoria, 'page' | 'pageSize'>,
  repo: AuditoriaRepositorio = repositorioReal,
): Promise<string> {
  const filas = await repo.listarTodos(armarFiltro(filtros), TOPE_EXPORTACION);
  const encabezado = [
    'fecha',
    'usuario',
    'rol',
    'accion',
    'entidad',
    'entidadId',
    'campos',
    'valorAnterior',
    'valorNuevo',
    'sensible',
    'revisadoPor',
    'revisadoEn',
  ];
  const lineas = filas
    .map(aRegistro)
    .map((registro) =>
      [
        registro.fecha,
        registro.usuario?.email ?? 'Sistema',
        registro.usuario?.rol ?? '',
        registro.tipo,
        registro.entidad,
        registro.entidadId,
        registro.campos.join(' '),
        registro.valorAnterior ? JSON.stringify(registro.valorAnterior) : '',
        registro.valorNuevo ? JSON.stringify(registro.valorNuevo) : '',
        registro.sensible ? 'sí' : 'no',
        registro.revision?.usuario.email ?? '',
        registro.revision?.fecha ?? '',
      ]
        .map(celdaCsv)
        .join(','),
    );
  return [encabezado.join(','), ...lineas].join('\n');
}

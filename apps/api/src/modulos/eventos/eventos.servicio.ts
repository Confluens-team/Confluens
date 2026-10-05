import type { ReservarEvento } from '@confluens/shared';

import { Prisma } from '../../generated/prisma/client.js';
import { ErrorApi } from '../../lib/errores.js';
import * as eventosRepositorioReal from './eventos.repositorio.js';
import type { EventosRepositorio } from './eventos.repositorio.js';

const DIEZ_DIAS_EN_MS = 10 * 24 * 60 * 60 * 1000;
const CUARENTA_Y_OCHO_HORAS_EN_MS = 48 * 60 * 60 * 1000;

// Aplana el presupuesto Confirmado en totalPresupuesto (esquemaEventoAgenda): la agenda no necesita
// la lista de presupuestos, solo el total tomado.
export async function listarAgenda(repo: EventosRepositorio = eventosRepositorioReal) {
  const eventos = await repo.listarAgenda();
  return eventos.map(({ presupuestos, ...evento }) => ({
    ...evento,
    totalPresupuesto: presupuestos[0]?.total ?? null,
  }));
}

export async function obtenerDetalle(
  id: number,
  repo: EventosRepositorio = eventosRepositorioReal,
) {
  const evento = await repo.buscarDetallado(id);
  if (!evento) throw ErrorApi.noEncontrado(`No existe el evento ${id}`);
  return evento;
}

/**
 * Confirma el presupuesto Estimado del evento y reserva el salón en un solo paso (HU-15).
 *
 * Reglas aplicadas:
 * - Criterio 1: al reservar, el evento pasa a Reservado con inicio/fin fijados y ocupa el salón.
 * - Criterio 2 / RN no numerada de solapamiento: se valida en la aplicación (buscarSolapamiento,
 *   informa con qué evento choca) y además queda protegido por la constraint EXCLUDE de Postgres
 *   (btree_gist) como red de seguridad ante una carrera entre dos reservas concurrentes.
 * - Criterio 3: si cantidadPersonas supera la capacidad de la distribución elegida, se exige
 *   `confirmarCapacidadExcedida: true` explícito para continuar.
 * - Criterio 4 / RN-06: al reservar se fija `senaVenceEn` a 10 días desde ahora (el momento de
 *   la confirmación). Desde HU-10 el evento ya no se cancela solo al vencer (RN-06); el plazo de
 *   la seña lo rehacen HU-13 y HU-14.
 * - Criterio 7: `modalidadSalonRestaurante` se persiste tal cual llega, es una opción interna sin
 *   ninguna regla asociada en este sprint.
 */
export async function reservarEvento(
  id: number,
  datos: ReservarEvento,
  repo: EventosRepositorio = eventosRepositorioReal,
) {
  const evento = await repo.buscarDetallado(id);
  if (!evento) throw ErrorApi.noEncontrado(`No existe el evento ${id}`);
  if (evento.estado !== 'EnConsulta') {
    throw ErrorApi.conflicto(
      `El evento ${id} no está EnConsulta (estado actual: ${evento.estado})`,
    );
  }

  const presupuesto = await repo.buscarPresupuestoEstimado(id);
  if (!presupuesto) {
    throw ErrorApi.conflicto(`El evento ${id} no tiene un presupuesto Estimado para confirmar`);
  }

  const distribucion = await repo.buscarDistribucion(datos.distribucionId);
  if (!distribucion || distribucion.salonId !== evento.salonId) {
    throw ErrorApi.noEncontrado(
      `No existe la distribución ${datos.distribucionId} para este salón`,
    );
  }

  // Criterio 3
  if (evento.cantidadPersonas > distribucion.capacidad && !datos.confirmarCapacidadExcedida) {
    throw ErrorApi.reglaNegocio(
      `${evento.cantidadPersonas} personas supera la capacidad de "${distribucion.nombre}" ` +
        `(${distribucion.capacidad}). Confirmá para continuar igualmente.`,
    );
  }

  const inicio = new Date(datos.inicio);
  const fin = new Date(datos.fin);
  if (fin <= inicio) {
    throw ErrorApi.reglaNegocio('El horario de fin debe ser posterior al de inicio');
  }

  // Criterio 2 (parte "aplicación")
  const solapado = await repo.buscarSolapamiento({
    salonId: evento.salonId,
    inicio,
    fin,
    excluirEventoId: id,
  });
  if (solapado) {
    throw ErrorApi.conflicto(
      `El salón ya está reservado en ese horario por el evento #${solapado.id}`,
    );
  }

  const senaVenceEn = new Date(Date.now() + DIEZ_DIAS_EN_MS); // RN-06

  try {
    await repo.crearEnTransaccion((tx) =>
      repo.reservar(
        {
          eventoId: id,
          presupuestoId: presupuesto.id,
          distribucionId: datos.distribucionId,
          inicio,
          fin,
          senaVenceEn,
          modalidadSalonRestaurante: datos.modalidadSalonRestaurante,
        },
        tx,
      ),
    );
  } catch (error) {
    // Red de seguridad ante una carrera: dos reservas concurrentes pueden pasar el pre-chequeo
    // de buscarSolapamiento y chocar recién acá con la constraint EXCLUDE (btree_gist).
    if (esViolacionDeSolapamiento(error)) {
      throw ErrorApi.conflicto('El salón ya está reservado en ese horario');
    }
    throw error;
  }

  return repo.buscarDetallado(id);
}

export async function registrarSena(id: number, repo: EventosRepositorio = eventosRepositorioReal) {
  const evento = await repo.buscarDetallado(id);
  if (!evento) throw ErrorApi.noEncontrado(`No existe el evento ${id}`);
  if (evento.estado !== 'Reservado') {
    throw ErrorApi.conflicto(`El evento ${id} no está Reservado (estado actual: ${evento.estado})`);
  }
  await repo.registrarSena(id);
  return repo.buscarDetallado(id);
}

/**
 * Criterio 5 / RN-07: la cancelación requiere un mínimo de 48 horas de anticipación respecto del
 * horario de inicio del evento. Solo aplica una vez Reservado (tiene inicio fijado); un evento
 * todavía EnConsulta no es un compromiso formal y se puede descartar sin esa restricción.
 */
export async function cancelarEvento(
  id: number,
  repo: EventosRepositorio = eventosRepositorioReal,
) {
  const evento = await repo.buscarDetallado(id);
  if (!evento) throw ErrorApi.noEncontrado(`No existe el evento ${id}`);
  if (evento.estado !== 'EnConsulta' && evento.estado !== 'Reservado') {
    throw ErrorApi.conflicto(
      `El evento ${id} no admite cancelación (estado actual: ${evento.estado})`,
    );
  }
  if (evento.estado === 'Reservado' && evento.inicio) {
    const limite = new Date(evento.inicio.getTime() - CUARENTA_Y_OCHO_HORAS_EN_MS);
    if (new Date() > limite) {
      throw ErrorApi.reglaNegocio(
        'La cancelación requiere un mínimo de 48 horas de anticipación (RN-07)',
      );
    }
  }
  await repo.cancelar(id);
  return repo.buscarDetallado(id);
}

// Verificado empíricamente contra Postgres real (ver plan de HU-15): con Prisma 7.10.0 +
// @prisma/adapter-pg, una violación de la constraint EXCLUDE `evento_sin_solapamiento` llega como
// PrismaClientKnownRequestError con code 'P2039' (código genérico del driver adapter, no
// específico de exclusión), y el SQLSTATE real de Postgres (23P01 = exclusion_violation) queda
// anidado en meta.driverAdapterError.cause.code. Se chequea ese valor anidado en vez de 'P2039'
// porque 23P01 es el código estable documentado por Postgres para este caso puntual.
function esViolacionDeSolapamiento(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  const meta = error.meta as { driverAdapterError?: { cause?: { code?: string } } } | undefined;
  return meta?.driverAdapterError?.cause?.code === '23P01';
}

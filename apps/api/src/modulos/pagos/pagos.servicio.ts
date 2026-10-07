import type { CrearPago } from '@confluens/shared';
import { PORCENTAJE_IVA, PORCENTAJE_SENA } from '@confluens/shared';

import { Prisma } from '../../generated/prisma/client.js';
import { ErrorApi } from '../../lib/errores.js';
import { esViolacionDeSolapamiento } from '../../lib/prisma-errores.js';
import * as pagosRepositorioReal from './pagos.repositorio.js';
import type { PagosRepositorio } from './pagos.repositorio.js';

const CIEN = new Prisma.Decimal(100);
const PORCENTAJE_TOTAL = 100;

type PresupuestoDeBase = {
  id: number;
  estado: string;
  total: Prisma.Decimal;
  requiereFactura: boolean;
};

/**
 * Base de cobro de **RN-01**, que es la resolución de S-08: el porcentaje de la seña no se calcula
 * sobre el total del presupuesto sino sobre lo que el cliente realmente tiene que pagar.
 *
 * - `requiereFactura: true` → el cliente paga el total más el IVA, así que la base lo incluye.
 * - `requiereFactura: false` → la base es el total tal cual está guardado, sin IVA (RN-05).
 *
 * No se guarda en ninguna columna: se recalcula en cada consulta (sprint-02.md:130). Toda la
 * aritmética es con `Prisma.Decimal`, nunca con `number`: son importes.
 */
function calcularBaseDeCobro(presupuesto: PresupuestoDeBase): Prisma.Decimal {
  const total = new Prisma.Decimal(presupuesto.total);
  if (!presupuesto.requiereFactura) return total;
  return total.times(CIEN.plus(PORCENTAJE_IVA)).dividedBy(CIEN).toDecimalPlaces(2);
}

// `pagado >= base * porcentaje / 100`, pero multiplicando en vez de dividiendo: la división puede
// dejar decimales que no entran en Decimal(12,2) y un redondeo acá cambiaría de lado el umbral.
function alcanza(pagado: Prisma.Decimal, base: Prisma.Decimal, porcentaje: number): boolean {
  return pagado.times(CIEN).greaterThanOrEqualTo(base.times(porcentaje));
}

function armarSaldo(base: Prisma.Decimal, pagado: Prisma.Decimal, incluyeIva: boolean) {
  return {
    baseDeCobro: base.toFixed(2),
    incluyeIva,
    pagado: pagado.toFixed(2),
    saldo: base.minus(pagado).toFixed(2),
    // Único valor de presentación del conjunto, así que acá sí se pasa a number.
    porcentajeAbonado: base.isZero()
      ? 0
      : Number(pagado.times(CIEN).dividedBy(base).toDecimalPlaces(2)),
  };
}

/**
 * El presupuesto contra el que se cobra. Un evento puede acumular varios (dominio.md:55), pero solo
 * uno está vigente: se toma el más reciente que no esté `Cancelado`. El `Expirado` entra a propósito
 * en la búsqueda, para poder rechazar el pago con «presupuesto vencido» en vez de con «el evento no
 * tiene presupuesto», que es lo que pasaría si lo filtráramos (HU-13 C3).
 */
function presupuestoVigente(presupuestos: PresupuestoDeBase[]): PresupuestoDeBase | undefined {
  return presupuestos
    .filter((p) => p.estado !== 'Cancelado')
    .sort((a, b) => b.id - a.id)
    .at(0);
}

/**
 * HU-14 + HU-13: registra una entrega de plata contra el evento y, si con ella el acumulado cruza
 * los umbrales de la máquina de estados (dominio.md:21), hace avanzar el evento **en la misma
 * transacción** que el pago:
 *
 * - acumulado ≥ 20% de la base de cobro → presupuesto `Confirmado` y evento `Reservado`. Acá es
 *   donde el salón queda tomado: HU-13 no tiene endpoint propio (sprint-02.md:116).
 * - acumulado = 100% de la base → evento `Cobrado`.
 *
 * Un pago único puede cruzar los dos umbrales; se aplican los dos, en ese orden.
 */
export async function registrarPago(
  eventoId: number,
  datos: CrearPago,
  repo: PagosRepositorio = pagosRepositorioReal,
) {
  const evento = await repo.buscarDetallado(eventoId);
  if (!evento) throw ErrorApi.noEncontrado(`No existe el evento ${eventoId}`);

  if (evento.estado === 'Cancelado' || evento.estado === 'Cobrado') {
    throw ErrorApi.conflicto(
      `El evento ${eventoId} no admite pagos (estado actual: ${evento.estado})`,
    );
  }

  const presupuesto = presupuestoVigente(evento.presupuestos);
  if (!presupuesto) {
    throw ErrorApi.conflicto(
      `El evento ${eventoId} no tiene un presupuesto vigente contra el que cobrar`,
    );
  }
  // RN-06: pasados los 10 días el presupuesto vence y hay que rehacerlo con los precios del día.
  if (presupuesto.estado === 'Expirado') {
    throw ErrorApi.conflicto(
      'El presupuesto está vencido: hay que recalcularlo antes de registrar un pago',
    );
  }

  const medioPago = await repo.buscarMedioPagoActivo(datos.medioPagoId);
  if (!medioPago) {
    throw ErrorApi.noEncontrado(`No existe un medio de pago activo con id ${datos.medioPagoId}`);
  }

  const base = calcularBaseDeCobro(presupuesto);
  const monto = new Prisma.Decimal(datos.monto);

  try {
    return await repo.crearEnTransaccion(async (tx) => {
      // Dentro de la transacción: el acumulado con el que se decide reservar tiene que ser el del
      // momento de escribir, no uno leído antes.
      const pagadoAntes = (await repo.sumarPagos(eventoId, tx)) ?? new Prisma.Decimal(0);
      const pagado = new Prisma.Decimal(pagadoAntes).plus(monto);

      // Decisión del PO: no se acepta plata de más. No existe el saldo a favor en el sistema.
      if (pagado.greaterThan(base)) {
        throw ErrorApi.reglaNegocio(
          `El importe supera el total a pagar: quedan $${base.minus(pagadoAntes).toFixed(2)} de saldo`,
        );
      }

      const reservaElSalon =
        evento.estado === 'EnConsulta' && alcanza(pagado, base, PORCENTAJE_SENA);

      // Sin franja horaria cargada no hay con qué evaluar RN-12, así que no se puede reservar. Se
      // rechaza el pago en vez de aceptarlo sin reservar (el cliente pagó y el salón quedaría
      // libre) o de reservar a ciegas (riesgo de vender dos veces la misma franja).
      // Lo mismo sin salón: una consulta social puede no tenerlo todavía (ADR 0008).
      if (reservaElSalon && (!evento.salonId || !evento.inicio || !evento.fin)) {
        throw ErrorApi.reglaNegocio(
          'Hay que agendar la distribución y el horario del evento antes de cobrar la seña',
        );
      }

      let consultasEnConflicto: Awaited<ReturnType<typeof repo.buscarConsultasSuperpuestas>> = [];

      if (reservaElSalon && evento.salonId && evento.inicio && evento.fin) {
        const franja = {
          salonId: evento.salonId,
          inicio: evento.inicio,
          fin: evento.fin,
          excluirEventoId: eventoId,
        };
        // RN-12, parte "aplicación": informa con qué evento choca, algo que el error de la
        // constraint EXCLUDE de Postgres no dice.
        const solapado = await repo.buscarSolapamiento(franja, tx);
        if (solapado) {
          throw ErrorApi.conflicto(
            `El salón ya está reservado en ese horario por el evento #${solapado.id}`,
          );
        }
        consultasEnConflicto = await repo.buscarConsultasSuperpuestas(franja, tx);
      }

      const pago = await repo.crear(
        {
          eventoId,
          fecha: new Date(datos.fecha),
          monto,
          medioPagoId: datos.medioPagoId,
          observacion: datos.observacion,
        },
        tx,
      );

      let estadoEvento = evento.estado;
      if (reservaElSalon) {
        const reservado = await repo.confirmarPresupuestoYReservar(
          { eventoId, presupuestoId: presupuesto.id },
          tx,
        );
        estadoEvento = reservado.estado;
      }
      if (alcanza(pagado, base, PORCENTAJE_TOTAL)) {
        const cobrado = await repo.marcarCobrado(eventoId, tx);
        estadoEvento = cobrado.estado;
      }

      return {
        pago,
        saldo: armarSaldo(base, pagado, presupuesto.requiereFactura),
        estadoEvento,
        reservoElSalon: reservaElSalon,
        consultasEnConflicto,
      };
    });
  } catch (error) {
    // Red de seguridad ante una carrera: dos pagos concurrentes sobre la misma franja pueden pasar
    // el pre-chequeo de buscarSolapamiento y chocar recién acá con la constraint EXCLUDE.
    if (esViolacionDeSolapamiento(error)) {
      throw ErrorApi.conflicto('El salón ya está reservado en ese horario');
    }
    throw error;
  }
}

// HU-14 C2: el historial de pagos del evento más su saldo actualizado.
export async function obtenerCuenta(
  eventoId: number,
  repo: PagosRepositorio = pagosRepositorioReal,
) {
  const evento = await repo.buscarDetallado(eventoId);
  if (!evento) throw ErrorApi.noEncontrado(`No existe el evento ${eventoId}`);

  const presupuesto = presupuestoVigente(evento.presupuestos);
  const base = presupuesto ? calcularBaseDeCobro(presupuesto) : new Prisma.Decimal(0);
  const pagos = await repo.listarDeEvento(eventoId);
  const pagado = pagos.reduce(
    (suma, pago) => suma.plus(new Prisma.Decimal(pago.monto)),
    new Prisma.Decimal(0),
  );

  return { pagos, saldo: armarSaldo(base, pagado, presupuesto?.requiereFactura ?? false) };
}

export async function listarMediosPago(repo: PagosRepositorio = pagosRepositorioReal) {
  return repo.listarMediosPagoActivos();
}

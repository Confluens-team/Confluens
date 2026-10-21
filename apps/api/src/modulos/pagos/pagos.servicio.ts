import type { CrearMedioPago, CrearPago, FiltrosMediosPago } from '@confluens/shared';
import { admiteMedioPago, mediosPagoHabilitados, PORCENTAJE_SENA } from '@confluens/shared';

import { Prisma } from '../../generated/prisma/client.js';
import {
  alcanza,
  calcularBaseDeCobro,
  PORCENTAJE_TOTAL,
  type PresupuestoDeBase,
} from '../../lib/base-de-cobro.js';
import { ErrorApi } from '../../lib/errores.js';
import { esViolacionDeSolapamiento, mensajeDeSolapamiento } from '../../lib/prisma-errores.js';
import * as pagosRepositorioReal from './pagos.repositorio.js';
import type { PagosRepositorio } from './pagos.repositorio.js';

const CIEN = new Prisma.Decimal(100);

/**
 * El saldo del evento. `senaRegistrada` dice si el evento ya se reservó (tiene `senaRegistradaEn`):
 * en ese caso la seña cuenta como alcanzada aunque después haya subido el total (RN-09).
 */
function armarSaldo(
  base: Prisma.Decimal,
  pagado: Prisma.Decimal,
  incluyeIva: boolean,
  senaRegistrada: boolean,
) {
  return {
    baseDeCobro: base.toFixed(2),
    incluyeIva,
    pagado: pagado.toFixed(2),
    // Puede ser negativo: es el saldo a favor del cliente (decisión del PO, 16/10/2026).
    saldo: base.minus(pagado).toFixed(2),
    // Único valor de presentación del conjunto, así que acá sí se pasa a number.
    porcentajeAbonado: base.isZero()
      ? 0
      : Number(pagado.times(CIEN).dividedBy(base).toDecimalPlaces(2)),
    // Para arriba al centavo: con IVA el 20% casi nunca es exacto y nadie entrega medio centavo.
    montoSena: base
      .times(PORCENTAJE_SENA)
      .dividedBy(CIEN)
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_UP)
      .toFixed(2),
    senaAlcanzada: senaRegistrada || (!base.isZero() && alcanza(pagado, base, PORCENTAJE_SENA)),
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
  // RN-14: los medios disponibles dependen de la casilla «El cliente requiere factura» del
  // presupuesto y de la habilitación de cada medio (con factura, sin factura o los dos), que se
  // elige al darlo de alta (HU-19). La web ya filtra el desplegable; esto es lo que hace que la
  // regla valga igual contra la API.
  if (!admiteMedioPago(medioPago, presupuesto.requiereFactura)) {
    const activos = await repo.listarMediosPagoActivos();
    const habilitados = mediosPagoHabilitados(activos, presupuesto.requiereFactura)
      .map((medio) => medio.nombre)
      .join(', ');
    const caso = presupuesto.requiereFactura ? 'con factura' : 'sin factura';
    throw ErrorApi.reglaNegocio(
      `No se puede cobrar con ${medioPago.nombre} en un evento ${caso}: los medios habilitados son ${habilitados}`,
    );
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
      // Los salones que ocupa el evento: varios a la vez (ADR 0011).
      const salonIds = evento.salones.map((s) => s.salonId);
      if (reservaElSalon && (salonIds.length === 0 || !evento.inicio || !evento.fin)) {
        throw ErrorApi.reglaNegocio(
          'Hay que agendar la distribución y el horario del evento antes de cobrar la seña',
        );
      }

      let consultasEnConflicto: Awaited<ReturnType<typeof repo.buscarConsultasSuperpuestas>> = [];

      if (reservaElSalon && salonIds.length > 0 && evento.inicio && evento.fin) {
        const franja = {
          salonIds,
          inicio: evento.inicio,
          fin: evento.fin,
          excluirEventoId: eventoId,
        };
        // RN-12, parte "aplicación": informa con qué evento choca, algo que el error de la
        // constraint EXCLUDE de Postgres no dice.
        const solapado = await repo.buscarSolapamiento(franja, tx);
        if (solapado) {
          throw ErrorApi.conflicto(mensajeDeSolapamiento(solapado, salonIds));
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
        saldo: armarSaldo(
          base,
          pagado,
          presupuesto.requiereFactura,
          evento.senaRegistradaEn !== null || reservaElSalon,
        ),
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

type PagoParaHitos = { id: number; monto: Prisma.Decimal | string; creadoEn: Date };

/**
 * HU-21: marca en el historial el pago que completó la seña y el que completó el total, para que la
 * cuenta los destaque. Se recorren en orden de registro (`id`), que no siempre es el de `fecha`: la
 * fecha del pago la elige quien lo carga.
 *
 * - **Seña:** el pago registrado más cerca del instante de `senaRegistradaEn`, que se escribe en la
 *   misma transacción que ese pago. Se busca el más cercano y no «el último anterior» para no
 *   depender de que el reloj de la base y el del servidor coincidan al milisegundo. Un evento
 *   Reservado o Cobrado sin esa marca (datos anteriores a HU-13) usa el primero cuyo acumulado
 *   llega al 20% de la base actual. Un evento que nunca se reservó no tiene pago de seña.
 * - **Pago completo:** el último registrado, solo si el evento está Cobrado.
 */
export function marcarHitos<P extends PagoParaHitos>(
  pagos: P[],
  evento: { estado: string; senaRegistradaEn: Date | null },
  base: Prisma.Decimal,
): (P & { completaSena: boolean; completaPago: boolean })[] {
  const porRegistro = [...pagos].sort((a, b) => a.id - b.id);

  let senaId: number | undefined;
  if (evento.senaRegistradaEn) {
    const instante = evento.senaRegistradaEn.getTime();
    senaId = porRegistro.reduce<P | undefined>(
      (masCercano, pago) =>
        !masCercano ||
        Math.abs(pago.creadoEn.getTime() - instante) <
          Math.abs(masCercano.creadoEn.getTime() - instante)
          ? pago
          : masCercano,
      undefined,
    )?.id;
  } else if (evento.estado === 'Reservado' || evento.estado === 'Cobrado') {
    let acumulado = new Prisma.Decimal(0);
    senaId = porRegistro.find((pago) => {
      acumulado = acumulado.plus(new Prisma.Decimal(pago.monto));
      return alcanza(acumulado, base, PORCENTAJE_SENA);
    })?.id;
  }
  const pagoCompletoId = evento.estado === 'Cobrado' ? porRegistro.at(-1)?.id : undefined;

  return pagos.map((pago) => ({
    ...pago,
    completaSena: pago.id === senaId,
    completaPago: pago.id === pagoCompletoId,
  }));
}

// HU-21 (antes HU-14 C2): el historial de pagos del evento, con sus hitos, más el saldo.
export async function obtenerCuenta(
  eventoId: number,
  repo: PagosRepositorio = pagosRepositorioReal,
) {
  const evento = await repo.buscarDetallado(eventoId);
  if (!evento) throw ErrorApi.noEncontrado(`No existe el evento ${eventoId}`);

  // Un evento dado de baja (HU-22) tiene su presupuesto Cancelado y ninguno vigente. Su cuenta se
  // sigue midiendo contra ese presupuesto: si no, la base quedaría en 0 y lo pagado aparecería como
  // saldo a favor, cuando lo abonado no se reintegra (RN-06).
  const presupuesto =
    presupuestoVigente(evento.presupuestos) ??
    [...evento.presupuestos].sort((a, b) => b.id - a.id).at(0);
  const base = presupuesto ? calcularBaseDeCobro(presupuesto) : new Prisma.Decimal(0);
  const pagos = await repo.listarDeEvento(eventoId);
  const pagado = pagos.reduce(
    (suma, pago) => suma.plus(new Prisma.Decimal(pago.monto)),
    new Prisma.Decimal(0),
  );

  return {
    pagos: marcarHitos(pagos, evento, base),
    saldo: armarSaldo(
      base,
      pagado,
      presupuesto?.requiereFactura ?? false,
      evento.senaRegistradaEn !== null,
    ),
  };
}

// Sin filtros, los activos: es lo que usa el formulario de cobro. El listado de HU-20 pide también
// los dados de baja, para mostrar el estado de cada medio.
export async function listarMediosPago(
  { incluirInactivos }: FiltrosMediosPago = {},
  repo: PagosRepositorio = pagosRepositorioReal,
) {
  return incluirInactivos ? repo.listarTodosLosMediosPago() : repo.listarMediosPagoActivos();
}

/**
 * HU-19: alta de un medio de pago, con su habilitación para cobros con factura, sin factura o los
 * dos (RN-14). El nombre llega recortado por esquemaCrearMedioPago y es único sin distinguir
 * mayúsculas: «efectivo» choca con «Efectivo», aunque ese medio esté dado de baja.
 */
export async function crearMedioPago(
  datos: CrearMedioPago,
  repo: PagosRepositorio = pagosRepositorioReal,
) {
  const existente = await repo.buscarMedioPagoPorNombre(datos.nombre);
  if (existente) {
    throw ErrorApi.conflicto(`Ya existe un medio de pago llamado «${existente.nombre}»`);
  }
  return repo.crearMedioPago(datos);
}

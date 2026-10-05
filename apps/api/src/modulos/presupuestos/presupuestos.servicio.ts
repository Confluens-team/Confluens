import type { CrearPresupuesto, FiltrosPresupuestos, PresupuestoListado } from '@confluens/shared';

import { Prisma } from '../../generated/prisma/client.js';
import { ErrorApi } from '../../lib/errores.js';
import * as presupuestosRepositorioReal from './presupuestos.repositorio.js';
import type { PresupuestosRepositorio } from './presupuestos.repositorio.js';

// RN-08: el presupuesto tiene una vigencia de 10 días desde su emisión. Vencido, lo pasa a
// Expirado el trabajo de trabajos/vigencia.trabajo.ts.
export const DIAS_DE_VIGENCIA = 10;

export function calcularVencimiento(fechaEmision: Date): Date {
  const venceEn = new Date(fechaEmision);
  venceEn.setUTCDate(venceEn.getUTCDate() + DIAS_DE_VIGENCIA);
  return venceEn;
}

// Total sin IVA (RN-05): la suma de todas las líneas, tercerizados incluidos (dominio.md).
function sumarLineas(lineas: LineaCalculada[]): Prisma.Decimal {
  return lineas.reduce((acumulado, linea) => acumulado.plus(linea.subtotal), new Prisma.Decimal(0));
}

interface LineaCalculada {
  servicioId: number | null;
  descripcion: string;
  cantidad: number;
  precioUnitario: string;
  subtotal: string;
}

/**
 * Genera un presupuesto estimado a partir de salón, fecha, cantidad de personas y servicios
 * seleccionados (HU-09). En una única operación: busca o crea el Cliente por correo, crea el
 * Evento en EnConsulta, y crea el Presupuesto en Estimado con el detalle línea por línea.
 *
 * Reglas aplicadas:
 * - Criterio 1: el total suma el precio del salón (según tipoJornada) más cada servicio por su
 *   cantidad, con una LineaPresupuesto por cada concepto.
 * - Criterio 2 / RN-04: cada línea de servicio usa la cantidad indicada por el RE, no
 *   necesariamente Evento.cantidadPersonas.
 * - Criterio 3 / RN-05: Salon y Servicio ya guardan sus precios sin IVA; no hay conversión acá.
 * - Criterio 4 (corregido el 24/09/2026, dominio.md): los servicios tercerizados suman al total
 *   como cualquier otro; lo que no reciben es el incremento mensual.
 * - Criterio 5: se toman Salon.precioJornadaCompleta/precioMediaJornada y Servicio.precio
 *   vigentes al momento del pedido (no hay versionado de precios en el Sprint 1).
 * - Criterio 6: el Presupuesto nace en Estimado (default del schema, no se fija acá).
 * - HU-10 / RN-08: vence a los 10 días de la emisión (`venceEn`).
 * - HU-15: si `datos.solicitudId` viene, se vincula `Solicitud.eventoId` al evento recién creado
 *   (el RE "tomó" esa solicitud), para que el detalle del evento muestre los datos originales del
 *   formulario. Se valida antes de escribir nada que la solicitud exista y no esté ya tomada.
 */
export async function generarPresupuesto(
  datos: CrearPresupuesto,
  repo: PresupuestosRepositorio = presupuestosRepositorioReal,
) {
  // Validaciones de catálogo primero, sin escribir nada: si el pedido es inválido, no se crea un
  // Cliente ni un Evento huérfanos.
  const salon = await repo.buscarSalon(datos.salonId);
  if (!salon) throw ErrorApi.noEncontrado(`No existe el salón ${datos.salonId}`);

  if (datos.solicitudId !== undefined) {
    const solicitud = await repo.buscarSolicitud(datos.solicitudId);
    if (!solicitud) throw ErrorApi.noEncontrado(`No existe la solicitud ${datos.solicitudId}`);
    if (solicitud.eventoId !== null) {
      throw ErrorApi.conflicto(`La solicitud ${datos.solicitudId} ya fue tomada`);
    }
  }

  const idsServicios = datos.servicios.map((s) => s.servicioId);
  const servicios = idsServicios.length > 0 ? await repo.buscarServiciosPorIds(idsServicios) : [];
  const serviciosPorId = new Map(servicios.map((s) => [s.id, s]));

  for (const seleccionado of datos.servicios) {
    const servicio = serviciosPorId.get(seleccionado.servicioId);
    if (!servicio) {
      throw ErrorApi.noEncontrado(`No existe el servicio ${seleccionado.servicioId}`);
    }
    if (!servicio.activo) {
      throw ErrorApi.reglaNegocio(`El servicio "${servicio.nombre}" no está activo`);
    }
  }

  // Línea del salón: cantidad=1 porque el precio no es "por persona", es fijo para el evento
  // completo. servicioId null: modelo-datos.md documenta que la línea del salón se identifica
  // por su descripción, no por una FK a Servicio.
  const precioSalon =
    datos.tipoJornada === 'completa' ? salon.precioJornadaCompleta : salon.precioMediaJornada;
  const lineaSalon: LineaCalculada = {
    servicioId: null,
    descripcion: `Salón ${salon.nombre} (${datos.tipoJornada === 'completa' ? 'jornada completa' : 'media jornada'})`,
    cantidad: 1,
    precioUnitario: precioSalon.toFixed(2),
    subtotal: precioSalon.toFixed(2),
  };

  const lineasServicios: LineaCalculada[] = datos.servicios.map((seleccionado) => {
    // El bucle de validación de arriba ya garantizó que existe.
    const servicio = serviciosPorId.get(seleccionado.servicioId)!;
    const subtotal = servicio.precio.times(seleccionado.cantidad);
    return {
      servicioId: servicio.id,
      descripcion: servicio.nombre,
      cantidad: seleccionado.cantidad,
      precioUnitario: servicio.precio.toFixed(2),
      subtotal: subtotal.toFixed(2),
    };
  });

  const todasLasLineas = [lineaSalon, ...lineasServicios];
  const total = sumarLineas(todasLasLineas);

  const fechaEmision = new Date();

  return repo.crearEnTransaccion(async (tx) => {
    let cliente = await repo.buscarClientePorCorreo(datos.correo, tx);
    if (!cliente) {
      cliente = await repo.crearCliente(
        { nombre: datos.nombre, telefono: datos.telefono, correo: datos.correo },
        tx,
      );
    }

    const evento = await repo.crearEvento(
      {
        clienteId: cliente.id,
        salonId: datos.salonId,
        fecha: new Date(datos.fecha),
        cantidadPersonas: datos.cantidadPersonas,
      },
      tx,
    );

    if (datos.solicitudId !== undefined) {
      await repo.vincularSolicitudAEvento(datos.solicitudId, evento.id, tx);
    }

    return repo.crearPresupuestoConLineas(
      {
        eventoId: evento.id,
        fechaEmision,
        venceEn: calcularVencimiento(fechaEmision),
        total: total.toFixed(2),
        lineas: todasLasLineas,
      },
      tx,
    );
  });
}

// HU-10: listado del personal con sus filtros. Mapea a PresupuestoListado para que los tipos de
// Prisma no lleguen a la web: importes como string y la fecha del evento como YYYY-MM-DD.
export async function listarPresupuestos(
  filtros: FiltrosPresupuestos,
  repo: PresupuestosRepositorio = presupuestosRepositorioReal,
): Promise<PresupuestoListado[]> {
  const presupuestos = await repo.obtenerPresupuestos(filtros);
  return presupuestos.map(({ evento, ...presupuesto }) => ({
    id: presupuesto.id,
    eventoId: presupuesto.eventoId,
    estado: presupuesto.estado,
    fechaEmision: presupuesto.fechaEmision.toISOString(),
    venceEn: presupuesto.venceEn.toISOString(),
    total: presupuesto.total.toFixed(2),
    fechaEvento: evento.fecha.toISOString().slice(0, 10),
    cliente: evento.cliente,
    salon: evento.salon,
  }));
}

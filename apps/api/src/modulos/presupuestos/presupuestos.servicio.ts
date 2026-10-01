import type { CrearPresupuesto } from '@confluens/shared';

import { Prisma } from '../../generated/prisma/client.js';
import { ErrorApi } from '../../lib/errores.js';
import * as presupuestosRepositorioReal from './presupuestos.repositorio.js';
import type { PresupuestosRepositorio } from './presupuestos.repositorio.js';

interface LineaCalculada {
  servicioId: number | null;
  descripcion: string;
  cantidad: number;
  precioUnitario: string;
  subtotal: string;
  entraEnTotal: boolean;
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
 * - Criterio 4: los servicios tercerizados generan línea (transparencia para el RE: qué se
 *   cotizó) pero su subtotal se excluye de la suma que compone `total`. Decisión de diseño
 *   confirmada para esta implementación, no una regla de negocio cerrada (ver plan de HU-09):
 *   si se define lo contrario, alcanza con cambiar el filtro `entraEnTotal` de acá abajo.
 * - Criterio 5: se toman Salon.precioJornadaCompleta/precioMediaJornada y Servicio.precio
 *   vigentes al momento del pedido (no hay versionado de precios en el Sprint 1).
 * - Criterio 6: el Presupuesto nace en Estimado (default del schema, no se fija acá).
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
    entraEnTotal: true,
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
      entraEnTotal: !servicio.tercerizado,
    };
  });

  const todasLasLineas = [lineaSalon, ...lineasServicios];
  const total = todasLasLineas
    .filter((linea) => linea.entraEnTotal)
    .reduce((acumulado, linea) => acumulado.plus(linea.subtotal), new Prisma.Decimal(0));

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
        total: total.toFixed(2),
        lineas: todasLasLineas.map(({ entraEnTotal: _entraEnTotal, ...linea }) => linea),
      },
      tx,
    );
  });
}

export async function listarPresupuestos(
  repo: PresupuestosRepositorio = presupuestosRepositorioReal,
) {
  return repo.obtenerPresupuestos();
}

import {
  DIAS_VIGENCIA_PRESUPUESTO,
  type ConsultaDetallada,
  type CrearConsultaSocial,
  type CrearPresupuesto,
  type FiltrosPresupuestos,
  type ModificarPresupuesto,
  type PresupuestoListado,
  type TipoJornada,
} from '@confluens/shared';

import { Prisma } from '../../generated/prisma/client.js';
import { alcanza, calcularBaseDeCobro, PORCENTAJE_TOTAL } from '../../lib/base-de-cobro.js';
import { ErrorApi } from '../../lib/errores.js';
import { esViolacionDeSolapamiento } from '../../lib/prisma-errores.js';
import * as presupuestosRepositorioReal from './presupuestos.repositorio.js';
import type { PresupuestosRepositorio } from './presupuestos.repositorio.js';

// RN-08: el presupuesto tiene una vigencia de 10 días desde su emisión. Vencido, lo pasa a
// Expirado el trabajo de trabajos/vigencia.trabajo.ts.
export function calcularVencimiento(fechaEmision: Date): Date {
  const venceEn = new Date(fechaEmision);
  venceEn.setUTCDate(venceEn.getUTCDate() + DIAS_VIGENCIA_PRESUPUESTO);
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
  aCotizar: boolean;
}

// Sin precio (null) la línea queda "a cotizar" (HU-11): va en 0, así no suma al total, hasta que el
// personal complete el precio.
function calcularLinea(
  servicioId: number | null,
  descripcion: string,
  cantidad: number,
  precioUnitario: Prisma.Decimal | string | null,
): LineaCalculada {
  const precio = new Prisma.Decimal(precioUnitario ?? 0);
  return {
    servicioId,
    descripcion,
    cantidad,
    precioUnitario: precio.toFixed(2),
    subtotal: precio.times(cantidad).toFixed(2),
    aCotizar: precioUnitario === null,
  };
}

// La línea del salón no tiene servicio: se identifica por esta descripción, y de ella sale la
// jornada al editar la consulta (jornadaDeLineaSalon).
function descripcionSalon(nombre: string, jornada: TipoJornada): string {
  return `Salón ${nombre} (${jornada === 'completa' ? 'jornada completa' : 'media jornada'})`;
}

// La línea del salón es la primera sin servicio: se crea antes que las demás y las líneas se leen
// ordenadas por id. Las otras líneas sin servicio son adicionales escritos a mano (HU-12).
function lineaDelSalon<T extends { servicioId: number | null }>(lineas: T[]): T | undefined {
  return lineas.find((linea) => linea.servicioId === null);
}

export function jornadaDeLineaSalon(descripcion: string | undefined): TipoJornada {
  return descripcion?.endsWith('(media jornada)') ? 'media' : 'completa';
}

function precioDeSalon(
  salon: { precioJornadaCompleta: Prisma.Decimal; precioMediaJornada: Prisma.Decimal },
  jornada: TipoJornada,
): Prisma.Decimal {
  return jornada === 'completa' ? salon.precioJornadaCompleta : salon.precioMediaJornada;
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
 *   como cualquier otro; lo que no reciben es el incremento mensual. Un tercerizado sin precio
 *   entra "a cotizar" (HU-11): sin importe y sin sumar.
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
  const lineaSalon = calcularLinea(
    null,
    descripcionSalon(salon.nombre, datos.tipoJornada),
    1,
    precioDeSalon(salon, datos.tipoJornada),
  );

  const lineasServicios = datos.servicios.map((seleccionado) => {
    // El bucle de validación de arriba ya garantizó que existe.
    const servicio = serviciosPorId.get(seleccionado.servicioId)!;
    return calcularLinea(servicio.id, servicio.nombre, seleccionado.cantidad, servicio.precio);
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
        tipo: 'Corporativo',
        tipoJornada: datos.tipoJornada,
        horaInicioEstimada: datos.horaInicioEstimada ?? null,
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

/**
 * Registra la consulta de un evento social (ADR 0008). Los eventos sociales son tan variables que
 * no pasan por el cotizador: el cliente cuenta fecha, personas, jornada, hora estimada y qué evento
 * es, y el Responsable de Eventos arma el presupuesto después.
 *
 * - El cliente es el de la sesión; nunca se crea una ficha (dominio.md: solo por autorregistro).
 * - Crea el evento EnConsulta, tipo Social y sin salón, y su único presupuesto (decisión del PO,
 *   06/10/2026) en Estimado, sin líneas, en 0 y sin vencimiento: la vigencia de 10 días arranca
 *   cuando el personal lo arma (decisión del PO, 07/10/2026).
 * - Si viene `solicitudId`, la vincula igual que generarPresupuesto.
 */
export async function registrarConsultaSocial(
  usuarioId: number,
  datos: CrearConsultaSocial,
  repo: PresupuestosRepositorio = presupuestosRepositorioReal,
) {
  const cliente = await repo.buscarClientePorUsuarioId(usuarioId);
  if (!cliente) throw ErrorApi.noEncontrado('La sesión no corresponde a un cliente');

  if (datos.solicitudId !== undefined) {
    const solicitud = await repo.buscarSolicitud(datos.solicitudId);
    if (!solicitud) throw ErrorApi.noEncontrado(`No existe la solicitud ${datos.solicitudId}`);
    if (solicitud.eventoId !== null) {
      throw ErrorApi.conflicto(`La solicitud ${datos.solicitudId} ya fue tomada`);
    }
  }

  return repo.crearEnTransaccion(async (tx) => {
    const evento = await repo.crearEvento(
      {
        clienteId: cliente.id,
        salonId: null,
        fecha: new Date(datos.fecha),
        cantidadPersonas: datos.cantidadPersonas,
        tipo: 'Social',
        tipoSocial: datos.tipoSocial,
        tipoSocialDetalle: datos.tipoSocial === 'Otro' ? datos.tipoSocialDetalle : null,
        tipoJornada: datos.tipoJornada,
        horaInicioEstimada: datos.horaInicioEstimada ?? null,
      },
      tx,
    );

    if (datos.solicitudId !== undefined) {
      await repo.vincularSolicitudAEvento(datos.solicitudId, evento.id, tx);
    }

    return repo.crearPresupuestoConLineas(
      { eventoId: evento.id, fechaEmision: new Date(), venceEn: null, total: '0.00', lineas: [] },
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
    venceEn: presupuesto.venceEn?.toISOString() ?? null,
    total: presupuesto.total.toFixed(2),
    fechaEvento: evento.fecha.toISOString().slice(0, 10),
    tipo: evento.tipo,
    tipoSocial: evento.tipoSocial,
    tipoSocialDetalle: evento.tipoSocialDetalle,
    cliente: evento.cliente,
    salon: evento.salon,
  }));
}

type PresupuestoDetalladoRepo = NonNullable<
  Awaited<ReturnType<PresupuestosRepositorio['buscarPresupuestoDetallado']>>
>;

function mapearConsulta(presupuesto: PresupuestoDetalladoRepo): ConsultaDetallada {
  const { evento } = presupuesto;
  const lineaSalon = lineaDelSalon(presupuesto.lineas);
  return {
    id: presupuesto.id,
    estado: presupuesto.estado,
    fechaEmision: presupuesto.fechaEmision.toISOString(),
    venceEn: presupuesto.venceEn?.toISOString() ?? null,
    total: presupuesto.total.toFixed(2),
    requiereFactura: presupuesto.requiereFactura,
    // Los eventos anteriores a ADR 0008 no guardan la jornada: sale de la línea del salón.
    tipoJornada: evento.tipoJornada ?? jornadaDeLineaSalon(lineaSalon?.descripcion),
    evento: {
      id: evento.id,
      estado: evento.estado,
      fecha: evento.fecha.toISOString().slice(0, 10),
      cantidadPersonas: evento.cantidadPersonas,
      tipo: evento.tipo,
      tipoSocial: evento.tipoSocial,
      tipoSocialDetalle: evento.tipoSocialDetalle,
      horaInicioEstimada: evento.horaInicioEstimada,
      distribucion: evento.distribucion
        ? { id: evento.distribucion.id, nombre: evento.distribucion.nombre }
        : null,
      inicio: evento.inicio?.toISOString() ?? null,
      fin: evento.fin?.toISOString() ?? null,
    },
    cliente: {
      id: evento.cliente.id,
      nombre: evento.cliente.nombre,
      apellido: evento.cliente.apellido,
      correo: evento.cliente.correo,
      telefono: evento.cliente.telefono,
    },
    salon: evento.salon
      ? {
          id: evento.salon.id,
          nombre: evento.salon.nombre,
          capacidadMaxima: evento.salon.capacidadMaxima,
        }
      : null,
    lineas: presupuesto.lineas.map(({ servicio, ...linea }) => ({
      id: linea.id,
      presupuestoId: linea.presupuestoId,
      servicioId: linea.servicioId,
      descripcion: linea.descripcion,
      cantidad: linea.cantidad,
      precioUnitario: linea.precioUnitario.toFixed(2),
      subtotal: linea.subtotal.toFixed(2),
      aCotizar: linea.aCotizar,
      tipo:
        linea.id === lineaSalon?.id
          ? 'salon'
          : linea.servicioId === null
            ? 'adicional'
            : 'servicio',
      tercerizado: servicio?.tercerizado ?? false,
    })),
  };
}

async function buscarOFallar(id: number, repo: PresupuestosRepositorio) {
  const presupuesto = await repo.buscarPresupuestoDetallado(id);
  if (!presupuesto) throw ErrorApi.noEncontrado(`No existe el presupuesto ${id}`);
  return presupuesto;
}

// HU-12: solo se tocan las consultas en curso (Estimado o Expirado) de un evento que sigue en
// consulta. Un Confirmado ya pasó a la agenda y un Cancelado se dio de baja.
function exigirConsultaEnCurso(presupuesto: PresupuestoDetalladoRepo, accion: string) {
  if (presupuesto.estado !== 'Estimado' && presupuesto.estado !== 'Expirado') {
    throw ErrorApi.conflicto(`No se puede ${accion} un presupuesto ${presupuesto.estado}`);
  }
  if (presupuesto.evento.estado !== 'EnConsulta') {
    throw ErrorApi.conflicto(
      `No se puede ${accion} el presupuesto de un evento ${presupuesto.evento.estado}`,
    );
  }
}

// RN-09: el Responsable de Eventos puede modificar en todo momento, también un evento ya
// confirmado (decisión de Franco, 08/10/2026). Es el presupuesto Confirmado de un evento que sigue
// ocupando el salón; uno Cancelado ya no se toca.
function esConfirmadoVigente(presupuesto: PresupuestoDetalladoRepo): boolean {
  return (
    presupuesto.estado === 'Confirmado' &&
    (presupuesto.evento.estado === 'Reservado' || presupuesto.evento.estado === 'Cobrado')
  );
}

/**
 * Un evento confirmado ya tiene horario (inicio y fin) y distribución. Si cambia la fecha, el
 * horario se corre los mismos días y conserva las horas; si cambia el salón, se busca la
 * distribución del mismo nombre en el salón nuevo. Que la franja nueva esté libre lo controla la
 * restricción EXCLUDE al guardar (RN-12).
 */
async function reubicarHorario(
  evento: PresupuestoDetalladoRepo['evento'],
  datos: ModificarPresupuesto,
  repo: PresupuestosRepositorio,
): Promise<Prisma.EventoUpdateInput> {
  const corrimiento = new Date(datos.fecha).getTime() - evento.fecha.getTime();
  const horario =
    corrimiento !== 0 && evento.inicio && evento.fin
      ? {
          inicio: new Date(evento.inicio.getTime() + corrimiento),
          fin: new Date(evento.fin.getTime() + corrimiento),
        }
      : {};
  if (datos.salonId === null || datos.salonId === evento.salonId) return horario;

  const distribucion = evento.distribucion
    ? await repo.buscarDistribucionPorNombre(datos.salonId, evento.distribucion.nombre)
    : null;
  return {
    ...horario,
    distribucion: distribucion ? { connect: { id: distribucion.id } } : { disconnect: true },
  };
}

export async function obtenerConsulta(
  id: number,
  repo: PresupuestosRepositorio = presupuestosRepositorioReal,
): Promise<ConsultaDetallada> {
  return mapearConsulta(await buscarOFallar(id, repo));
}

// ADR 0008: el tipo que queda después de modificar. Sin `tipo` en el pedido se mantiene el del
// evento; lo mismo con el tipo social y su detalle. Un corporativo necesita salón y un social, su
// tipo social ("Otro" con su detalle).
function resolverTipo(datos: ModificarPresupuesto, evento: PresupuestoDetalladoRepo['evento']) {
  const tipo = datos.tipo ?? evento.tipo;
  if (tipo === 'Corporativo') {
    if (datos.salonId === null) {
      throw ErrorApi.reglaNegocio('Un evento corporativo necesita salón');
    }
    return { tipo, tipoSocial: null, tipoSocialDetalle: null };
  }
  const tipoSocial = datos.tipoSocial !== undefined ? datos.tipoSocial : evento.tipoSocial;
  if (!tipoSocial) throw ErrorApi.reglaNegocio('Elegí qué tipo de evento social es');
  const tipoSocialDetalle =
    tipoSocial === 'Otro'
      ? datos.tipoSocialDetalle !== undefined
        ? datos.tipoSocialDetalle
        : evento.tipoSocialDetalle
      : null;
  if (tipoSocial === 'Otro' && !tipoSocialDetalle) {
    throw ErrorApi.reglaNegocio('Contanos qué evento es');
  }
  return { tipo, tipoSocial, tipoSocialDetalle };
}

/**
 * Modifica una consulta después de hablar con el cliente (HU-12). Recibe el estado completo:
 * fecha, salón, personas, jornada y servicios, y también el tipo de evento y la hora estimada
 * (ADR 0008).
 *
 * - Estimado o Expirado con el evento EnConsulta, o Confirmado con el evento Reservado o Cobrado
 *   (RN-09). Cualquier otro caso, 409.
 * - Un servicio que ya estaba conserva su precio congelado; uno nuevo toma el vigente y tiene que
 *   estar activo. Un `precioUnitario` explícito es un ajuste comercial (RN-03) y manda.
 * - La línea del salón conserva su precio si no cambian el salón ni la jornada; si cambian, toma
 *   el vigente. `precioSalon` la ajusta a mano.
 * - Los adicionales escritos a mano entran con la descripción y el precio que se cargaron.
 * - Un tercerizado a cotizar sigue así hasta que llega su precio (HU-11).
 * - `requiereFactura` (RN-01) define si la base de cobro de la seña incluye el IVA.
 * - «Recalcular» un Expirado es esto mismo, con los precios vigentes que arma la pantalla: el
 *   presupuesto sigue siendo el mismo (decisión del PO, 05/10/2026).
 * - El total suma todas las líneas, tercerizados incluidos.
 * - Queda Estimado y la vigencia vuelve a contar 10 días desde ahora (decisión del PO,
 *   05/10/2026), también si estaba Expirado.
 * - Una consulta social puede seguir sin salón (no hay línea del salón). Si no queda ninguna línea,
 *   el presupuesto sigue sin armar y sin vencimiento: los 10 días arrancan cuando el personal carga
 *   la primera (decisión del PO, 07/10/2026).
 * - Un Confirmado sigue Confirmado y no vuelve a contar vigencia: ya se cobró la seña. Necesita
 *   salón, se le corre el horario si cambia la fecha (ver `reubicarHorario`) y su evento queda
 *   Cobrado si lo pagado cubre el total nuevo, o Reservado si no. Si el total queda por debajo de
 *   lo pagado, se guarda igual y el saldo queda negativo (decisión de Franco, 08/10/2026).
 */
export async function modificarPresupuesto(
  id: number,
  datos: ModificarPresupuesto,
  repo: PresupuestosRepositorio = presupuestosRepositorioReal,
): Promise<ConsultaDetallada> {
  const presupuesto = await buscarOFallar(id, repo);
  const confirmado = esConfirmadoVigente(presupuesto);
  if (!confirmado) exigirConsultaEnCurso(presupuesto, 'modificar');
  if (confirmado && datos.salonId === null) {
    throw ErrorApi.reglaNegocio('Un evento confirmado necesita salón');
  }
  const tipo = resolverTipo(datos, presupuesto.evento);

  const salon = datos.salonId === null ? null : await repo.buscarSalon(datos.salonId);
  if (datos.salonId !== null && !salon) {
    throw ErrorApi.noEncontrado(`No existe el salón ${datos.salonId}`);
  }

  const lineasAnteriores = new Map(
    presupuesto.lineas
      .filter((linea) => linea.servicioId !== null)
      .map((linea) => [linea.servicioId!, linea]),
  );
  const ids = datos.servicios.map((s) => s.servicioId);
  const catalogo = new Map(
    (ids.length > 0 ? await repo.buscarServiciosPorIds(ids) : []).map((s) => [s.id, s]),
  );

  const lineasServicios = datos.servicios.map((elegido) => {
    const servicio = catalogo.get(elegido.servicioId);
    if (!servicio) throw ErrorApi.noEncontrado(`No existe el servicio ${elegido.servicioId}`);
    const anterior = lineasAnteriores.get(elegido.servicioId);
    if (!anterior && !servicio.activo) {
      throw ErrorApi.reglaNegocio(`El servicio "${servicio.nombre}" no está activo`);
    }
    // Lo que ya tenía precio lo conserva; lo nuevo, y lo que seguía a cotizar, toma el del catálogo,
    // que también puede ser null (sigue a cotizar).
    const congelado = anterior && !anterior.aCotizar ? anterior.precioUnitario : undefined;
    const precio = elegido.precioUnitario ?? congelado ?? servicio.precio;
    return calcularLinea(
      servicio.id,
      anterior?.descripcion ?? servicio.nombre,
      elegido.cantidad,
      precio,
    );
  });

  const salonAnterior = lineaDelSalon(presupuesto.lineas);
  const mismoSalon =
    !!salonAnterior &&
    presupuesto.evento.salonId === datos.salonId &&
    jornadaDeLineaSalon(salonAnterior.descripcion) === datos.tipoJornada;
  const lineaSalon = salon
    ? calcularLinea(
        null,
        descripcionSalon(salon.nombre, datos.tipoJornada),
        1,
        datos.precioSalon ??
          (mismoSalon ? salonAnterior.precioUnitario : precioDeSalon(salon, datos.tipoJornada)),
      )
    : undefined;

  const adicionales = datos.adicionales.map((adicional) =>
    calcularLinea(null, adicional.descripcion, adicional.cantidad, adicional.precioUnitario),
  );

  const lineas = [...(lineaSalon ? [lineaSalon] : []), ...lineasServicios, ...adicionales];
  const total = sumarLineas(lineas);
  const horario = confirmado ? await reubicarHorario(presupuesto.evento, datos, repo) : {};

  try {
    await repo.crearEnTransaccion(async (tx) => {
      // Dentro de la transacción, como en los pagos: el acumulado con el que se decide el estado
      // tiene que ser el del momento de escribir.
      let estadoEvento: Prisma.EventoUpdateInput['estado'];
      if (confirmado) {
        const pagado = (await repo.sumarPagos(presupuesto.eventoId, tx)) ?? new Prisma.Decimal(0);
        const base = calcularBaseDeCobro({
          ...presupuesto,
          total: new Prisma.Decimal(total),
          requiereFactura: datos.requiereFactura ?? presupuesto.requiereFactura,
        });
        estadoEvento = alcanza(new Prisma.Decimal(pagado), base, PORCENTAJE_TOTAL)
          ? 'Cobrado'
          : 'Reservado';
      }

      await repo.actualizarEvento(
        presupuesto.eventoId,
        {
          fecha: new Date(datos.fecha),
          salon: datos.salonId === null ? { disconnect: true } : { connect: { id: datos.salonId } },
          cantidadPersonas: datos.cantidadPersonas,
          ...tipo,
          tipoJornada: datos.tipoJornada,
          // Sin el campo se mantiene; null la borra.
          horaInicioEstimada: datos.horaInicioEstimada,
          ...horario,
          ...(estadoEvento && { estado: estadoEvento }),
        },
        tx,
      );
      await repo.reemplazarLineas(id, lineas, tx);
      await repo.actualizarPresupuesto(
        id,
        confirmado
          ? { total: total.toFixed(2), requiereFactura: datos.requiereFactura }
          : {
              estado: 'Estimado',
              venceEn: lineas.length > 0 ? calcularVencimiento(new Date()) : null,
              total: total.toFixed(2),
              requiereFactura: datos.requiereFactura,
            },
        tx,
      );
    });
  } catch (error) {
    // RN-12: la fecha o el salón nuevos de un evento confirmado pisan a otro reservado.
    if (esViolacionDeSolapamiento(error)) {
      throw ErrorApi.conflicto('El salón ya está reservado en ese horario por otro evento');
    }
    throw error;
  }
  return obtenerConsulta(id, repo);
}

/**
 * HU-12: dar de baja una consulta la pasa a Cancelado (RN-08: solo se da de baja a mano). El
 * evento también se cancela: cada evento tiene un solo presupuesto (decisión del PO, 06/10/2026).
 */
export async function darDeBajaPresupuesto(
  id: number,
  repo: PresupuestosRepositorio = presupuestosRepositorioReal,
): Promise<ConsultaDetallada> {
  const presupuesto = await buscarOFallar(id, repo);
  exigirConsultaEnCurso(presupuesto, 'dar de baja');

  await repo.crearEnTransaccion(async (tx) => {
    await repo.actualizarPresupuesto(id, { estado: 'Cancelado' }, tx);
    await repo.actualizarEvento(presupuesto.eventoId, { estado: 'Cancelado' }, tx);
  });
  return obtenerConsulta(id, repo);
}

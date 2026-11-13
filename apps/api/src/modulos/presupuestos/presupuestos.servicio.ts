import {
  aModificacionDeUnDia,
  aplicarModalidad,
  CODIGOS_ERROR,
  DIAS_VIGENCIA_PRESUPUESTO,
  fechasDeLaFranja,
  diasDeCotizacion,
  diasDeModificacion,
  horaDelEvento,
  hoyEnZonaEventos,
  mesesHastaEvento,
  minutosDeHora,
  proyectarPrecio,
  type ConsultaDetallada,
  type CrearConsultaSocial,
  type CrearPresupuesto,
  type DiaCotizado,
  type DiaModificado,
  type EventoReutilizado,
  type FiltrosPresupuestos,
  type ModalidadServicio,
  type ModificarPresupuesto,
  type PresupuestoListado,
  type ReutilizarEvento,
  type SeguimientoConsulta,
  type TipoJornada,
} from '@confluens/shared';

import { Prisma } from '../../generated/prisma/client.js';
import { alcanza, calcularBaseDeCobro, PORCENTAJE_TOTAL } from '../../lib/base-de-cobro.js';
import { type Correo, enviarCorreo } from '../../lib/correo.js';
import { ErrorApi } from '../../lib/errores.js';
import { esDeVariosDias, exigirEventoDeUnDia } from '../../lib/evento-de-varios-dias.js';
import { esViolacionDeSolapamiento } from '../../lib/prisma-errores.js';
import { avisarConsultaRecibida } from './presupuestos.correo.js';
import * as presupuestosRepositorioReal from './presupuestos.repositorio.js';
import type { LineaNueva, PresupuestosRepositorio } from './presupuestos.repositorio.js';

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

type LineaCalculada = LineaNueva;

// Sin precio (null) la línea queda "a cotizar" (HU-11): va en 0, así no suma al total, hasta que el
// personal complete el precio. `horaEstimada` ("HH:mm") es a qué hora del evento se espera el
// servicio; la línea del salón no la lleva, por eso el default es null.
function calcularLinea(
  servicioId: number | null,
  descripcion: string,
  cantidad: number,
  precioUnitario: Prisma.Decimal | string | null,
  horaEstimada: string | null = null,
  salonId: number | null = null,
): LineaCalculada {
  const precio = new Prisma.Decimal(precioUnitario ?? 0);
  return {
    servicioId,
    salonId,
    descripcion,
    cantidad,
    modalidad: 'Normal',
    precioBase: null,
    precioUnitario: precio.toFixed(2),
    subtotal: precio.times(cantidad).toFixed(2),
    aCotizar: precioUnitario === null,
    horaEstimada,
  };
}

// RN-11: la línea de un servicio del catálogo guarda el precio base y la modalidad; el unitario es
// el base con el recargo. Sin precio base (tercerizado a cotizar) no hay recargo que aplicar.
function lineaDeServicio(
  servicio: { id: number; nombre: string },
  cantidad: number,
  precioBase: Prisma.Decimal | string | null,
  modalidad: ModalidadServicio,
  horaEstimada: string | null,
  descripcion: string = servicio.nombre,
): LineaCalculada {
  const base = precioBase === null ? null : new Prisma.Decimal(precioBase).toFixed(2);
  const unitario = base === null ? null : aplicarModalidad(base, modalidad);
  return {
    ...calcularLinea(servicio.id, descripcion, cantidad, unitario, horaEstimada),
    modalidad,
    precioBase: base,
  };
}

// RN-11: continuo o en mesa solo en los servicios que la admiten (hoy, los coffee breaks). Una
// línea que ya tenía esa modalidad la conserva aunque el servicio haya dejado de admitirla.
function exigirModalidadAdmitida(
  servicio: { nombre: string; admiteModalidad: boolean },
  modalidad: ModalidadServicio,
  modalidadAnterior?: ModalidadServicio,
) {
  if (modalidad !== 'Normal' && !servicio.admiteModalidad && modalidad !== modalidadAnterior) {
    throw ErrorApi.reglaNegocio(`"${servicio.nombre}" no admite elegir modalidad`);
  }
}

/**
 * RN-13: los precios del catálogo se proyectan a la fecha del evento con el porcentaje mensual,
 * compuesto, una vez por cada mes entre el actual y el del evento. Los tercerizados no se proyectan
 * (RN-10) y uno a cotizar sigue sin precio. La cuenta es la de @confluens/shared, la misma que
 * muestran el cotizador y el editor.
 */
interface Proyeccion {
  porcentaje: string;
  meses: number;
}

async function proyeccionHasta(
  fechaEvento: string,
  repo: PresupuestosRepositorio,
): Promise<Proyeccion> {
  return {
    porcentaje: await repo.obtenerPorcentajeMensual(),
    meses: mesesHastaEvento(hoyEnZonaEventos(), fechaEvento),
  };
}

function precioProyectado(precio: Prisma.Decimal, proyeccion: Proyeccion): string {
  return proyectarPrecio(precio.toFixed(2), proyeccion.porcentaje, proyeccion.meses);
}

function precioVigenteDeServicio(
  servicio: { precio: Prisma.Decimal | null; tercerizado: boolean },
  proyeccion: Proyeccion,
): Prisma.Decimal | string | null {
  if (servicio.precio === null || servicio.tercerizado) return servicio.precio;
  return precioProyectado(servicio.precio, proyeccion);
}

/**
 * Cada hora pedida para un servicio tiene que caer dentro del horario del evento. Solo se puede
 * controlar cuando el evento ya está agendado: mientras está EnConsulta, `inicio` y `fin` son null
 * (el cliente eligió jornada y una hora de inicio estimada, nada más) y no hay contra qué validar,
 * así que se acepta cualquier HH:mm. Un evento que cruza la medianoche se deja pasar: el rango
 * daría vuelta y no vale la pena el caso.
 */
function exigirHorasDentroDelEvento(
  lineas: LineaCalculada[],
  inicio: Date | null,
  fin: Date | null,
): void {
  if (!inicio || !fin) return;
  const desde = minutosDeHora(horaDelEvento(inicio));
  const hasta = minutosDeHora(horaDelEvento(fin));
  if (desde >= hasta) return;
  for (const linea of lineas) {
    if (!linea.horaEstimada) continue;
    const minutos = minutosDeHora(linea.horaEstimada);
    if (minutos < desde || minutos > hasta) {
      throw ErrorApi.reglaNegocio(
        `La hora de "${linea.descripcion}" (${linea.horaEstimada}) queda fuera del horario del evento, que va de ${horaDelEvento(inicio)} a ${horaDelEvento(fin)}`,
      );
    }
  }
}

function descripcionSalon(nombre: string, jornada: TipoJornada): string {
  return `Salón ${nombre} (${jornada === 'completa' ? 'jornada completa' : 'media jornada'})`;
}

// El alquiler de un salón. Cantidad 1: el precio no es por persona, es fijo para el evento entero.
function lineaDeSalon(
  salon: { id: number; nombre: string },
  jornada: TipoJornada,
  precio: Prisma.Decimal | string | null,
): LineaCalculada {
  return calcularLinea(null, descripcionSalon(salon.nombre, jornada), 1, precio, null, salon.id);
}

// Las líneas del salón son las que tienen salonId. Antes se las identificaba como "la primera sin
// servicio", que también alcanzaba a los adicionales escritos a mano y no servía para un evento
// con varios salones.
function lineaDelSalon<T extends { salonId: number | null }>(lineas: T[]): T | undefined {
  return lineas.find((linea) => linea.salonId !== null);
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

// RN-04: un servicio se puede contratar para menos personas que el total del evento, pero no para
// más. Si se cobra por persona, su cantidad ES gente del evento. La web ya lo recorta mientras se
// escribe; esto es lo que lo hace valer también para un body armado a mano. La cantidad de un
// servicio con precio fijo son unidades (3 dispensers) y no tiene este techo.
function exigirCantidadPosible(
  servicio: { nombre: string; porPersona: boolean },
  cantidad: number,
  cantidadPersonas: number,
) {
  if (servicio.porPersona && cantidad > cantidadPersonas) {
    throw ErrorApi.reglaNegocio(
      `"${servicio.nombre}" se cobra por persona: no se puede contratar para ${cantidad} ` +
        `personas si al evento asisten ${cantidadPersonas}`,
    );
  }
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
 *   vigentes al momento del pedido, proyectados a la fecha del evento (RN-13).
 * - RN-11: cada servicio lleva su modalidad; continuo o en mesa suman el recargo al precio base.
 * - Criterio 6: el Presupuesto nace en Estimado (default del schema, no se fija acá).
 * - HU-10 / RN-08: vence a los 10 días de la emisión (`venceEn`).
 * - HU-15: si `datos.solicitudId` viene, se vincula `Solicitud.eventoId` al evento recién creado
 *   (el RE "tomó" esa solicitud), para que el detalle del evento muestre los datos originales del
 *   formulario. Se valida antes de escribir nada que la solicitud exista y no esté ya tomada.
 *
 * `usuarioCliente` es el id de usuario de la sesión cuando quien cotiza es un CLIENTE (A1 de la
 * auditoría de seguridad): el cliente es el de su sesión y los datos de contacto del body se
 * ignoran. Sin eso, un cliente podía cargar eventos en la ficha de cualquier otro con solo saber
 * su correo, y crear fichas nuevas, que solo nacen por autorregistro (dominio.md). Además solo
 * puede vincular sus propias solicitudes (A2). Para el personal, sin `usuarioCliente`, se busca o
 * crea el Cliente por correo como siempre.
 */
export async function generarPresupuesto(
  datos: CrearPresupuesto,
  repo: PresupuestosRepositorio = presupuestosRepositorioReal,
  usuarioCliente?: number,
  enviar: (correo: Correo) => Promise<void> = enviarCorreo,
) {
  const clienteDeSesion =
    usuarioCliente === undefined ? null : await clienteDeLaSesion(usuarioCliente, repo);

  // HU-50: el evento tiene de 1 a 32 días y cada uno lleva sus salones, personas, jornada y
  // servicios. Un pedido de un solo día (los campos sueltos de siempre) es la franja de un día.
  const dias = diasDeCotizacion(datos);
  const ultimoDia = dias[dias.length - 1]!;

  // Validaciones de catálogo primero, sin escribir nada: si el pedido es inválido, no se crea un
  // Cliente ni un Evento huérfanos.
  // Un evento puede ocupar varios salones (ADR 0011). Se respeta el orden en que llegaron: la
  // primera línea de cada día es el primer salón elegido para ese día.
  const idsSalones = [...new Set(dias.flatMap((dia) => dia.salonIds))];
  const encontrados = new Map((await repo.buscarSalonesPorIds(idsSalones)).map((s) => [s.id, s]));
  const salonesDelDia = (dia: DiaCotizado) =>
    dia.salonIds.map((id) => {
      const salon = encontrados.get(id);
      if (!salon) throw ErrorApi.noEncontrado(`No existe el salón ${id}`);
      return salon;
    });
  // Se resuelven todos acá para que un salón inexistente falle antes de escribir nada.
  const salonesPorDia = dias.map(salonesDelDia);

  if (datos.solicitudId !== undefined) {
    await exigirSolicitudDisponible(datos.solicitudId, clienteDeSesion?.id ?? null, repo);
  }

  const idsServicios = [...new Set(dias.flatMap((dia) => dia.servicios.map((s) => s.servicioId)))];
  const servicios = idsServicios.length > 0 ? await repo.buscarServiciosPorIds(idsServicios) : [];
  const serviciosPorId = new Map(servicios.map((s) => [s.id, s]));

  for (const dia of dias) {
    for (const seleccionado of dia.servicios) {
      const servicio = serviciosPorId.get(seleccionado.servicioId);
      if (!servicio) {
        throw ErrorApi.noEncontrado(`No existe el servicio ${seleccionado.servicioId}`);
      }
      if (!servicio.activo) {
        throw ErrorApi.reglaNegocio(`El servicio "${servicio.nombre}" no está activo`);
      }
      // RN-04: contra las personas de ESE día, no las de otro.
      exigirCantidadPosible(servicio, seleccionado.cantidad, dia.cantidadPersonas);
      exigirModalidadAdmitida(servicio, seleccionado.modalidad ?? 'Normal');
    }
  }

  // RN-13 con varios días: los precios se proyectan a la fecha del ÚLTIMO día, la referencia de
  // todo el presupuesto (decisión del PO, 12/11/2026).
  const proyeccion = await proyeccionHasta(ultimoDia.fecha, repo);
  const lineasPorDia = dias.map((dia, i) => {
    const lineasSalones = salonesPorDia[i]!.map((salon) =>
      lineaDeSalon(
        salon,
        dia.tipoJornada,
        precioProyectado(precioDeSalon(salon, dia.tipoJornada), proyeccion),
      ),
    );
    const lineasServicios = dia.servicios.map((seleccionado) => {
      // El bucle de validación de arriba ya garantizó que existe.
      const servicio = serviciosPorId.get(seleccionado.servicioId)!;
      return lineaDeServicio(
        servicio,
        seleccionado.cantidad,
        precioVigenteDeServicio(servicio, proyeccion),
        seleccionado.modalidad ?? 'Normal',
        seleccionado.horaEstimada ?? null,
      );
    });
    return [...lineasSalones, ...lineasServicios];
  });

  // Un solo total para todo el evento: la suma de todos los días.
  const total = sumarLineas(lineasPorDia.flat());

  const fechaEmision = new Date();

  const presupuesto = await repo.crearEnTransaccion(async (tx) => {
    let cliente = clienteDeSesion ?? (await repo.buscarClientePorCorreo(datos.correo, tx));
    if (!cliente) {
      cliente = await repo.crearCliente(
        { nombre: datos.nombre, telefono: datos.telefono, correo: datos.correo },
        tx,
      );
    }

    const [primerDia] = dias;
    const evento = await repo.crearEvento(
      {
        clienteId: cliente.id,
        fecha: new Date(primerDia!.fecha),
        cantidadPersonas: primerDia!.cantidadPersonas,
        tipo: 'Corporativo',
        tipoJornada: primerDia!.tipoJornada,
        horaInicioEstimada: datos.horaInicioEstimada ?? null,
      },
      tx,
    );

    let lineas: LineaNueva[];
    if (dias.length === 1) {
      await repo.reemplazarSalonesDelEvento(evento.id, primerDia!.salonIds, tx);
      lineas = lineasPorDia[0]!;
    } else {
      // Los días que siguen al primero se crean con el evento, y cada uno recibe sus salones y sus
      // líneas. El total y la seña son del evento, no de cada día.
      const creados = await repo.crearDiasDelEvento(
        evento.id,
        dias.slice(1).map((dia) => ({
          fecha: new Date(dia.fecha),
          cantidadPersonas: dia.cantidadPersonas,
          tipoJornada: dia.tipoJornada,
        })),
        tx,
      );
      const diaIdPorFecha = new Map(
        creados.map((dia) => [dia.fecha.toISOString().slice(0, 10), dia.id]),
      );
      lineas = [];
      for (const [i, dia] of dias.entries()) {
        const diaId = diaIdPorFecha.get(dia.fecha)!;
        await repo.reemplazarSalonesDelEvento(evento.id, dia.salonIds, tx, new Map(), diaId);
        lineas.push(...lineasPorDia[i]!.map((linea) => ({ ...linea, diaId })));
      }
    }

    if (datos.solicitudId !== undefined) {
      await vincularSolicitud(datos.solicitudId, evento.id, repo, tx);
    }

    return repo.crearPresupuestoConLineas(
      {
        eventoId: evento.id,
        fechaEmision,
        venceEn: calcularVencimiento(fechaEmision),
        total: total.toFixed(2),
        lineas,
      },
      tx,
    );
  });

  // Solo cuando el cliente confirma en el cotizador: si cotiza el personal, no sale correo. Sin
  // await: no frena la respuesta, y un fallo del envío no deshace la consulta ya guardada.
  if (clienteDeSesion) {
    void avisarConsultaRecibida(
      {
        nombre: clienteDeSesion.nombre,
        correo: clienteDeSesion.correo,
        telefono: clienteDeSesion.telefono,
        consultaId: presupuesto.id,
        tipo: 'Corporativo',
      },
      enviar,
    );
  }
  return presupuesto;
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
  enviar: (correo: Correo) => Promise<void> = enviarCorreo,
) {
  const cliente = await clienteDeLaSesion(usuarioId, repo);

  if (datos.solicitudId !== undefined) {
    await exigirSolicitudDisponible(datos.solicitudId, cliente.id, repo);
  }

  const presupuesto = await repo.crearEnTransaccion(async (tx) => {
    const evento = await repo.crearEvento(
      {
        clienteId: cliente.id,
        fecha: new Date(datos.fecha),
        cantidadPersonas: datos.cantidadPersonas,
        tipo: 'Social',
        tipoSocial: datos.tipoSocial,
        tipoSocialDetalle: datos.tipoSocial === 'Otro' ? datos.tipoSocialDetalle : null,
        tipoJornada: datos.tipoJornada,
        horaInicioEstimada: datos.horaInicioEstimada ?? null,
        horaFinEstimada: datos.horaFinEstimada ?? null,
      },
      tx,
    );
    // HU-50: con `fechaFin` el evento dura varios días. Cada día que sigue al primero entra vacío,
    // con las mismas personas y jornada que pidió el cliente; las horas estimadas valen para todos
    // y el Responsable de Eventos arma el detalle de cada día al armar el presupuesto.
    if (datos.fechaFin && datos.fechaFin !== datos.fecha) {
      await repo.crearDiasDelEvento(
        evento.id,
        fechasDeLaFranja(datos.fecha, datos.fechaFin)
          .slice(1)
          .map((fecha) => ({
            fecha: new Date(fecha),
            cantidadPersonas: datos.cantidadPersonas,
            tipoJornada: datos.tipoJornada,
          })),
        tx,
      );
    }

    if (datos.solicitudId !== undefined) {
      await vincularSolicitud(datos.solicitudId, evento.id, repo, tx);
    }

    return repo.crearPresupuestoConLineas(
      { eventoId: evento.id, fechaEmision: new Date(), venceEn: null, total: '0.00', lineas: [] },
      tx,
    );
  });

  // Igual que en el cotizador: sin await y sin que un fallo del envío deshaga la consulta.
  void avisarConsultaRecibida(
    {
      nombre: cliente.nombre,
      correo: cliente.correo,
      telefono: cliente.telefono,
      consultaId: presupuesto.id,
      tipo: 'Social',
    },
    enviar,
  );
  return presupuesto;
}

async function clienteDeLaSesion(usuarioId: number, repo: PresupuestosRepositorio) {
  const cliente = await repo.buscarClientePorUsuarioId(usuarioId);
  if (!cliente) throw ErrorApi.noEncontrado('La sesión no corresponde a un cliente');
  return cliente;
}

/**
 * La solicitud tiene que existir y no estar tomada. Si quien la vincula es un cliente
 * (`clienteId`), además tiene que ser suya (A2 de la auditoría de seguridad): si no, un cliente
 * podía recorrer ids y quedarse con solicitudes ajenas. Una ajena responde lo mismo que una
 * inexistente, para no confirmar que el id existe.
 */
async function exigirSolicitudDisponible(
  solicitudId: number,
  clienteId: number | null,
  repo: PresupuestosRepositorio,
) {
  const solicitud = await repo.buscarSolicitud(solicitudId);
  if (!solicitud || (clienteId !== null && solicitud.clienteId !== clienteId)) {
    throw ErrorApi.noEncontrado(`No existe la solicitud ${solicitudId}`);
  }
  if (solicitud.eventoId !== null) {
    throw ErrorApi.conflicto(`La solicitud ${solicitudId} ya fue tomada`);
  }
}

// La vinculación solo toca solicitudes todavía libres: si otra transacción la tomó entre la
// validación de arriba y este punto, no se pisa su evento y se responde el mismo 409.
async function vincularSolicitud(
  solicitudId: number,
  eventoId: number,
  repo: PresupuestosRepositorio,
  tx: Prisma.TransactionClient,
) {
  const vinculadas = await repo.vincularSolicitudAEvento(solicitudId, eventoId, tx);
  if (vinculadas === 0) {
    throw ErrorApi.conflicto(`La solicitud ${solicitudId} ya fue tomada`);
  }
}

/**
 * El presupuesto vacío de un evento que no tiene ninguno. Es lo mismo que la consulta social crea
 * junto con el evento (ADR 0008), pero para un evento que ya existe: sin él no hay nada que abrir
 * en el detalle de la consulta ni base de cobro contra la que registrar pagos.
 *
 * Nace sin líneas, con total 0 y `venceEn` en null —«sin armar»—: los 10 días de RN-08 empiezan a
 * contar recién cuando el personal lo guarda con algo adentro.
 */
export async function crearPresupuestoDeEvento(
  eventoId: number,
  repo: PresupuestosRepositorio = presupuestosRepositorioReal,
) {
  const evento = await repo.buscarEventoConPresupuestos(eventoId);
  if (!evento) throw ErrorApi.noEncontrado(`No existe el evento ${eventoId}`);

  // Solo un evento EnConsulta: el presupuesto nace Estimado, y un Estimado sobre un evento ya
  // reservado o cobrado es un estado que la máquina de dominio.md no contempla (y que la consulta
  // ni siquiera dejaría editar). Un Cancelado tampoco: liberó el salón y no vuelve atrás.
  if (evento.estado !== 'EnConsulta') {
    throw ErrorApi.conflicto(
      `El evento ${eventoId} no está en consulta: no se le puede armar un presupuesto`,
    );
  }
  // Los Cancelado no cuentan: un presupuesto dado de baja no es el presupuesto del evento.
  if (evento.presupuestos.some((presupuesto) => presupuesto.estado !== 'Cancelado')) {
    throw ErrorApi.conflicto(`El evento ${eventoId} ya tiene un presupuesto`);
  }

  return repo.crearPresupuestoConLineas({
    eventoId,
    fechaEmision: new Date(),
    venceEn: null,
    total: '0.00',
    lineas: [],
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
    // Sin fecha de fin (un evento armado a mano en un test), dura un solo día.
    fechaFinEvento: (evento.fechaFin ?? evento.fecha).toISOString().slice(0, 10),
    tipo: evento.tipo,
    tipoSocial: evento.tipoSocial,
    tipoSocialDetalle: evento.tipoSocialDetalle,
    cliente: evento.cliente,
    salones: evento.salones.map(({ salon }) => salon),
    avisoRecepcionEn: presupuesto.avisoRecepcionEn?.toISOString() ?? null,
    envioFormalEn: presupuesto.envioFormalEn?.toISOString() ?? null,
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
    avisoRecepcionEn: presupuesto.avisoRecepcionEn?.toISOString() ?? null,
    envioFormalEn: presupuesto.envioFormalEn?.toISOString() ?? null,
    evento: {
      id: evento.id,
      estado: evento.estado,
      fecha: evento.fecha.toISOString().slice(0, 10),
      fechaFin: evento.fechaFin.toISOString().slice(0, 10),
      cantidadPersonas: evento.cantidadPersonas,
      tipo: evento.tipo,
      tipoSocial: evento.tipoSocial,
      tipoSocialDetalle: evento.tipoSocialDetalle,
      horaInicioEstimada: evento.horaInicioEstimada,
      horaFinEstimada: evento.horaFinEstimada,
      observacionesComanda: evento.observacionesComanda,
      inicio: evento.inicio?.toISOString() ?? null,
      fin: evento.fin?.toISOString() ?? null,
    },
    cliente: {
      id: evento.cliente.id,
      nombre: evento.cliente.nombre,
      apellido: evento.cliente.apellido,
      correo: evento.cliente.correo,
      telefono: evento.cliente.telefono,
      etiqueta: evento.cliente.etiqueta,
    },
    // HU-50: los días del evento, cada uno con sus salones. Los de un evento de un solo día son los
    // de siempre, dentro de su único día.
    dias: evento.dias.map((dia) => ({
      id: dia.id,
      fecha: dia.fecha.toISOString().slice(0, 10),
      cantidadPersonas: dia.cantidadPersonas,
      tipoJornada: dia.tipoJornada,
      inicio: dia.inicio?.toISOString() ?? null,
      fin: dia.fin?.toISOString() ?? null,
      salones: dia.salones.map(({ salon, distribucion }) => ({
        id: salon.id,
        nombre: salon.nombre,
        capacidadMaxima: salon.capacidadMaxima,
        distribucion: distribucion ? { id: distribucion.id, nombre: distribucion.nombre } : null,
      })),
    })),
    // Los de todo el evento, con la distribución que tiene armada cada uno (ADR 0011).
    salones: evento.salones.map(({ salon, distribucion }) => ({
      id: salon.id,
      nombre: salon.nombre,
      capacidadMaxima: salon.capacidadMaxima,
      distribucion: distribucion ? { id: distribucion.id, nombre: distribucion.nombre } : null,
    })),
    lineas: presupuesto.lineas.map(({ servicio, ...linea }) => ({
      id: linea.id,
      presupuestoId: linea.presupuestoId,
      diaId: linea.diaId,
      servicioId: linea.servicioId,
      descripcion: linea.descripcion,
      cantidad: linea.cantidad,
      precioUnitario: linea.precioUnitario.toFixed(2),
      subtotal: linea.subtotal.toFixed(2),
      modalidad: linea.modalidad,
      precioBase: linea.precioBase?.toFixed(2) ?? null,
      aCotizar: linea.aCotizar,
      horaEstimada: linea.horaEstimada,
      salonId: linea.salonId,
      tipo: linea.salonId !== null ? 'salon' : linea.servicioId === null ? 'adicional' : 'servicio',
      tercerizado: servicio?.tercerizado ?? false,
      admiteModalidad: servicio?.admiteModalidad ?? false,
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
 * Un evento confirmado ya tiene horario (inicio y fin). Si cambia la fecha, el horario se corre
 * los mismos días y conserva las horas. Que la franja nueva esté libre lo controla la restricción
 * EXCLUDE al guardar (RN-12). La distribución de cada salón no se toca acá: ver
 * \`armadosHeredados\`.
 */
function reubicarHorario(
  evento: PresupuestoDetalladoRepo['evento'],
  datos: { fecha: string },
): { inicio?: Date; fin?: Date } {
  const corrimiento = new Date(datos.fecha).getTime() - evento.fecha.getTime();
  return corrimiento !== 0 && evento.inicio && evento.fin
    ? {
        inicio: new Date(evento.inicio.getTime() + corrimiento),
        fin: new Date(evento.fin.getTime() + corrimiento),
      }
    : {};
}

/**
 * Un salón que entra a un evento ya armado hereda el armado del mismo nombre, si lo tiene:
 * cambiar Paraná por Pucará en un evento con Banquete deja a Pucará también en Banquete. Sin esto
 * un evento confirmado quedaría con un salón sin distribución. Se toma el armado del primer salón
 * que tenga uno. Los salones que ya estaban conservan el suyo (los mantiene el repositorio).
 */
async function armadosHeredados(
  evento: PresupuestoDetalladoRepo['evento'],
  salonIds: number[],
  repo: PresupuestosRepositorio,
): Promise<Map<number, number>> {
  const heredados = new Map<number, number>();
  const nombreDelArmado = evento.salones.find((s) => s.distribucion)?.distribucion?.nombre;
  if (!nombreDelArmado) return heredados;

  const yaEstaban = new Set(evento.salones.map((s) => s.salonId));
  for (const salonId of salonIds.filter((id) => !yaEstaban.has(id))) {
    const distribucion = await repo.buscarDistribucionPorNombre(salonId, nombreDelArmado);
    if (distribucion) heredados.set(salonId, distribucion.id);
  }
  return heredados;
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
function resolverTipo(
  datos: Pick<ModificarPresupuesto, 'tipo' | 'tipoSocial' | 'tipoSocialDetalle'>,
  evento: PresupuestoDetalladoRepo['evento'],
  // Hay salón en la consulta (con varios días, en cada uno): un corporativo lo necesita.
  haySalones: boolean,
) {
  const tipo = datos.tipo ?? evento.tipo;
  if (tipo === 'Corporativo') {
    if (!haySalones) {
      throw ErrorApi.reglaNegocio('Un evento corporativo necesita al menos un salón');
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

// HU-50: el contexto con el que se calculan las líneas de un día al modificar una consulta: lo que
// se leyó del catálogo y la proyección de precios (RN-13) a la fecha de referencia del evento.
interface ContextoDeLineas {
  catalogo: Map<number, ServicioDelCatalogo>;
  salones: Map<number, SalonDelCatalogo>;
  proyeccion: Proyeccion;
  // La fecha de referencia cambió: lo que no trae precio explícito toma el de la fecha nueva en vez
  // del congelado (HU-54).
  cambioFecha: boolean;
}
type ServicioDelCatalogo = Awaited<
  ReturnType<PresupuestosRepositorio['buscarServiciosPorIds']>
>[number];
type SalonDelCatalogo = Awaited<ReturnType<PresupuestosRepositorio['buscarSalonesPorIds']>>[number];
type LineaGuardada = PresupuestoDetalladoRepo['lineas'][number];

/**
 * Las líneas de UN día de una consulta que se modifica: sus salones, sus servicios y sus adicionales,
 * con el precio congelado de lo que ya tenía (`lineasPrevias`, las de ese mismo día) y el vigente de
 * lo nuevo. Un evento de un solo día la usa con todas las líneas del presupuesto.
 */
function lineasDeModificacion(
  dia: Pick<
    DiaModificado,
    'cantidadPersonas' | 'tipoJornada' | 'salones' | 'servicios' | 'adicionales'
  >,
  lineasPrevias: LineaGuardada[],
  { catalogo, salones, proyeccion, cambioFecha }: ContextoDeLineas,
): LineaCalculada[] {
  // Un servicio puede estar más de una vez, una por modalidad (RN-11). La línea anterior de un
  // servicio elegido es la de su misma modalidad; si no la hay pero el servicio tenía una sola
  // línea, es esa con la modalidad cambiada, y conserva su precio base.
  const lineasDeServicio = lineasPrevias.filter((linea) => linea.servicioId !== null);
  const lineaAnterior = (servicioId: number, modalidad: ModalidadServicio) => {
    const delServicio = lineasDeServicio.filter((linea) => linea.servicioId === servicioId);
    return (
      delServicio.find((linea) => linea.modalidad === modalidad) ??
      (delServicio.length === 1 ? delServicio[0] : undefined)
    );
  };

  const lineasServicios = dia.servicios.map((elegido) => {
    const servicio = catalogo.get(elegido.servicioId);
    if (!servicio) throw ErrorApi.noEncontrado(`No existe el servicio ${elegido.servicioId}`);
    const modalidad = elegido.modalidad ?? 'Normal';
    const anterior = lineaAnterior(elegido.servicioId, modalidad);
    if (!anterior && !servicio.activo) {
      throw ErrorApi.reglaNegocio(`El servicio "${servicio.nombre}" no está activo`);
    }
    exigirCantidadPosible(servicio, elegido.cantidad, dia.cantidadPersonas);
    exigirModalidadAdmitida(servicio, modalidad, anterior?.modalidad);
    // Lo que ya tenía precio conserva su precio base; lo nuevo, y lo que seguía a cotizar, toma el
    // del catálogo proyectado a la fecha (RN-13), que también puede ser null (sigue a cotizar).
    // Cambiar la modalidad no cambia el base: el recargo se vuelve a calcular sobre él (RN-11).
    const congelado =
      anterior && !anterior.aCotizar && !cambioFecha
        ? (anterior.precioBase ?? anterior.precioUnitario)
        : undefined;
    const precioBase =
      elegido.precioUnitario ?? congelado ?? precioVigenteDeServicio(servicio, proyeccion);
    return lineaDeServicio(
      servicio,
      elegido.cantidad,
      precioBase,
      modalidad,
      elegido.horaEstimada ?? null,
      anterior?.descripcion ?? servicio.nombre,
    );
  });

  // Cada salón conserva su precio congelado si ya estaba y no cambió la jornada; si es nuevo, o si
  // la jornada cambió, toma el vigente. Un precioUnitario explícito es un ajuste comercial (RN-03).
  const salonesAnteriores = new Map(
    lineasPrevias.filter((linea) => linea.salonId !== null).map((linea) => [linea.salonId!, linea]),
  );
  const lineasSalones = dia.salones.map((elegido) => {
    const salon = salones.get(elegido.salonId)!;
    const anterior = salonesAnteriores.get(elegido.salonId);
    const mismaJornada =
      !!anterior && jornadaDeLineaSalon(anterior.descripcion) === dia.tipoJornada;
    const congelado = mismaJornada && !cambioFecha ? anterior.precioUnitario : undefined;
    return lineaDeSalon(
      salon,
      dia.tipoJornada,
      elegido.precioUnitario ??
        congelado ??
        precioProyectado(precioDeSalon(salon, dia.tipoJornada), proyeccion),
    );
  });

  const adicionales = dia.adicionales.map((adicional) =>
    calcularLinea(
      null,
      adicional.descripcion,
      adicional.cantidad,
      adicional.precioUnitario,
      adicional.horaEstimada ?? null,
    ),
  );

  return [...lineasSalones, ...lineasServicios, ...adicionales];
}

/**
 * Modifica una consulta después de hablar con el cliente (HU-12). Recibe el estado completo:
 * fecha, salón, personas, jornada y servicios, y también el tipo de evento y la hora estimada
 * (ADR 0008).
 *
 * - Estimado o Expirado con el evento EnConsulta, o Confirmado con el evento Reservado o Cobrado
 *   (RN-09). Cualquier otro caso, 409.
 * - Un servicio que ya estaba conserva su precio congelado; uno nuevo toma el vigente, proyectado a
 *   la fecha del evento (RN-13), y tiene que estar activo. Un `precioUnitario` explícito es un
 *   ajuste comercial (RN-03) y manda. Los precios son el base: la modalidad suma su recargo (RN-11).
 * - La línea del salón conserva su precio si no cambian el salón ni la jornada; si cambian, toma
 *   el vigente. `precioSalon` la ajusta a mano.
 * - Los adicionales escritos a mano entran con la descripción y el precio que se cargaron.
 * - Un tercerizado a cotizar sigue así hasta que llega su precio (HU-11).
 * - La marca de factura (RN-01) no cambia: desde HU-53 todo presupuesto nuevo nace con factura y
 *   uno anterior conserva la suya.
 * - HU-54: si cambia la fecha del evento, en cualquier estado (también Confirmado), lo que no trae
 *   `precioUnitario` toma el precio de la fecha nueva (RN-13) en vez del congelado. La pantalla ya
 *   manda los precios recalculados; esto lo sostiene para cualquier pedido. Sin cambio de fecha no
 *   hay recálculo: no hay botón «Recalcular» (reunión 05/11/2026).
 * - El total suma todas las líneas, tercerizados incluidos.
 * - Queda Estimado y la vigencia vuelve a contar 10 días desde ahora (decisión del PO,
 *   05/10/2026), también si estaba Expirado. La fecha de emisión pasa a ser la del recálculo
 *   (Franco, 03/11/2026, HU-27): es el presupuesto que se le vuelve a mandar al cliente.
 * - Una consulta social puede seguir sin salón (no hay línea del salón). Si no queda ninguna línea,
 *   el presupuesto sigue sin armar y sin vencimiento: los 10 días arrancan cuando el personal carga
 *   la primera (decisión del PO, 07/10/2026).
 * - Un Confirmado sigue Confirmado, pero la vigencia también vuelve a contar 10 días: cada
 *   modificación la reinicia (RN-08; Franco, 03/11/2026, HU-27). No lo puede vencer: el control
 *   de vigencia solo pasa a Expirado los Estimado. Necesita salón, se le corre el horario si cambia la fecha (ver `reubicarHorario`) y su evento queda
 *   Cobrado si lo pagado cubre el total nuevo, o Reservado si no. Si el total queda por debajo de
 *   lo pagado, se guarda igual y el saldo queda negativo (decisión de Franco, 08/10/2026).
 */
export async function modificarPresupuesto(
  id: number,
  pedido: ModificarPresupuesto,
  repo: PresupuestosRepositorio = presupuestosRepositorioReal,
): Promise<ConsultaDetallada> {
  const presupuesto = await buscarOFallar(id, repo);
  // HU-50: un evento de varios días (o que va a pasar a serlo) se modifica día por día, por otro
  // camino. El de un solo día sigue exactamente como antes.
  const dias = diasDeModificacion(pedido);
  // Un pedido con los campos sueltos de un solo día no puede tocar un evento de varios días: se
  // leería como achicarlo a un día y borraría el resto. Para eso está `dias`.
  if (!pedido.dias && esDeVariosDias(presupuesto.evento)) {
    throw ErrorApi.reglaNegocio(
      'Este evento dura varios días: para modificarlo mandá el detalle de cada día (dias)',
    );
  }
  if (dias.length > 1 || esDeVariosDias(presupuesto.evento)) {
    return modificarPorDias(id, presupuesto, pedido, dias, repo);
  }
  const datos = aModificacionDeUnDia(pedido);
  const confirmado = esConfirmadoVigente(presupuesto);
  if (!confirmado) exigirConsultaEnCurso(presupuesto, 'modificar');
  if (confirmado && datos.salones.length === 0) {
    throw ErrorApi.reglaNegocio('Un evento confirmado necesita salón');
  }
  const tipo = resolverTipo(datos, presupuesto.evento, datos.salones.length > 0);
  // HU-54: con otra fecha, los precios congelados dejan de valer (dominio.md, «Recálculo
  // automático»). `fecha` viaja como YYYY-MM-DD y el evento la guarda a medianoche UTC.
  const cambioFecha = datos.fecha !== presupuesto.evento.fecha.toISOString().slice(0, 10);

  const salonIds = datos.salones.map((s) => s.salonId);
  const encontrados = new Map(
    (salonIds.length > 0 ? await repo.buscarSalonesPorIds(salonIds) : []).map((s) => [s.id, s]),
  );
  for (const id of salonIds) {
    if (!encontrados.has(id)) throw ErrorApi.noEncontrado(`No existe el salón ${id}`);
  }

  const ids = datos.servicios.map((s) => s.servicioId);
  const catalogo = new Map(
    (ids.length > 0 ? await repo.buscarServiciosPorIds(ids) : []).map((s) => [s.id, s]),
  );

  const proyeccion = await proyeccionHasta(datos.fecha, repo);
  const lineas = lineasDeModificacion(datos, presupuesto.lineas, {
    catalogo,
    salones: encontrados,
    proyeccion,
    cambioFecha,
  });
  const total = sumarLineas(lineas);
  const horario = confirmado ? reubicarHorario(presupuesto.evento, datos) : {};
  const heredados = await armadosHeredados(presupuesto.evento, salonIds, repo);
  const fechaEmision = new Date();
  // Contra el horario que va a quedar: si cambió la fecha de un evento confirmado, reubicarHorario
  // ya corrió inicio y fin los mismos días.
  exigirHorasDentroDelEvento(
    lineas,
    horario.inicio instanceof Date ? horario.inicio : presupuesto.evento.inicio,
    horario.fin instanceof Date ? horario.fin : presupuesto.evento.fin,
  );

  try {
    await repo.crearEnTransaccion(async (tx) => {
      // Dentro de la transacción, como en los pagos: el acumulado con el que se decide el estado
      // tiene que ser el del momento de escribir.
      let estadoEvento: Prisma.EventoUpdateInput['estado'];
      if (confirmado) {
        const pagado = (await repo.sumarPagos(presupuesto.eventoId, tx)) ?? new Prisma.Decimal(0);
        const base = calcularBaseDeCobro({ ...presupuesto, total: new Prisma.Decimal(total) });
        estadoEvento = alcanza(new Prisma.Decimal(pagado), base, PORCENTAJE_TOTAL)
          ? 'Cobrado'
          : 'Reservado';
      }

      // Los salones que se dejan salen antes de mover el evento: si no, el trigger los lleva a la
      // fecha nueva y chocan con quien los tenga reservados ahí, aunque ya no se usen (RN-12).
      await repo.quitarSalonesDelEvento(presupuesto.eventoId, salonIds, tx);
      await repo.actualizarEvento(
        presupuesto.eventoId,
        {
          fecha: new Date(datos.fecha),
          cantidadPersonas: datos.cantidadPersonas,
          ...tipo,
          tipoJornada: datos.tipoJornada,
          // Sin el campo se mantiene; null la borra.
          horaInicioEstimada: datos.horaInicioEstimada,
          horaFinEstimada: datos.horaFinEstimada,
          ...horario,
          ...(estadoEvento && { estado: estadoEvento }),
        },
        tx,
      );
      await repo.reemplazarSalonesDelEvento(presupuesto.eventoId, salonIds, tx, heredados);
      await repo.reemplazarLineas(id, lineas, tx);
      await repo.actualizarPresupuesto(
        id,
        confirmado
          ? {
              fechaEmision,
              venceEn: calcularVencimiento(fechaEmision),
              total: total.toFixed(2),
            }
          : {
              estado: 'Estimado',
              fechaEmision,
              venceEn: lineas.length > 0 ? calcularVencimiento(fechaEmision) : null,
              total: total.toFixed(2),
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
 * HU-50: modifica una consulta de varios días, o una de un día que pasa a durar varios. El pedido
 * trae el estado completo de cada día (su fecha, personas, jornada, salones, servicios y
 * adicionales), y cada día se identifica por su fecha: mandar una fecha de más o de menos en un
 * extremo extiende o achica la franja, y un día nuevo entra con lo que trae.
 *
 * - Solo una consulta en curso (Estimado o Expirado) de un evento EnConsulta. Reservar, mover el
 *   horario o cobrar un evento de varios días todavía no se puede (`exigirEventoDeUnDia`), así que un
 *   evento confirmado no puede pasar a durar varios días.
 * - Un solo presupuesto y un solo total: la suma de todos los días.
 * - RN-13: el último día de la franja es la referencia. Si cambia (la franja se extiende o se
 *   corre), lo que no trae precio explícito toma el precio de esa fecha, también en los días que ya
 *   estaban; si solo cambia el primer día, los precios congelados se conservan (HU-54).
 * - Cada servicio se controla contra las personas de SU día (RN-04).
 */
async function modificarPorDias(
  id: number,
  presupuesto: PresupuestoDetalladoRepo,
  pedido: ModificarPresupuesto,
  dias: DiaModificado[],
  repo: PresupuestosRepositorio,
): Promise<ConsultaDetallada> {
  if (esConfirmadoVigente(presupuesto)) {
    throw ErrorApi.reglaNegocio(
      'Todavía no se puede pasar a varios días un evento ya reservado: la reserva por día llega en la próxima etapa',
    );
  }
  exigirConsultaEnCurso(presupuesto, 'modificar');
  const haySalonCadaDia = dias.every((dia) => dia.salones.length > 0);
  const tipo = resolverTipo(pedido, presupuesto.evento, haySalonCadaDia);

  const ultimoDia = dias[dias.length - 1]!;
  const cambioFecha = ultimoDia.fecha !== presupuesto.evento.fechaFin.toISOString().slice(0, 10);

  const salonIds = [...new Set(dias.flatMap((dia) => dia.salones.map((s) => s.salonId)))];
  const salones = new Map(
    (salonIds.length > 0 ? await repo.buscarSalonesPorIds(salonIds) : []).map((s) => [s.id, s]),
  );
  for (const salonId of salonIds) {
    if (!salones.has(salonId)) throw ErrorApi.noEncontrado(`No existe el salón ${salonId}`);
  }
  const idsServicios = [...new Set(dias.flatMap((dia) => dia.servicios.map((s) => s.servicioId)))];
  const catalogo = new Map(
    (idsServicios.length > 0 ? await repo.buscarServiciosPorIds(idsServicios) : []).map((s) => [
      s.id,
      s,
    ]),
  );

  const proyeccion = await proyeccionHasta(ultimoDia.fecha, repo);
  const diaPrevioPorFecha = new Map(
    presupuesto.evento.dias.map((dia) => [dia.fecha.toISOString().slice(0, 10), dia]),
  );
  const lineas = dias.flatMap((dia) => {
    const previo = diaPrevioPorFecha.get(dia.fecha);
    const previas = previo ? presupuesto.lineas.filter((linea) => linea.diaId === previo.id) : [];
    return lineasDeModificacion(dia, previas, { catalogo, salones, proyeccion, cambioFecha }).map(
      (linea) => ({ ...linea, fechaDia: dia.fecha }),
    );
  });
  const total = sumarLineas(lineas);
  const fechaEmision = new Date();

  await repo.crearEnTransaccion(async (tx) => {
    // Primero los días y las líneas (las líneas de un día que se saca tienen que irse antes que él),
    // después los salones de cada día y por último los datos del evento y del presupuesto.
    const diaIds = await repo.reemplazarDiasYLineas(
      id,
      dias.map((dia) => ({
        fecha: new Date(dia.fecha),
        cantidadPersonas: dia.cantidadPersonas,
        tipoJornada: dia.tipoJornada,
      })),
      lineas,
      tx,
    );
    for (const dia of dias) {
      await repo.reemplazarSalonesDelEvento(
        presupuesto.eventoId,
        dia.salones.map((s) => s.salonId),
        tx,
        new Map(),
        diaIds.get(dia.fecha),
      );
    }
    await repo.actualizarEvento(
      presupuesto.eventoId,
      {
        ...tipo,
        // Sin el campo se mantiene; null la borra.
        horaInicioEstimada: pedido.horaInicioEstimada,
        horaFinEstimada: pedido.horaFinEstimada,
      },
      tx,
    );
    await repo.actualizarPresupuesto(
      id,
      {
        estado: 'Estimado',
        fechaEmision,
        venceEn: lineas.length > 0 ? calcularVencimiento(fechaEmision) : null,
        total: total.toFixed(2),
      },
      tx,
    );
  });
  return obtenerConsulta(id, repo);
}

/**
 * Saca del listado de consultas un presupuesto Cancelado (el tacho del listado, decisión de Franco,
 * 16/10/2026). No borra nada: HU-22 pide que el cancelado se conserve, así que sigue en su detalle,
 * en el evento, en el historial del cliente y en la cuenta de pagos. Solo se ocultan los Cancelados:
 * los que siguen en gestión tienen que verse. Ocultar uno ya oculto no cambia nada.
 */
export async function ocultarPresupuesto(
  id: number,
  repo: PresupuestosRepositorio = presupuestosRepositorioReal,
): Promise<void> {
  const presupuesto = await buscarOFallar(id, repo);
  if (presupuesto.estado !== 'Cancelado') {
    throw ErrorApi.conflicto(
      `Solo se puede sacar del listado un presupuesto Cancelado (este está ${presupuesto.estado})`,
    );
  }
  if (presupuesto.ocultoEn) return;
  await repo.actualizarPresupuesto(id, { ocultoEn: new Date() });
}

// Tildar conserva la fecha si ya estaba marcado: es el registro de cuándo se hizo por primera vez.
function fechaDeSeguimiento(marcar: boolean | undefined, actual: Date | null) {
  if (marcar === undefined) return undefined;
  return marcar ? (actual ?? new Date()) : null;
}

/**
 * Seguimiento de la consulta con el cliente: el aviso de recepción por WhatsApp (se tilda solo al
 * tocar el botón o a mano) y el envío formal del presupuesto en PDF (al descargarlo o a mano). Es
 * un registro del Responsable de Eventos: se puede tildar y destildar en cualquier estado. Sin
 * aviso, la consulta se lista como «Nuevo».
 */
export async function registrarSeguimiento(
  id: number,
  cambios: SeguimientoConsulta,
  repo: PresupuestosRepositorio = presupuestosRepositorioReal,
): Promise<ConsultaDetallada> {
  const presupuesto = await buscarOFallar(id, repo);
  await repo.actualizarPresupuesto(id, {
    avisoRecepcionEn: fechaDeSeguimiento(cambios.avisoRecepcion, presupuesto.avisoRecepcionEn),
    envioFormalEn: fechaDeSeguimiento(cambios.envioFormal, presupuesto.envioFormalEn),
  });
  return obtenerConsulta(id, repo);
}

// Un Estimado o Expirado cuyo evento ya está Reservado o Cobrado: quedó de cuando un evento podía
// tener más de un presupuesto, y el evento ya tiene el suyo Confirmado. No se recalcula, solo se
// da de baja.
export function esPresupuestoSobrante(presupuesto: {
  estado: string;
  evento: { estado: string };
}): boolean {
  return (
    (presupuesto.estado === 'Estimado' || presupuesto.estado === 'Expirado') &&
    (presupuesto.evento.estado === 'Reservado' || presupuesto.evento.estado === 'Cobrado')
  );
}

/**
 * HU-12: dar de baja una consulta la pasa a Cancelado (RN-08: solo se da de baja a mano). El
 * evento también se cancela: cada evento tiene un solo presupuesto (decisión del PO, 06/10/2026).
 * Un presupuesto sobrante (ver `esPresupuestoSobrante`) se da de baja solo: su evento sigue con el
 * presupuesto Confirmado y no se toca.
 */
export async function darDeBajaPresupuesto(
  id: number,
  repo: PresupuestosRepositorio = presupuestosRepositorioReal,
): Promise<ConsultaDetallada> {
  const presupuesto = await buscarOFallar(id, repo);
  if (esPresupuestoSobrante(presupuesto)) {
    await repo.actualizarPresupuesto(id, { estado: 'Cancelado' });
    return obtenerConsulta(id, repo);
  }
  exigirConsultaEnCurso(presupuesto, 'dar de baja');

  await repo.crearEnTransaccion(async (tx) => {
    await repo.actualizarPresupuesto(id, { estado: 'Cancelado' }, tx);
    await repo.actualizarEvento(presupuesto.eventoId, { estado: 'Cancelado' }, tx);
  });
  return obtenerConsulta(id, repo);
}

/**
 * HU-24: una consulta nueva para el mismo cliente con la configuración de un evento anterior, para
 * no volver a cargarla cuando un cliente recurrente repite su evento.
 *
 * - El original puede estar en cualquier estado (también Cancelado: el cliente que canceló y
 *   vuelve) y no se modifica.
 * - Se copia lo que se reutiliza: el tipo de evento, los salones con su distribución, los
 *   servicios con su modalidad y los adicionales escritos a mano con su precio. Lo propio de cada
 *   cliente no viaja (equipo, 17/10/2026): la fecha, las personas y la jornada vienen en el pedido,
 *   la cantidad de cada línea vuelve al valor por defecto (las personas nuevas si se cobra por
 *   persona, 1 si no) y las horas quedan vacías. Tampoco se copian los pagos, el estado, la
 *   solicitud ni las notas de la comanda.
 * - La fecha es obligatoria y futura, contra el día de hoy en Córdoba (ADR 0010). Como cualquier
 *   consulta, nace sin horario, con una hora de inicio aproximada si viene; el horario exacto se
 *   carga al agendar (ADR 0007).
 * - Los precios son los vigentes del catálogo proyectados a la fecha nueva (RN-13), no los
 *   congelados del original: un ajuste comercial (RN-03) no se arrastra. Un servicio que ya no
 *   está activo no se copia y se informa; un tercerizado a cotizar se copia sin importe.
 * - El presupuesto nace Estimado, con 10 días de vigencia (RN-08). Si no queda ninguna línea (una
 *   consulta social sin armar) nace sin armar y sin vencimiento, como la consulta social.
 * - Una consulta no bloquea el salón (RN-12): si ese día algún salón ya tiene un evento reservado,
 *   la consulta se crea igual y se informa el conflicto.
 */
export async function reutilizarConfiguracion(
  eventoId: number,
  datos: ReutilizarEvento,
  repo: PresupuestosRepositorio = presupuestosRepositorioReal,
): Promise<EventoReutilizado> {
  const original = await repo.buscarEventoParaReutilizar(eventoId);
  if (!original) throw ErrorApi.noEncontrado(`No existe el evento ${eventoId}`);
  // HU-50: reutilizar copia la franja entera, y eso llega en la parte 4.
  exigirEventoDeUnDia(original, 'reutilizar');

  if (datos.fecha <= hoyEnZonaEventos()) {
    throw new ErrorApi(400, CODIGOS_ERROR.VALIDACION, 'Los datos enviados no son válidos', [
      { campo: 'fecha', mensaje: 'La fecha del evento nuevo tiene que ser futura' },
    ]);
  }

  // El presupuesto del evento: el último que no se dio de baja, o el último si todos se cancelaron
  // (un evento cancelado tiene su presupuesto cancelado y es justo el que se quiere reutilizar).
  const presupuestos = [...original.presupuestos].reverse();
  const origen = presupuestos.find((p) => p.estado !== 'Cancelado') ?? presupuestos[0];
  const lineasOriginales = origen?.lineas ?? [];

  const jornada = datos.tipoJornada;
  const personas = datos.cantidadPersonas;
  const proyeccion = await proyeccionHasta(datos.fecha, repo);

  const lineasSalones = original.salones.map(({ salon }) =>
    lineaDeSalon(salon, jornada, precioProyectado(precioDeSalon(salon, jornada), proyeccion)),
  );

  const serviciosOmitidos: EventoReutilizado['serviciosOmitidos'] = [];
  const lineasServicios: LineaCalculada[] = [];
  const adicionales: LineaCalculada[] = [];
  for (const linea of lineasOriginales) {
    if (linea.salonId !== null) continue;
    if (linea.servicio === null) {
      adicionales.push(calcularLinea(null, linea.descripcion, 1, linea.precioUnitario));
      continue;
    }
    const { servicio } = linea;
    if (!servicio.activo) {
      if (!serviciosOmitidos.some((omitido) => omitido.id === servicio.id)) {
        serviciosOmitidos.push({ id: servicio.id, nombre: servicio.nombre });
      }
      continue;
    }
    lineasServicios.push(
      lineaDeServicio(
        servicio,
        servicio.porPersona ? personas : 1,
        precioVigenteDeServicio(servicio, proyeccion),
        // Si el servicio dejó de admitir modalidad, el recargo ya no corresponde.
        servicio.admiteModalidad ? linea.modalidad : 'Normal',
        null,
      ),
    );
  }

  const lineas = [...lineasSalones, ...lineasServicios, ...adicionales];
  const total = sumarLineas(lineas);
  const salonIds = original.salones.map((s) => s.salonId);
  // Una distribución dada de baja (HU-25 del Sprint 4) no se copia: el evento nuevo la elegiría de
  // nuevo. Ese salón queda sin armado, para elegirlo al agendar.
  const distribuciones = new Map(
    original.salones.flatMap((s) =>
      s.distribucionId === null || !s.distribucion?.activo
        ? []
        : [[s.salonId, s.distribucionId] as const],
    ),
  );
  const fecha = new Date(datos.fecha);
  const salonesEnConflicto =
    salonIds.length > 0 ? await repo.buscarSalonesReservadosEseDia(salonIds, fecha) : [];

  const fechaEmision = new Date();
  const creado = await repo.crearEnTransaccion(async (tx) => {
    const evento = await repo.crearEvento(
      {
        clienteId: original.clienteId,
        fecha,
        cantidadPersonas: personas,
        tipo: original.tipo,
        tipoSocial: original.tipoSocial,
        tipoSocialDetalle: original.tipoSocialDetalle,
        tipoJornada: jornada,
        horaInicioEstimada: datos.horaInicioEstimada ?? null,
      },
      tx,
    );
    await repo.reemplazarSalonesDelEvento(evento.id, salonIds, tx, distribuciones);
    return repo.crearPresupuestoConLineas(
      {
        eventoId: evento.id,
        fechaEmision,
        venceEn: lineas.length > 0 ? calcularVencimiento(fechaEmision) : null,
        total: total.toFixed(2),
        lineas,
      },
      tx,
    );
  });

  return {
    consulta: await obtenerConsulta(creado.id, repo),
    serviciosOmitidos,
    salonesEnConflicto,
  };
}

// Una línea guardada, con lo que hace falta para recalcularla: su servicio y su salón del catálogo.
type LineaParaRecalcular = {
  servicioId: number | null;
  salonId: number | null;
  descripcion: string;
  cantidad: number;
  modalidad: ModalidadServicio;
  precioBase: Prisma.Decimal | null;
  precioUnitario: Prisma.Decimal;
  subtotal: Prisma.Decimal;
  aCotizar: boolean;
  horaEstimada: string | null;
  // HU-50: el día al que pertenece la línea; el recálculo no la cambia de día.
  diaId?: number;
  servicio: {
    id: number;
    nombre: string;
    precio: Prisma.Decimal | null;
    tercerizado: boolean;
  } | null;
  salon: {
    id: number;
    nombre: string;
    precioJornadaCompleta: Prisma.Decimal;
    precioMediaJornada: Prisma.Decimal;
  } | null;
};

/**
 * HU-54: las líneas de un presupuesto con los precios del catálogo proyectados (RN-13) con un
 * porcentaje y una cantidad de meses. Función pura: no lee la base.
 *
 * - El salón toma el precio de su jornada, proyectado.
 * - Un servicio del catálogo toma su precio base proyectado y conserva la modalidad (el recargo se
 *   vuelve a aplicar, RN-11), la cantidad, la hora y la descripción.
 * - No cambian los tercerizados (no reciben incremento, RN-10), las líneas a cotizar ni los
 *   adicionales escritos a mano.
 *
 * Un precio ajustado a mano en una línea del catálogo (RN-03) se pisa con el del catálogo: el modelo
 * no distingue un precio ajustado de uno tomado del catálogo.
 */
export function recalcularLineas(
  lineas: LineaParaRecalcular[],
  proyeccion: Proyeccion,
): { lineas: LineaCalculada[]; total: Prisma.Decimal } {
  const calculadas = lineas.map((linea): LineaCalculada => {
    if (linea.salon) {
      const jornada = jornadaDeLineaSalon(linea.descripcion);
      return lineaDeSalon(
        linea.salon,
        jornada,
        precioProyectado(precioDeSalon(linea.salon, jornada), proyeccion),
      );
    }
    const servicio = linea.servicio;
    if (servicio && !linea.aCotizar && !servicio.tercerizado && servicio.precio !== null) {
      return lineaDeServicio(
        servicio,
        linea.cantidad,
        precioProyectado(servicio.precio, proyeccion),
        linea.modalidad,
        linea.horaEstimada,
        linea.descripcion,
      );
    }
    return {
      servicioId: linea.servicioId,
      salonId: linea.salonId,
      descripcion: linea.descripcion,
      cantidad: linea.cantidad,
      modalidad: linea.modalidad,
      precioBase: linea.precioBase === null ? null : linea.precioBase.toFixed(2),
      precioUnitario: linea.precioUnitario.toFixed(2),
      subtotal: linea.subtotal.toFixed(2),
      aCotizar: linea.aCotizar,
      horaEstimada: linea.horaEstimada,
    };
  });
  // Cada línea sigue en su día.
  const nuevas = calculadas.map((nueva, i) => {
    const diaId = lineas[i]!.diaId;
    return diaId === undefined ? nueva : { ...nueva, diaId };
  });
  return { lineas: nuevas, total: sumarLineas(nuevas) };
}

/**
 * HU-54 (`dominio.md`, «Recálculo automático»): al cambiar el porcentaje de incremento se recalculan
 * solo los presupuestos `Estimado` de eventos `EnConsulta`, con el porcentaje nuevo y proyectados a
 * la fecha de cada evento. **No reinicia la vigencia**: la emisión y el vencimiento no cambian, es un
 * recálculo masivo que nadie le comunica al cliente. Corre dentro de la transacción del que cambia
 * el porcentaje (`tx`). Devuelve cuántos presupuestos recalculó.
 *
 * En la auditoría (HU-25 del backlog) el recálculo queda a nombre del Sistema (`null`): el cambio
 * de porcentaje sí queda a nombre de quien lo hizo. Se guarda todo junto con guardarRecalculo, que
 * no vuelve a leer lo que ya se leyó acá y no escribe los presupuestos que no cambian.
 */
export async function recalcularEstimadosEnConsulta(
  porcentaje: string,
  tx: Prisma.TransactionClient,
  repo: PresupuestosRepositorio = presupuestosRepositorioReal,
): Promise<number> {
  const presupuestos = await repo.listarEstimadosParaRecalcular(tx);
  const hoy = hoyEnZonaEventos();
  const recalculados = presupuestos.map((presupuesto) => {
    const proyeccion: Proyeccion = {
      porcentaje,
      // HU-50: la referencia de los precios es el último día del evento (RN-13).
      meses: mesesHastaEvento(
        hoy,
        (presupuesto.evento.fechaFin ?? presupuesto.evento.fecha).toISOString().slice(0, 10),
      ),
    };
    const { lineas, total } = recalcularLineas(presupuesto.lineas, proyeccion);
    return {
      id: presupuesto.id,
      totalAnterior: presupuesto.total,
      lineasAnteriores: presupuesto.lineas,
      lineas,
      total: total.toFixed(2),
    };
  });
  await repo.guardarRecalculo(recalculados, tx);
  return presupuestos.length;
}

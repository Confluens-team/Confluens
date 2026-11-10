// Datos de demostración: 15 eventos entre noviembre y diciembre de 2026 que cubren cada estado de
// evento y de presupuesto, con pagos de distinto tipo, varios salones y servicios variados. No es
// parte del seed ni del producto: sirve para mirar la agenda y el listado de consultas y para que el
// cliente estudie cómo responde el sistema.
//
// Uso, desde apps/api:  npx tsx --env-file=../../.env prisma/datos-demo.ts
//
// - Todo cliente demo lleva un correo @demo.confluens.example y no tiene usuario para iniciar sesión.
//   Es la marca con la que el script se limpia a sí mismo: correrlo de nuevo borra las demos
//   anteriores y las vuelve a crear, sin tocar nada que no sea demo.
// - Contra una base que no sea local exige CONFIRMO_BASE_REMOTA=<host de la base>, para no cargar
//   datos en producción por error.
// - Los precios se calculan como si cada presupuesto se hubiera armado hoy: se proyectan con el
//   incremento mensual vigente (RN-13) y el recargo de modalidad (RN-11). Por eso dependen de la
//   fecha en que se corre y del porcentaje cargado en ConfiguracionPrecios.
// - Todos los presupuestos requieren factura (HU-53): la base de cobro es el total más el 21%.
// - Los horarios llevan la hora de Córdoba (-03:00), la misma que usa la agenda (ADR 0010).
import {
  DIAS_VIGENCIA_PRESUPUESTO,
  PORCENTAJE_IVA,
  PORCENTAJE_SENA,
  aplicarModalidad,
  hoyEnZonaEventos,
  mesesHastaEvento,
  proyectarPrecio,
  type ModalidadServicio,
} from '@confluens/shared';

import { Prisma } from '../src/generated/prisma/client.js';
import { prisma } from '../src/lib/prisma.js';

const DOMINIO_DEMO = '@demo.confluens.example';
const MS_DIA = 24 * 60 * 60 * 1000;

type EstadoEvento = 'EnConsulta' | 'Reservado' | 'Cobrado' | 'Cancelado';
type EstadoPresupuesto = 'Estimado' | 'Confirmado' | 'Cancelado' | 'Expirado';
type TipoSocial = 'Cumpleanos' | 'Casamiento' | 'FiestaDeQuince' | 'Bautismo';
type Jornada = 'media' | 'completa';

interface LineaServicio {
  servicio: string;
  cantidad: number;
  modalidad?: ModalidadServicio;
  hora?: string;
}

// Servicio escrito a mano, que no está en el catálogo. Puede valer $0 (cortesía de la casa).
interface Adicional {
  descripcion: string;
  precio: string;
  hora?: string;
}

interface PagoDemo {
  dia: string;
  // Porcentaje de la base de cobro, o `saldo` para completar lo que falta hasta el 100%.
  porcentaje?: number;
  saldo?: true;
  medio: string;
  observacion: string;
  // Día en que se anuló, con el usuario administrador como autor.
  anuladoEl?: string;
}

interface Caso {
  titulo: string;
  cliente: { nombre: string; apellido?: string; etiqueta?: string };
  estado: EstadoEvento;
  tipo: 'Corporativo' | 'Social';
  tipoSocial?: TipoSocial;
  fecha: string;
  salones: { nombre: string; distribucion: string }[];
  jornada?: Jornada;
  // `fin` menor que `inicio` es la hora del día siguiente. Sin horario, el evento no está agendado.
  horario?: { inicio: string; fin: string };
  horaEstimada?: { inicio: string };
  personas: number;
  servicios?: LineaServicio[];
  adicionales?: Adicional[];
  presupuesto: {
    estado: EstadoPresupuesto;
    // Día de emisión, o hace cuántos días si tiene que estar vigente o vencido sea cual sea la fecha.
    emision: string | { haceDias: number };
    sinArmar?: true;
    seguimiento?: 'nuevo' | 'aviso' | 'enviado';
  };
  pagos?: PagoDemo[];
  comanda?: string;
  solicitud?: true;
}

interface SolicitudSuelta {
  cliente: { nombre: string; apellido: string };
  fechaDeseada: string;
  personas: number;
  salon: string;
  descartada?: true;
  haceDias: number;
}

const CASOS: Caso[] = [
  // ── Noviembre ────────────────────────────────────────────────────────────────────────────────
  {
    titulo: 'Cobrado · pasado · seña, pago intermedio y saldo',
    cliente: { nombre: 'Valentina', apellido: 'Ríos', etiqueta: 'Globant' },
    estado: 'Cobrado',
    tipo: 'Corporativo',
    fecha: '2026-11-05',
    salones: [{ nombre: 'Bariloche', distribucion: 'Conferencia' }],
    jornada: 'completa',
    horario: { inicio: '09:00', fin: '18:00' },
    personas: 40,
    servicios: [
      { servicio: 'Coffee Especial', cantidad: 40, hora: '10:30' },
      { servicio: 'Almuerzo / Cena — Opción 2', cantidad: 40, hora: '13:00' },
    ],
    presupuesto: { estado: 'Confirmado', emision: '2026-10-12', seguimiento: 'enviado' },
    pagos: [
      { dia: '2026-10-14', porcentaje: 20, medio: 'Transferencia', observacion: 'Seña' },
      { dia: '2026-10-28', porcentaje: 40, medio: 'Cheque', observacion: 'Pago intermedio' },
      { dia: '2026-11-03', saldo: true, medio: 'Transferencia', observacion: 'Saldo' },
    ],
    comanda: 'Dos menús sin TACC. Entrar por la puerta de servicio.',
  },
  {
    titulo: 'Cobrado · pasado · un solo pago del 100%',
    cliente: { nombre: 'Martina', apellido: 'Acosta' },
    estado: 'Cobrado',
    tipo: 'Social',
    tipoSocial: 'Cumpleanos',
    fecha: '2026-11-06',
    salones: [{ nombre: 'Paraná', distribucion: 'Banquete' }],
    jornada: 'media',
    horario: { inicio: '20:00', fin: '23:30' },
    personas: 12,
    servicios: [{ servicio: 'Lunch / Cocktail — Opción 3', cantidad: 12, hora: '20:30' }],
    presupuesto: { estado: 'Confirmado', emision: '2026-10-30', seguimiento: 'enviado' },
    pagos: [{ dia: '2026-11-02', saldo: true, medio: 'Efectivo', observacion: 'Pago total' }],
  },
  {
    titulo: 'EnConsulta · presupuesto Estimado vigente',
    cliente: { nombre: 'Constructora Medina SRL', etiqueta: 'atlassian' },
    estado: 'EnConsulta',
    tipo: 'Corporativo',
    fecha: '2026-11-12',
    salones: [{ nombre: 'Iguazú', distribucion: 'Mesas de trabajo' }],
    jornada: 'media',
    horaEstimada: { inicio: '09:00' },
    personas: 25,
    servicios: [{ servicio: 'Coffee Express', cantidad: 25, hora: '10:30' }],
    presupuesto: { estado: 'Estimado', emision: { haceDias: 1 }, seguimiento: 'aviso' },
    solicitud: true,
  },
  {
    titulo: 'EnConsulta · presupuesto Expirado (aviso de vencido)',
    cliente: { nombre: 'Estudio Contable Paz' },
    estado: 'EnConsulta',
    tipo: 'Corporativo',
    fecha: '2026-11-16',
    salones: [{ nombre: 'Pucará', distribucion: 'Conferencia' }],
    jornada: 'media',
    horaEstimada: { inicio: '09:00' },
    personas: 60,
    servicios: [{ servicio: 'Desayuno Continental', cantidad: 60, hora: '09:00' }],
    presupuesto: {
      estado: 'Expirado',
      emision: { haceDias: DIAS_VIGENCIA_PRESUPUESTO + 4 },
      seguimiento: 'enviado',
    },
  },
  {
    titulo: 'Reservado · solo la seña · coffee continuo (+20%)',
    cliente: { nombre: 'Facundo', apellido: 'Ledesma' },
    estado: 'Reservado',
    tipo: 'Corporativo',
    fecha: '2026-11-18',
    salones: [{ nombre: 'Pucará', distribucion: 'Mesas de trabajo' }],
    jornada: 'completa',
    horario: { inicio: '09:00', fin: '18:00' },
    personas: 55,
    servicios: [
      { servicio: 'Coffee Intermedio', cantidad: 55, modalidad: 'Continuo', hora: '10:30' },
      { servicio: 'Almuerzo / Cena — Opción 3', cantidad: 55, hora: '13:00' },
    ],
    presupuesto: { estado: 'Confirmado', emision: '2026-11-02', seguimiento: 'enviado' },
    pagos: [{ dia: '2026-11-04', porcentaje: 20, medio: 'Débito', observacion: 'Seña' }],
  },
  {
    titulo: 'Reservado · seña y pago intermedio · dispenser y servicio propio',
    cliente: { nombre: 'Laboratorios Del Plata SA' },
    estado: 'Reservado',
    tipo: 'Corporativo',
    fecha: '2026-11-18',
    salones: [{ nombre: 'Auditorio', distribucion: 'Conferencia' }],
    jornada: 'completa',
    horario: { inicio: '08:30', fin: '18:30' },
    personas: 200,
    servicios: [
      { servicio: 'Coffee Especial', cantidad: 200, hora: '10:30' },
      { servicio: 'Dispenser con vasos descartables', cantidad: 1 },
    ],
    adicionales: [{ descripcion: 'Cartelería y señalética del evento', precio: '85000' }],
    presupuesto: { estado: 'Confirmado', emision: '2026-11-01', seguimiento: 'enviado' },
    pagos: [
      { dia: '2026-11-03', porcentaje: 20, medio: 'Transferencia', observacion: 'Seña' },
      { dia: '2026-11-09', porcentaje: 40, medio: 'Cheque', observacion: 'Pago intermedio' },
    ],
  },
  {
    titulo: 'EnConsulta agendada · se pisa con la reserva de Pucará del mismo día',
    cliente: { nombre: 'Agustina', apellido: 'Herrera' },
    estado: 'EnConsulta',
    tipo: 'Corporativo',
    fecha: '2026-11-18',
    salones: [{ nombre: 'Pucará', distribucion: 'Conferencia' }],
    jornada: 'media',
    horario: { inicio: '14:00', fin: '18:00' },
    personas: 45,
    servicios: [{ servicio: 'Coffee Refresh', cantidad: 45, hora: '15:30' }],
    presupuesto: { estado: 'Estimado', emision: { haceDias: 3 }, seguimiento: 'aviso' },
  },
  {
    titulo: 'Reservado · casamiento en 3 salones que termina pasada la medianoche',
    cliente: { nombre: 'Camila', apellido: 'Ferreyra' },
    estado: 'Reservado',
    tipo: 'Social',
    tipoSocial: 'Casamiento',
    fecha: '2026-11-21',
    salones: [
      { nombre: 'Pucará', distribucion: 'Banquete' },
      { nombre: 'Bariloche', distribucion: 'Banquete' },
      { nombre: 'Iguazú', distribucion: 'Banquete' },
    ],
    jornada: 'completa',
    horario: { inicio: '21:00', fin: '03:00' },
    personas: 140,
    servicios: [
      { servicio: 'Lunch / Cocktail — Opción 2', cantidad: 140, hora: '21:15' },
      { servicio: 'Almuerzo / Cena — Opción 4', cantidad: 140, hora: '22:00' },
    ],
    adicionales: [
      { descripcion: 'Barra de tragos', precio: '450000', hora: '23:30' },
      { descripcion: 'Brindis de cortesía de la casa', precio: '0', hora: '00:00' },
    ],
    presupuesto: { estado: 'Confirmado', emision: '2026-10-28', seguimiento: 'enviado' },
    pagos: [
      { dia: '2026-11-01', porcentaje: 20, medio: 'Transferencia', observacion: 'Seña' },
      { dia: '2026-11-08', porcentaje: 30, medio: 'Débito', observacion: 'Pago intermedio' },
    ],
    comanda: 'Tres menús vegetarianos en la mesa principal. Brindis a las 00:00.',
  },
  {
    titulo: 'Cancelado desde Reservado · la seña cobrada no se devuelve',
    cliente: { nombre: 'Lucas', apellido: 'Domínguez' },
    estado: 'Cancelado',
    tipo: 'Social',
    tipoSocial: 'Bautismo',
    fecha: '2026-11-22',
    salones: [{ nombre: 'Iguazú', distribucion: 'Banquete' }],
    jornada: 'media',
    horario: { inicio: '12:00', fin: '16:00' },
    personas: 25,
    servicios: [{ servicio: 'Lunch / Cocktail — Opción 2', cantidad: 25, hora: '12:30' }],
    presupuesto: { estado: 'Cancelado', emision: '2026-10-28', seguimiento: 'enviado' },
    pagos: [{ dia: '2026-10-30', porcentaje: 20, medio: 'Efectivo', observacion: 'Seña' }],
  },
  {
    titulo: 'Cancelado desde EnConsulta · presupuesto Cancelado',
    cliente: { nombre: 'Soledad', apellido: 'Benítez' },
    estado: 'Cancelado',
    tipo: 'Corporativo',
    fecha: '2026-11-26',
    salones: [{ nombre: 'Auditorio', distribucion: 'Conferencia' }],
    jornada: 'completa',
    horaEstimada: { inicio: '09:00' },
    personas: 120,
    servicios: [{ servicio: 'Coffee Intermedio', cantidad: 120, hora: '10:30' }],
    presupuesto: { estado: 'Cancelado', emision: { haceDias: 12 }, seguimiento: 'enviado' },
  },
  {
    titulo: 'Reservado · una anulación dejó lo pagado por debajo de la seña',
    cliente: { nombre: 'Gonzalo', apellido: 'Bustos' },
    estado: 'Reservado',
    tipo: 'Corporativo',
    fecha: '2026-11-27',
    salones: [{ nombre: 'Bariloche', distribucion: 'Mesas de trabajo' }],
    jornada: 'completa',
    horario: { inicio: '09:00', fin: '17:00' },
    personas: 35,
    servicios: [
      { servicio: 'Desayuno Continental', cantidad: 35, hora: '09:00' },
      { servicio: 'Almuerzo / Cena — Opción 2', cantidad: 35, hora: '13:00' },
    ],
    presupuesto: { estado: 'Confirmado', emision: '2026-11-01', seguimiento: 'enviado' },
    pagos: [
      {
        dia: '2026-11-02',
        porcentaje: 20,
        medio: 'Débito',
        observacion: 'Seña cargada con el monto equivocado',
        anuladoEl: '2026-11-05',
      },
      { dia: '2026-11-06', porcentaje: 12, medio: 'Transferencia', observacion: 'Pago parcial' },
    ],
  },
  // ── Diciembre ────────────────────────────────────────────────────────────────────────────────
  {
    titulo: 'Cobrado · futuro · pagado por adelantado',
    cliente: { nombre: 'Grupo Andino SRL' },
    estado: 'Cobrado',
    tipo: 'Corporativo',
    fecha: '2026-12-04',
    salones: [{ nombre: 'Auditorio', distribucion: 'Banquete' }],
    jornada: 'completa',
    horario: { inicio: '10:00', fin: '19:00' },
    personas: 150,
    servicios: [
      { servicio: 'Coffee Intermedio', cantidad: 150, hora: '10:00' },
      { servicio: 'Almuerzo / Cena — Opción 3', cantidad: 150, hora: '13:30' },
    ],
    presupuesto: { estado: 'Confirmado', emision: '2026-10-28', seguimiento: 'enviado' },
    pagos: [
      { dia: '2026-11-02', porcentaje: 20, medio: 'Transferencia', observacion: 'Seña' },
      { dia: '2026-11-09', saldo: true, medio: 'Transferencia', observacion: 'Saldo anticipado' },
    ],
  },
  {
    titulo: 'Reservado · fiesta de 15 en 2 salones que termina pasada la medianoche',
    cliente: { nombre: 'Florencia', apellido: 'Sosa' },
    estado: 'Reservado',
    tipo: 'Social',
    tipoSocial: 'FiestaDeQuince',
    fecha: '2026-12-11',
    salones: [
      { nombre: 'Pucará', distribucion: 'Banquete' },
      { nombre: 'Paraná', distribucion: 'Banquete' },
    ],
    jornada: 'completa',
    horario: { inicio: '21:00', fin: '02:00' },
    personas: 70,
    servicios: [
      { servicio: 'Lunch / Cocktail — Opción 4', cantidad: 70, hora: '21:15' },
      { servicio: 'Almuerzo / Cena — Opción 2', cantidad: 70, hora: '22:30' },
    ],
    presupuesto: { estado: 'Confirmado', emision: '2026-11-06', seguimiento: 'enviado' },
    pagos: [{ dia: '2026-11-07', porcentaje: 25, medio: 'Crédito', observacion: 'Seña' }],
  },
  {
    titulo: 'EnConsulta · social con presupuesto Estimado vigente',
    cliente: { nombre: 'Marcos', apellido: 'Peralta' },
    estado: 'EnConsulta',
    tipo: 'Social',
    tipoSocial: 'Cumpleanos',
    fecha: '2026-12-15',
    salones: [{ nombre: 'Iguazú', distribucion: 'Banquete' }],
    jornada: 'media',
    horaEstimada: { inicio: '20:00' },
    personas: 28,
    servicios: [{ servicio: 'Lunch / Cocktail — Opción 3', cantidad: 28, hora: '20:30' }],
    presupuesto: { estado: 'Estimado', emision: { haceDias: 2 }, seguimiento: 'aviso' },
  },
  {
    titulo: 'EnConsulta · consulta social nueva, sin salón y con presupuesto sin armar',
    cliente: { nombre: 'Rocío', apellido: 'Barrionuevo' },
    estado: 'EnConsulta',
    tipo: 'Social',
    tipoSocial: 'Casamiento',
    fecha: '2026-12-19',
    salones: [],
    horaEstimada: { inicio: '20:00' },
    personas: 90,
    presupuesto: {
      estado: 'Estimado',
      emision: { haceDias: 1 },
      sinArmar: true,
      seguimiento: 'nuevo',
    },
    solicitud: true,
  },
];

// Consultas del canal público que nadie convirtió en evento todavía: una pendiente y una descartada.
const SOLICITUDES: SolicitudSuelta[] = [
  {
    cliente: { nombre: 'Nicolás', apellido: 'Vera' },
    fechaDeseada: '2026-12-05',
    personas: 30,
    salon: 'Pucará',
    haceDias: 2,
  },
  {
    cliente: { nombre: 'Paula', apellido: 'Giménez' },
    fechaDeseada: '2026-11-30',
    personas: 15,
    salon: 'Paraná',
    descartada: true,
    haceDias: 6,
  },
];

// ── Utilidades ───────────────────────────────────────────────────────────────────────────────────

const dec = (valor: string | number | Prisma.Decimal) => new Prisma.Decimal(valor);

function sumarDias(dia: string, dias: number): string {
  return new Date(Date.parse(`${dia}T00:00:00Z`) + dias * MS_DIA).toISOString().slice(0, 10);
}

// Columna @db.Date: se guarda el día, sin hora.
function fecha(dia: string): Date {
  return new Date(`${dia}T00:00:00.000Z`);
}

// Un instante a la hora de Córdoba. Argentina no tiene horario de verano: el desfase es siempre -03.
function instante(dia: string, hhmm: string, diasDespues = 0): Date {
  return new Date(`${sumarDias(dia, diasDespues)}T${hhmm}:00-03:00`);
}

function buscar<T>(lista: T[], donde: (item: T) => boolean, descripcion: string): T {
  const encontrado = lista.find(donde);
  if (!encontrado) throw new Error(`Falta ${descripcion}: ¿corriste el seed y las migraciones?`);
  return encontrado;
}

function slug(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.|\.$/g, '');
}

function verificarBase(): void {
  const host = new URL(process.env.DATABASE_URL ?? 'postgresql://sin-url').hostname;
  const esLocal = ['localhost', '127.0.0.1', '[::1]', '::1'].includes(host);
  if (!esLocal && process.env.CONFIRMO_BASE_REMOTA !== host) {
    throw new Error(
      `La base es ${host}, no es local. Para cargar las demos ahí, corré de nuevo con CONFIRMO_BASE_REMOTA=${host}`,
    );
  }
  console.log(`Base: ${host}${esLocal ? ' (local)' : ' (REMOTA, confirmada)'}`);
}

// ── Carga ────────────────────────────────────────────────────────────────────────────────────────

async function main() {
  verificarBase();

  const [salones, servicios, medios, etiquetas, config, admin] = await Promise.all([
    prisma.salon.findMany({ include: { distribuciones: true } }),
    prisma.servicio.findMany(),
    prisma.medioPago.findMany(),
    prisma.etiqueta.findMany(),
    prisma.configuracionPrecios.findUnique({ where: { id: 1 } }),
    prisma.usuario.findFirst({ where: { rol: 'ADMINISTRADOR_SISTEMA' }, orderBy: { id: 'asc' } }),
  ]);
  if (!admin) throw new Error('No hay ningún administrador para firmar las anulaciones.');
  const incremento = (config?.porcentajeMensual ?? dec(0)).toString();
  const hoy = hoyEnZonaEventos();
  const ahora = new Date();

  const salon = (nombre: string) =>
    buscar(salones, (s) => s.nombre === nombre, `el salón ${nombre}`);
  const servicio = (nombre: string) =>
    buscar(servicios, (s) => s.nombre === nombre, `el servicio ${nombre}`);
  const medio = (nombre: string) =>
    buscar(medios, (m) => m.nombre === nombre, `el medio ${nombre}`);

  console.log(`Incremento mensual vigente: ${incremento}%. Hoy: ${hoy}.`);

  const resumen: Record<string, string | number>[] = [];

  await prisma.$transaction(
    async (tx) => {
      // Primero se borran las demos anteriores, de las hojas hacia la raíz.
      const previos = await tx.cliente.findMany({
        where: { correo: { endsWith: DOMINIO_DEMO } },
        select: { id: true },
      });
      const clienteIds = previos.map((c) => c.id);
      const eventoIds = (
        await tx.evento.findMany({ where: { clienteId: { in: clienteIds } }, select: { id: true } })
      ).map((e) => e.id);
      await tx.lineaPresupuesto.deleteMany({
        where: { presupuesto: { eventoId: { in: eventoIds } } },
      });
      await tx.presupuesto.deleteMany({ where: { eventoId: { in: eventoIds } } });
      await tx.pago.deleteMany({ where: { eventoId: { in: eventoIds } } });
      await tx.solicitud.deleteMany({
        where: { OR: [{ correo: { endsWith: DOMINIO_DEMO } }, { eventoId: { in: eventoIds } }] },
      });
      await tx.evento.deleteMany({ where: { id: { in: eventoIds } } });
      await tx.cliente.deleteMany({ where: { id: { in: clienteIds } } });
      if (clienteIds.length > 0)
        console.log(`Demos anteriores borradas: ${clienteIds.length} clientes.`);

      let numeroCliente = 0;
      const crearCliente = async (c: { nombre: string; apellido?: string; etiqueta?: string }) => {
        numeroCliente += 1;
        const etiqueta = c.etiqueta ? etiquetas.find((e) => e.nombre === c.etiqueta) : undefined;
        return tx.cliente.create({
          data: {
            nombre: c.nombre,
            apellido: c.apellido ?? null,
            telefono: `+549351555${String(1000 + numeroCliente)}`,
            correo: `${slug(`${c.nombre} ${c.apellido ?? ''}`)}${DOMINIO_DEMO}`,
            etiquetaId: etiqueta?.id ?? null,
          },
        });
      };

      for (const caso of CASOS) {
        const meses = mesesHastaEvento(hoy, caso.fecha);
        const emision =
          typeof caso.presupuesto.emision === 'string'
            ? instante(caso.presupuesto.emision, '10:00')
            : new Date(ahora.getTime() - caso.presupuesto.emision.haceDias * MS_DIA);

        // Líneas del presupuesto, con el precio proyectado a la fecha del evento (RN-13).
        const lineas: Prisma.LineaPresupuestoUncheckedCreateWithoutPresupuestoInput[] = [];
        if (!caso.presupuesto.sinArmar) {
          for (const { nombre } of caso.salones) {
            const s = salon(nombre);
            const base =
              caso.jornada === 'completa' ? s.precioJornadaCompleta : s.precioMediaJornada;
            const precio = proyectarPrecio(base.toString(), incremento, meses);
            lineas.push({
              salonId: s.id,
              descripcion: `Salón ${s.nombre} (${caso.jornada === 'completa' ? 'jornada completa' : 'media jornada'})`,
              cantidad: 1,
              precioUnitario: precio,
              subtotal: precio,
            });
          }
          for (const linea of caso.servicios ?? []) {
            const s = servicio(linea.servicio);
            if (s.precio === null) throw new Error(`${s.nombre} no tiene precio fijo`);
            const modalidad = linea.modalidad ?? 'Normal';
            const precioBase = proyectarPrecio(s.precio.toString(), incremento, meses);
            const unitario = aplicarModalidad(precioBase, modalidad);
            lineas.push({
              servicioId: s.id,
              descripcion: s.nombre,
              cantidad: linea.cantidad,
              modalidad,
              precioBase,
              precioUnitario: unitario,
              subtotal: dec(unitario).times(linea.cantidad),
              horaEstimada: linea.hora ?? null,
            });
          }
          for (const adicional of caso.adicionales ?? []) {
            lineas.push({
              descripcion: adicional.descripcion,
              cantidad: 1,
              precioUnitario: adicional.precio,
              subtotal: adicional.precio,
              horaEstimada: adicional.hora ?? null,
            });
          }
        }
        const total = lineas.reduce((suma, l) => suma.plus(dec(l.subtotal.toString())), dec(0));
        // RN-01: con factura, la base de cobro es el total más el IVA.
        const baseCobro = total
          .times(100 + PORCENTAJE_IVA)
          .dividedBy(100)
          .toDecimalPlaces(2);

        const vence = caso.presupuesto.sinArmar
          ? null
          : new Date(emision.getTime() + DIAS_VIGENCIA_PRESUPUESTO * MS_DIA);

        // Pagos: cada porcentaje se redondea hacia arriba para que la seña nunca quede un centavo corta.
        let pagadoVigente = dec(0);
        let reservadoEl: Date | null = null;
        const pagos: Prisma.PagoCreateManyInput[] = [];
        const clienteDb = await crearCliente(caso.cliente);
        const evento = await tx.evento.create({
          data: {
            clienteId: clienteDb.id,
            fecha: fecha(caso.fecha),
            inicio: caso.horario ? instante(caso.fecha, caso.horario.inicio) : null,
            fin: caso.horario
              ? instante(
                  caso.fecha,
                  caso.horario.fin,
                  caso.horario.fin < caso.horario.inicio ? 1 : 0,
                )
              : null,
            cantidadPersonas: caso.personas,
            estado: caso.estado,
            tipo: caso.tipo,
            tipoSocial: caso.tipoSocial ?? null,
            tipoJornada: caso.jornada ?? null,
            horaInicioEstimada: caso.horario?.inicio ?? caso.horaEstimada?.inicio ?? null,
            observacionesComanda: caso.comanda ?? null,
            salones: {
              create: caso.salones.map(({ nombre, distribucion }) => {
                const s = salon(nombre);
                const d = buscar(
                  s.distribuciones,
                  (x) => x.nombre === distribucion,
                  `la distribución ${distribucion} de ${nombre}`,
                );
                return { salonId: s.id, distribucionId: d.id };
              }),
            },
          },
          // Solo el id: así el script no depende de las columnas que una rama nueva le agregue a Evento.
          select: { id: true },
        });

        for (const p of caso.pagos ?? []) {
          const monto = p.saldo
            ? baseCobro.minus(pagadoVigente)
            : baseCobro
                .times(p.porcentaje ?? 0)
                .dividedBy(100)
                .toDecimalPlaces(2, Prisma.Decimal.ROUND_UP);
          if (!p.anuladoEl) pagadoVigente = pagadoVigente.plus(monto);
          if (
            reservadoEl === null &&
            !p.anuladoEl &&
            pagadoVigente.times(100).greaterThanOrEqualTo(baseCobro.times(PORCENTAJE_SENA))
          ) {
            reservadoEl = instante(p.dia, '12:00');
          }
          pagos.push({
            eventoId: evento.id,
            fecha: fecha(p.dia),
            monto,
            medioPagoId: medio(p.medio).id,
            observacion: p.observacion,
            anuladoEn: p.anuladoEl ? instante(p.anuladoEl, '16:00') : null,
            anuladoPorId: p.anuladoEl ? admin.id : null,
          });
        }
        if (pagos.length > 0) await tx.pago.createMany({ data: pagos });

        // La seña se registra al cruzar el 20%; una seña anulada no cuenta. En el caso de la
        // anulación, la reserva se hizo con la seña original, antes de anularla.
        const senaOriginal = (caso.pagos ?? []).find((p) => (p.porcentaje ?? 0) >= PORCENTAJE_SENA);
        const fechaSena =
          reservadoEl ?? (senaOriginal ? instante(senaOriginal.dia, '12:00') : null);
        if (fechaSena && caso.estado !== 'EnConsulta') {
          await tx.evento.update({
            where: { id: evento.id },
            data: { senaRegistradaEn: fechaSena },
            select: { id: true },
          });
        }

        const seguimiento = caso.presupuesto.seguimiento ?? 'nuevo';
        await tx.presupuesto.create({
          data: {
            eventoId: evento.id,
            estado: caso.presupuesto.estado,
            fechaEmision: emision,
            venceEn: vence,
            total,
            requiereFactura: true,
            avisoRecepcionEn:
              seguimiento === 'nuevo' ? null : new Date(emision.getTime() + 60 * 60 * 1000),
            envioFormalEn:
              seguimiento === 'enviado' ? new Date(emision.getTime() + 2 * 60 * 60 * 1000) : null,
            lineas: { create: lineas },
          },
        });

        if (caso.solicitud) {
          await tx.solicitud.create({
            data: {
              clienteId: clienteDb.id,
              nombre: `${clienteDb.nombre} ${clienteDb.apellido ?? ''}`.trim(),
              telefono: clienteDb.telefono,
              correo: clienteDb.correo,
              fechaDeseada: fecha(caso.fecha),
              cantidadPersonas: caso.personas,
              salonId: caso.salones[0] ? salon(caso.salones[0].nombre).id : null,
              eventoId: evento.id,
              creadoEn: new Date(emision.getTime() - 2 * 60 * 60 * 1000),
            },
          });
        }

        const pct = baseCobro.isZero()
          ? '—'
          : `${pagadoVigente.times(100).dividedBy(baseCobro).toFixed(1)}%`;
        resumen.push({
          fecha: caso.fecha,
          evento: caso.estado,
          presupuesto: caso.presupuesto.estado,
          cliente: `${caso.cliente.nombre} ${caso.cliente.apellido ?? ''}`.trim(),
          salones: caso.salones.map((s) => s.nombre).join(' + ') || '(sin salón)',
          'total + IVA': baseCobro.toFixed(2),
          pagado: pct,
        });
      }

      for (const s of SOLICITUDES) {
        const cliente = await crearCliente(s.cliente);
        await tx.solicitud.create({
          data: {
            clienteId: cliente.id,
            nombre: `${s.cliente.nombre} ${s.cliente.apellido}`,
            telefono: cliente.telefono,
            correo: cliente.correo,
            fechaDeseada: fecha(s.fechaDeseada),
            cantidadPersonas: s.personas,
            salonId: salon(s.salon).id,
            descartada: s.descartada ?? false,
            creadoEn: new Date(ahora.getTime() - s.haceDias * MS_DIA),
          },
        });
      }
    },
    { timeout: 180_000, maxWait: 30_000 },
  );

  console.log('\nDatos de demo cargados:');
  console.table(resumen);
  console.log(`${CASOS.length} eventos y ${SOLICITUDES.length} consultas sin convertir.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

import {
  type EntidadAuditada,
  type RegistroAuditoria,
  ZONA_HORARIA_EVENTOS,
} from '@confluens/shared';

import { formatearPesos } from '@/lib/formato';

// HU-25 del backlog: cómo se lee la auditoría en el panel. La API guarda los nombres de las
// entidades y los campos del modelo (modelo-datos.md); acá se traducen para mostrarlos.

export const NOMBRES_DE_ENTIDAD: Record<EntidadAuditada, string> = {
  Salon: 'Salón',
  Distribucion: 'Distribución',
  Servicio: 'Servicio',
  ConfiguracionPrecios: 'Incremento de precios',
  MedioPago: 'Medio de pago',
  Cliente: 'Cliente',
  Etiqueta: 'Etiqueta',
  Solicitud: 'Solicitud',
  Evento: 'Evento',
  Presupuesto: 'Presupuesto',
  Pago: 'Pago',
  Usuario: 'Personal',
};

const NOMBRES_DE_CAMPO: Record<string, string> = {
  activo: 'Activo',
  aCotizar: 'A cotizar',
  admiteModalidad: 'Admite modalidad',
  anuladoEn: 'Anulado el',
  anuladoPorId: 'Anulado por (usuario)',
  apellido: 'Apellido',
  avisoRecepcionEn: 'Aviso de recepción',
  cantidadPersonas: 'Personas',
  capacidad: 'Capacidad',
  categoria: 'Categoría',
  clienteId: 'Cliente',
  contrasena: 'Contraseña',
  correo: 'Correo',
  descripcion: 'Descripción',
  email: 'Correo',
  envioFormalEn: 'Envío formal',
  estado: 'Estado',
  etiquetaId: 'Etiqueta',
  eventoId: 'Evento',
  fecha: 'Fecha',
  fechaDeseada: 'Fecha deseada',
  fechaEmision: 'Emisión',
  fin: 'Hasta',
  fotoUrl: 'Foto',
  horaFinEstimada: 'Hora de fin estimada',
  horaInicioEstimada: 'Hora de inicio estimada',
  inicio: 'Desde',
  lineas: 'Líneas',
  medioPagoId: 'Medio de pago',
  modalidadSalonRestaurante: 'Salón restaurante',
  monto: 'Monto',
  nombre: 'Nombre',
  observacion: 'Observación',
  observacionesComanda: 'Observaciones de la comanda',
  ocultoEn: 'Sacado del listado',
  porcentajeMensual: 'Porcentaje mensual',
  precio: 'Precio',
  precioJornadaCompleta: 'Precio jornada completa',
  precioMediaJornada: 'Precio media jornada',
  requiereFactura: 'Requiere factura',
  rol: 'Rol',
  salones: 'Salones',
  salonId: 'Salón',
  senaRegistradaEn: 'Seña registrada',
  telefono: 'Teléfono',
  tercerizado: 'Tercerizado',
  tipo: 'Tipo de evento',
  tipoJornada: 'Jornada',
  tipoSocial: 'Tipo social',
  tipoSocialDetalle: 'Detalle del tipo social',
  total: 'Total',
  venceEn: 'Vence',
  visibleEnLanding: 'Visible en la landing',
};

// Un campo sin nombre propio se lee igual: «precioBase» → «Precio base».
export function nombreDeCampo(campo: string): string {
  const nombre = NOMBRES_DE_CAMPO[campo];
  if (nombre) return nombre;
  const palabras = campo.replace(/([A-Z])/g, ' $1').toLowerCase();
  return palabras.charAt(0).toUpperCase() + palabras.slice(1);
}

const CAMPOS_EN_PESOS = new Set([
  'monto',
  'precio',
  'precioBase',
  'precioJornadaCompleta',
  'precioMediaJornada',
  'precioUnitario',
  'subtotal',
  'total',
]);

const FORMATO_FECHA_HORA = new Intl.DateTimeFormat('es-AR', {
  timeZone: ZONA_HORARIA_EVENTOS,
  dateStyle: 'short',
  timeStyle: 'short',
});

// Las fechas de calendario (@db.Date) llegan como medianoche UTC: se muestran sin hora y sin
// pasarlas a Córdoba, que las correría al día anterior.
const FORMATO_FECHA_CALENDARIO = new Intl.DateTimeFormat('es-AR', {
  timeZone: 'UTC',
  dateStyle: 'short',
});

const ES_FECHA_HORA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

export function formatearFechaHora(iso: string): string {
  return FORMATO_FECHA_HORA.format(new Date(iso));
}

function formatearLinea(linea: Record<string, unknown>): string {
  const precio = linea['aCotizar'] ? 'a cotizar' : formatearPesos(String(linea['subtotal'] ?? 0));
  return `${String(linea['cantidad'] ?? '')} × ${String(linea['descripcion'] ?? '')} (${precio})`;
}

// Un valor anterior o nuevo, listo para leer. Vacío es «—».
export function formatearValor(campo: string, valor: unknown): string {
  if (valor === null || valor === undefined || valor === '') return '—';
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
  if (Array.isArray(valor)) {
    if (valor.length === 0) return 'Ninguno';
    return valor
      .map((elemento) =>
        elemento !== null && typeof elemento === 'object'
          ? formatearLinea(elemento as Record<string, unknown>)
          : String(elemento),
      )
      .join(' · ');
  }
  if (typeof valor === 'object') return JSON.stringify(valor);
  const texto = String(valor);
  if (CAMPOS_EN_PESOS.has(campo)) return formatearPesos(texto);
  if (campo === 'porcentajeMensual') return `${texto} %`;
  if (ES_FECHA_HORA.test(texto)) {
    return texto.endsWith('T00:00:00.000Z')
      ? FORMATO_FECHA_CALENDARIO.format(new Date(texto))
      : formatearFechaHora(texto);
  }
  return texto;
}

// ── Auditoría para Gerencia (15/11/2026): cómo se cuenta cada cambio ─────────────────────────────

/** Iniciales para el círculo del usuario: del email («rf@confluens.test» → «RF»); el Sistema, «SI». */
export function inicialesDe(email: string | null | undefined): string {
  if (!email) return 'SI';
  const nombre = email.split('@')[0] ?? '';
  const partes = nombre.split(/[._-]+/).filter(Boolean);
  const iniciales = partes.length > 1 ? `${partes[0]![0]}${partes[1]![0]}` : nombre.slice(0, 2);
  return iniciales.toUpperCase();
}

/** «Presupuesto #65», «Pago #7», «Incremento de precios». */
export function etiquetaDeRegistro(registro: Pick<RegistroAuditoria, 'entidad' | 'entidadId'>) {
  const nombre = NOMBRES_DE_ENTIDAD[registro.entidad as EntidadAuditada] ?? registro.entidad;
  return registro.entidad === 'ConfiguracionPrecios' ? nombre : `${nombre} #${registro.entidadId}`;
}

const VERBO_DE_ACCION = { alta: 'Creó', modificacion: 'Modificó', baja: 'Dio de baja' } as const;

export const NOMBRE_DE_ACCION = {
  alta: 'Alta',
  modificacion: 'Modificación',
  baja: 'Baja',
} as const;

/**
 * Lo que pasó, en una línea: «Registró un pago», «Anuló un pago», «Pasó a Cancelado», «Cambió
 * Precio y Total». Es el título de cada versión del historial y el resumen de la tabla.
 */
export function resumenDelCambio(
  registro: Pick<RegistroAuditoria, 'entidad' | 'campos' | 'tipo' | 'valorNuevo'>,
): string {
  const nuevo = registro.valorNuevo ?? {};
  if (registro.entidad === 'Pago') {
    if (registro.tipo === 'alta')
      return `Registró un pago de ${formatearValor('monto', nuevo['monto'])}`;
    if (registro.campos.includes('anuladoEn')) return 'Anuló un pago';
  }
  if (registro.tipo === 'alta') {
    const nombre = NOMBRES_DE_ENTIDAD[registro.entidad as EntidadAuditada] ?? registro.entidad;
    return `${VERBO_DE_ACCION.alta} ${nombre.toLowerCase()}`;
  }
  if (registro.campos.length === 1 && registro.campos[0] === 'estado') {
    return `Pasó a ${String(nuevo['estado'])}`;
  }
  if (registro.campos.length === 1 && registro.campos[0] === 'activo') {
    return nuevo['activo'] ? 'Lo reactivó' : 'Lo dio de baja';
  }
  const nombres = registro.campos.map(nombreDeCampo);
  const lista =
    nombres.length <= 2
      ? nombres.join(' y ')
      : `${nombres.slice(0, 2).join(', ')} y ${nombres.length - 2} más`;
  return `Cambió ${lista.charAt(0).toLowerCase()}${lista.slice(1)}`;
}

/** «1 campo modificado», «3 campos modificados» o «Registro creado». */
export function cantidadDeCampos(registro: Pick<RegistroAuditoria, 'campos' | 'tipo'>): string {
  if (registro.tipo === 'alta') return 'Registro creado';
  const n = registro.campos.length;
  return n === 1 ? '1 campo modificado' : `${n} campos modificados`;
}

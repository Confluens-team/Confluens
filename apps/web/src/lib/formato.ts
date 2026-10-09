// Formatos de presentación compartidos por la landing y el cotizador del cliente.

const FORMATO_PESOS = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});

// Los importes viajan como string (Decimal de Prisma, ver esquemaImporte); acá solo se muestran.
export function formatearPesos(importe: number | string): string {
  return FORMATO_PESOS.format(Number(importe));
}

// Una fecha de calendario (YYYY-MM-DD) se arma en hora local: new Date('2026-10-10') la tomaría
// como medianoche UTC y en Argentina se vería como el día anterior.
export function fechaLocal(fecha: string): Date {
  const [anio, mes, dia] = fecha.slice(0, 10).split('-').map(Number);
  return new Date(anio ?? 1970, (mes ?? 1) - 1, dia ?? 1);
}

export function formatearFecha(fecha: Date, conDiaSemana = false): string {
  return fecha.toLocaleDateString('es-AR', {
    weekday: conDiaSemana ? 'long' : undefined,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// Nombre para mostrar de un cliente: el apellido es null en razones sociales y en fichas cargadas
// antes de que el registro lo pidiera aparte.
export function nombreCompleto(persona: { nombre: string; apellido?: string | null }): string {
  return persona.apellido ? `${persona.nombre} ${persona.apellido}` : persona.nombre;
}

// Una fecha de calendario (YYYY-MM-DD) tomada en hora local, como la esperan los inputs date y los
// filtros de la API: toISOString() la pasaría a UTC y en Argentina devolvería el día siguiente.
export function fechaISO(fecha: Date): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

export function hoyISO(): string {
  return fechaISO(new Date());
}

const FORMATO_LISTA = new Intl.ListFormat('es-AR', { style: 'long', type: 'conjunction' });

// Un evento puede ocupar varios salones (ADR 0011): "Auditorio", "Auditorio y Pucará",
// "Auditorio, Pucará y Paraná".
export function nombresDeSalones(salones: { nombre: string }[], siNoHay = 'A definir'): string {
  return salones.length > 0 ? FORMATO_LISTA.format(salones.map((s) => s.nombre)) : siNoHay;
}

// El armado de los salones de un evento: cada salón tiene su distribución (ADR 0011). "Banquete"
// si todos los armados usan la misma, "Auditorio: Banquete · Pucará: Conferencia" si difieren, y
// null si ninguno está armado todavía.
export function armadoDeSalones(
  salones: { nombre: string; distribucion: { nombre: string } | null }[],
): string | null {
  const armados = salones.filter((s) => s.distribucion !== null);
  if (armados.length === 0) return null;
  const nombres = new Set(armados.map((s) => s.distribucion!.nombre));
  if (nombres.size === 1 && armados.length === salones.length) return [...nombres][0]!;
  return armados.map((s) => `${s.nombre}: ${s.distribucion!.nombre}`).join(' · ');
}

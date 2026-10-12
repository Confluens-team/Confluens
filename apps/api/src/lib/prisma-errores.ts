import { Prisma } from '../generated/prisma/client.js';

/**
 * RN-12: detecta una violación de la constraint EXCLUDE `evento_sin_solapamiento`.
 *
 * Verificado empíricamente contra Postgres real (ver plan de HU-15): con Prisma 7.10.0 +
 * @prisma/adapter-pg, la violación llega como PrismaClientKnownRequestError con code 'P2039'
 * (código genérico del driver adapter, no específico de exclusión), y el SQLSTATE real de Postgres
 * (23P01 = exclusion_violation) queda anidado en meta.driverAdapterError.cause.code. Se chequea
 * ese valor anidado en vez de 'P2039' porque 23P01 es el código estable documentado por Postgres
 * para este caso puntual.
 *
 * Vive en lib/ y no en un servicio porque lo necesitan los dos lugares que escriben la franja
 * horaria de un evento: agendar (módulo eventos) y el pago que cruza el 20% (módulo pagos).
 */
export function esViolacionDeSolapamiento(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  const meta = error.meta as { driverAdapterError?: { cause?: { code?: string } } } | undefined;
  return meta?.driverAdapterError?.cause?.code === '23P01';
}

/**
 * RN-12: el mensaje para el usuario cuando la franja choca con otro evento. Con varios salones por
 * evento (ADR 0011) dice en cuál, que es lo que el Responsable de Eventos necesita para resolverlo.
 */
export function mensajeDeSolapamiento(
  solapado: { id: number; salones: { salonId: number; salon: { nombre: string } }[] },
  salonIds: number[],
): string {
  const enComun = solapado.salones
    .filter((s) => salonIds.includes(s.salonId))
    .map((s) => s.salon.nombre);
  if (enComun.length === 1) {
    return `El salón ${enComun[0]} ya está reservado en ese horario por el evento #${solapado.id}`;
  }
  return `Los salones ${enComun.join(', ')} ya están reservados en ese horario por el evento #${solapado.id}`;
}

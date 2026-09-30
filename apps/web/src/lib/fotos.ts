// Fotos tomadas del tarifario que el cliente envía hoy en PDF (docs/negocio/tarifario-2026.md).
// Se sirven desde apps/web/public/fotos.
export const FOTOS = {
  auditorio: '/fotos/auditorio.jpg',
  evento: '/fotos/evento.jpg',
  mesaVinos: '/fotos/mesa-vinos.jpg',
  almuerzo: '/fotos/almuerzo.jpg',
  desayuno: '/fotos/desayuno.jpg',
  emplatado: '/fotos/emplatado.jpg',
  mozo: '/fotos/mozo.jpg',
} as const;

// Foto de ambiente mientras el Administrador del Sistema no cargue la foto propia de cada salón
// (HU-08). Solo la del Auditorio es del salón real; el resto son fotos del hotel del mismo PDF.
const FOTO_POR_SALON: Record<string, string> = {
  Auditorio: FOTOS.auditorio,
  Pucará: FOTOS.evento,
  Bariloche: FOTOS.mesaVinos,
  Iguazú: FOTOS.almuerzo,
  Paraná: FOTOS.desayuno,
};

export function fotoDeSalon(salon: { nombre: string; fotoUrl: string | null }): string {
  return salon.fotoUrl ?? FOTO_POR_SALON[salon.nombre] ?? FOTOS.evento;
}

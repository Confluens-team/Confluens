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

// Las fotos que se suben desde el panel están en Cloudinary (ADR 0009) a hasta 1920 px y en el formato
// del archivo original (a veces PNG de más de 1 MB). Para mostrarlas se le pide a Cloudinary una
// versión del ancho que se va a usar, en el formato y la calidad que mejor convengan a cada navegador
// (WebP o AVIF): pesa varias veces menos y no se nota la diferencia. Cloudinary genera esa versión la
// primera vez y después la sirve desde su CDN. Las URLs que no son de Cloudinary quedan como están.
export function fotoOptimizada(url: string, ancho: number): string {
  const marca = '/image/upload/';
  if (!url.startsWith('https://res.cloudinary.com/') || !url.includes(marca)) return url;
  return url.replace(marca, `${marca}f_auto,q_auto,c_limit,w_${ancho}/`);
}

// `ancho` en píxeles reales de pantalla: el doble del tamaño en CSS para que se vea nítida en
// pantallas de alta densidad.
export function fotoDeSalon(
  salon: { nombre: string; fotoUrl: string | null },
  ancho = 800,
): string {
  if (salon.fotoUrl) return fotoOptimizada(salon.fotoUrl, ancho);
  return FOTO_POR_SALON[salon.nombre] ?? FOTOS.evento;
}

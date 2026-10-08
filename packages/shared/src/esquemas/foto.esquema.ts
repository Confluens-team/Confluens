import { z } from 'zod';

// Fotos de la landing en Cloudinary (ADR 0009). El navegador sube el archivo directo a Cloudinary
// con una firma que arma la API; en la base solo se guarda la URL resultante (`fotoUrl`).

// Carpeta de Cloudinary según de qué es la foto.
export const esquemaDestinoFoto = z.enum(['salones', 'servicios']);
export type DestinoFoto = z.infer<typeof esquemaDestinoFoto>;

// Body de POST /fotos/firma.
export const esquemaPedidoFirma = z.object({ destino: esquemaDestinoFoto });
export type PedidoFirma = z.infer<typeof esquemaPedidoFirma>;

// Lo que el navegador manda a Cloudinary junto con el archivo. La firma cubre carpeta, timestamp y
// transformación: si el navegador cambia cualquiera de los tres, Cloudinary rechaza la subida.
export const esquemaFirmaSubida = z.object({
  cloudName: z.string(),
  apiKey: z.string(),
  timestamp: z.number().int(),
  firma: z.string(),
  carpeta: z.string(),
  transformacion: z.string(),
});
export type FirmaSubida = z.infer<typeof esquemaFirmaSubida>;

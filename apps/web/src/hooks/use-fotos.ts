import type { DestinoFoto, FirmaSubida, RespuestaExito } from '@confluens/shared';
import { useMutation } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api';

// Límite por imagen del plan gratis de Cloudinary.
export const TAMANO_MAXIMO_FOTO = 10 * 1024 * 1024;

// ADR 0009: la foto va del navegador directo a Cloudinary, con la firma que arma la API (el
// secreto nunca llega a la web). Devuelve la URL pública, que es lo único que se guarda en la base.
export function useSubirFoto() {
  return useMutation({
    mutationFn: async ({ archivo, destino }: { archivo: File; destino: DestinoFoto }) => {
      const { data: firma } = await apiFetch<RespuestaExito<FirmaSubida>>('/fotos/firma', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destino }),
      });

      const formulario = new FormData();
      formulario.append('file', archivo);
      formulario.append('api_key', firma.apiKey);
      formulario.append('timestamp', String(firma.timestamp));
      formulario.append('signature', firma.firma);
      formulario.append('folder', firma.carpeta);
      formulario.append('transformation', firma.transformacion);

      const respuesta = await fetch(
        `https://api.cloudinary.com/v1_1/${firma.cloudName}/image/upload`,
        { method: 'POST', body: formulario },
      );
      if (!respuesta.ok) {
        throw new Error('Cloudinary no aceptó la foto. Probá con otra imagen.');
      }
      const { secure_url } = (await respuesta.json()) as { secure_url: string };
      return secure_url;
    },
  });
}

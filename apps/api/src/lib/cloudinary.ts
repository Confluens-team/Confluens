import { createHash } from 'node:crypto';

import type { DestinoFoto, FirmaSubida } from '@confluens/shared';

import { ErrorApi } from './errores.js';

// Fotos de la landing en Cloudinary (ADR 0009), por su API HTTP: igual que con Resend (ADR 0006),
// no hace falta el SDK para firmar una subida y borrar una imagen. Las credenciales se leen de
// process.env y no de config/entorno.ts porque los tests corren sin variables (ADR 0003).

// Todo lo que sube el sistema cuelga de esta carpeta: es lo único que se puede borrar.
const CARPETA_RAIZ = 'confluens';

// Las fotos del celular pueden pesar varios MB: Cloudinary las achica al recibirlas (sin
// agrandar las chicas), así se ocupa menos espacio y la landing carga más rápido.
const TRANSFORMACION_DE_SUBIDA = 'c_limit,w_1920,h_1920';

interface Credenciales {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

export function leerCredenciales(entorno: NodeJS.ProcessEnv = process.env): Credenciales | null {
  const cloudName = entorno['CLOUDINARY_CLOUD_NAME'];
  const apiKey = entorno['CLOUDINARY_API_KEY'];
  const apiSecret = entorno['CLOUDINARY_API_SECRET'];
  if (!cloudName || !apiKey || !apiSecret) return null;
  return { cloudName, apiKey, apiSecret };
}

// Firma de Cloudinary: los parámetros ordenados por nombre, como `clave=valor` unidos por `&`, con
// el secreto pegado al final, en SHA-1 hexadecimal.
export function firmar(parametros: Record<string, string | number>, secreto: string): string {
  const aFirmar = Object.keys(parametros)
    .sort()
    .map((clave) => `${clave}=${parametros[clave]}`)
    .join('&');
  return createHash('sha1')
    .update(aFirmar + secreto)
    .digest('hex');
}

function exigirCredenciales(): Credenciales {
  const credenciales = leerCredenciales();
  if (credenciales) return credenciales;
  if (process.env['NODE_ENV'] === 'production') {
    throw new Error(
      'CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET son obligatorios en producción',
    );
  }
  throw ErrorApi.reglaNegocio(
    'Falta configurar Cloudinary (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET)',
  );
}

// Lo que necesita el navegador para subir una foto directo a Cloudinary sin conocer el secreto.
export function firmaDeSubida(destino: DestinoFoto, ahora: Date = new Date()): FirmaSubida {
  const { cloudName, apiKey, apiSecret } = exigirCredenciales();
  const carpeta = `${CARPETA_RAIZ}/${destino}`;
  const timestamp = Math.floor(ahora.getTime() / 1000);
  return {
    cloudName,
    apiKey,
    timestamp,
    carpeta,
    transformacion: TRANSFORMACION_DE_SUBIDA,
    firma: firmar(
      { folder: carpeta, timestamp, transformation: TRANSFORMACION_DE_SUBIDA },
      apiSecret,
    ),
  };
}

// public_id de una foto que subió el sistema, a partir de su URL
// (https://res.cloudinary.com/<cloud>/image/upload/v123/confluens/salones/abc.jpg →
// confluens/salones/abc). null si la URL es de otra cuenta, de otra carpeta o de otro sitio: esas
// fotos no son nuestras y no se tocan.
export function publicIdDeUrl(url: string, cloudName: string): string | null {
  let direccion: URL;
  try {
    direccion = new URL(url);
  } catch {
    return null;
  }
  if (direccion.hostname !== 'res.cloudinary.com') return null;
  const [cuenta, tipo, entrega, ...resto] = direccion.pathname.split('/').filter(Boolean);
  if (cuenta !== cloudName || tipo !== 'image' || entrega !== 'upload') return null;
  const desde = resto.indexOf(CARPETA_RAIZ);
  if (desde === -1 || desde === resto.length - 1) return null;
  return decodeURIComponent(resto.slice(desde).join('/')).replace(/\.[^./]+$/, '');
}

// Borra de Cloudinary una foto que subió el sistema. Las que no son nuestras se ignoran.
export async function borrarFoto(url: string): Promise<void> {
  const credenciales = leerCredenciales();
  if (!credenciales) return;
  const publicId = publicIdDeUrl(url, credenciales.cloudName);
  if (!publicId) return;

  const timestamp = Math.floor(Date.now() / 1000);
  const cuerpo = new URLSearchParams({
    public_id: publicId,
    timestamp: String(timestamp),
    api_key: credenciales.apiKey,
    signature: firmar({ public_id: publicId, timestamp }, credenciales.apiSecret),
  });
  const respuesta = await fetch(
    `https://api.cloudinary.com/v1_1/${credenciales.cloudName}/image/destroy`,
    { method: 'POST', body: cuerpo },
  );
  if (!respuesta.ok) {
    throw new Error(`Cloudinary respondió ${respuesta.status}: ${await respuesta.text()}`);
  }
}

// Al cambiar o quitar una foto, la anterior se borra (decisión del PO, 07/10/2026). Es lo último
// que pasa y no puede deshacer el cambio ya guardado: si Cloudinary falla, queda una foto huérfana
// y se avisa en la consola.
export async function borrarFotoReemplazada(
  anterior: string | null,
  nueva: string | null | undefined,
  borrar: (url: string) => Promise<void> = borrarFoto,
): Promise<void> {
  if (!anterior || nueva === undefined || anterior === nueva) return;
  try {
    await borrar(anterior);
  } catch (error) {
    console.error('No se pudo borrar la foto anterior en Cloudinary', error);
  }
}

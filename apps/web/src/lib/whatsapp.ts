import { normalizarCelular } from '@confluens/shared';

/**
 * Enlace `wa.me` que abre el chat con el celular del cliente, o null si el teléfono guardado no es
 * un celular válido (por ejemplo, uno cargado antes de que el registro lo exigiera).
 *
 * wa.me pide el número internacional solo con dígitos, sin el +. Se normaliza igual que en el
 * registro para cubrir los teléfonos viejos que no quedaron en E.164.
 */
export function enlaceWhatsApp(telefono: string, mensaje?: string): string | null {
  const celular = normalizarCelular(telefono);
  if (!celular) return null;
  const enlace = `https://wa.me/${celular.slice(1)}`;
  return mensaje ? `${enlace}?text=${encodeURIComponent(mensaje)}` : enlace;
}

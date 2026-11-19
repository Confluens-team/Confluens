import type { RegistroAuditoria } from '@confluens/shared';

// Diseño D (historial dentro de cada registro, 15/11/2026): la auditoría guarda solo lo que cambió
// en cada paso (y todo, en el alta). Para mostrar cómo quedó un registro en una versión se parte
// del alta y se aplican los cambios en orden hasta esa versión.

export interface CampoDeVersion {
  campo: string;
  // El valor antes de esta versión (solo si cambió en ella) y el de después.
  antes: unknown;
  despues: unknown;
  cambio: boolean;
}

export interface Version {
  campos: CampoDeVersion[];
  // false si el alta del registro no está en la auditoría (registros anteriores a ella): se conocen
  // solo los campos que cambiaron desde entonces.
  completo: boolean;
}

const delMismoRegistro = (a: RegistroAuditoria, b: RegistroAuditoria) =>
  a.entidad === b.entidad && a.entidadId === b.entidadId;

const enOrden = (a: RegistroAuditoria, b: RegistroAuditoria) =>
  a.fecha === b.fecha ? a.id - b.id : a.fecha < b.fecha ? -1 : 1;

/**
 * Cómo quedó el registro en la versión `id`: cada campo conocido con su valor, marcando los que
 * cambiaron en ella con su valor anterior. Los que cambiaron van primero.
 */
export function versionDe(registros: RegistroAuditoria[], id: number): Version | null {
  const elegido = registros.find((registro) => registro.id === id);
  if (!elegido) return null;
  const pasos = registros.filter((registro) => delMismoRegistro(registro, elegido)).sort(enOrden);
  const estado: Record<string, unknown> = {};
  for (const paso of pasos) {
    Object.assign(estado, paso.valorNuevo ?? {});
    if (paso.id === elegido.id) break;
  }
  const campos = Object.keys(estado).map((campo) => {
    const cambio = elegido.campos.includes(campo);
    return {
      campo,
      antes: cambio ? (elegido.valorAnterior?.[campo] ?? null) : estado[campo],
      despues: estado[campo],
      cambio,
    };
  });
  campos.sort((a, b) => Number(b.cambio) - Number(a.cambio));
  return { campos, completo: pasos[0]?.tipo === 'alta' };
}

// Estado de conexión de un usuario del personal, para la luz del listado de Personal. No hay una
// conexión permanente (la sesión es una cookie): «conectado» quiere decir que hizo algo hace poco, con
// la marca de última actividad que anota la API en cada pedido (a lo sumo una vez por minuto).

/** Hasta cuántos minutos sin actividad se considera «en línea» (decisión del PO, 14/11/2026). */
export const MINUTOS_EN_LINEA = 5;

/**
 * - `EnLinea`: hizo algo hace menos de `MINUTOS_EN_LINEA`.
 * - `Ausente`: la sesión sigue abierta, pero hace más que eso que no hace nada.
 * - `SinSesion`: nunca entró, cerró sesión, está dado de baja o pasó el tiempo de la sesión.
 */
export type EstadoDeConexion = 'EnLinea' | 'Ausente' | 'SinSesion';

export function estadoDeConexion({
  ultimaActividad,
  activo,
  ahora,
  minutosDeSesion,
}: {
  ultimaActividad: Date | null;
  activo: boolean;
  ahora: Date;
  /** Cuánto dura la sesión sin actividad: pasado ese tiempo la cookie ya no sirve. */
  minutosDeSesion: number;
}): EstadoDeConexion {
  if (!activo || ultimaActividad === null) return 'SinSesion';
  const minutos = (ahora.getTime() - ultimaActividad.getTime()) / 60_000;
  if (minutos >= minutosDeSesion) return 'SinSesion';
  return minutos < MINUTOS_EN_LINEA ? 'EnLinea' : 'Ausente';
}

import type { ActualizarConfiguracionPrecios, ConfiguracionPrecios } from '@confluens/shared';

import * as repositorioReal from './configuracion-precios.repositorio.js';
import type { ConfiguracionPreciosRepositorio } from './configuracion-precios.repositorio.js';

type Fila = NonNullable<Awaited<ReturnType<ConfiguracionPreciosRepositorio['obtener']>>>;

function mapear(fila: Fila): ConfiguracionPrecios {
  return {
    porcentajeMensual: fila.porcentajeMensual.toFixed(2),
    actualizadoEn: fila.actualizadoEn.toISOString(),
  };
}

// Sin fila (una base armada a mano), el porcentaje es 0: no se proyecta nada (RN-13).
export async function obtenerConfiguracion(
  repo: ConfiguracionPreciosRepositorio = repositorioReal,
): Promise<ConfiguracionPrecios> {
  const fila = await repo.obtener();
  return fila
    ? mapear(fila)
    : { porcentajeMensual: '0.00', actualizadoEn: new Date(0).toISOString() };
}

// RN-10: el Responsable de Eventos cambia el porcentaje en cualquier momento. Los presupuestos ya
// emitidos no cambian: tienen sus precios congelados (RN-03).
export async function guardarConfiguracion(
  datos: ActualizarConfiguracionPrecios,
  repo: ConfiguracionPreciosRepositorio = repositorioReal,
): Promise<ConfiguracionPrecios> {
  return mapear(await repo.guardar(datos.porcentajeMensual));
}

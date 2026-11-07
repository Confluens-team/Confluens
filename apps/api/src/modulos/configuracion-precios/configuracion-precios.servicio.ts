import type { ActualizarConfiguracionPrecios, ConfiguracionPrecios } from '@confluens/shared';

import { recalcularEstimadosEnConsulta } from '../presupuestos/presupuestos.servicio.js';
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

// RN-10: el Responsable de Eventos cambia el porcentaje en cualquier momento. HU-54: en la misma
// transacción se recalculan los presupuestos Estimado de eventos EnConsulta con el porcentaje
// nuevo, sin reiniciar su vigencia. Los Confirmado quedan congelados y los Expirado esperan a que
// se les cambie la fecha (dominio.md, «Recálculo automático»).
export async function guardarConfiguracion(
  datos: ActualizarConfiguracionPrecios,
  repo: ConfiguracionPreciosRepositorio = repositorioReal,
  recalcular: typeof recalcularEstimadosEnConsulta = recalcularEstimadosEnConsulta,
): Promise<ConfiguracionPrecios> {
  return repo.enTransaccion(async (tx) => {
    const fila = await repo.guardar(datos.porcentajeMensual, tx);
    await recalcular(datos.porcentajeMensual, tx);
    return mapear(fila);
  });
}

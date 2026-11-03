import type { ConsultaDetallada } from '@confluens/shared';

type Linea = ConsultaDetallada['lineas'][number];

// Primero las que tienen hora, en orden; las que no, al final y en el orden en que se cargaron.
// Mezclarlas haría parecer que un servicio sin hora va a las 00:00. El orden de carga es el de la
// API (por id) y se conserva porque sort no reordena los empates.
function porHora(lineas: Linea[]): Linea[] {
  return [...lineas].sort((a, b) => {
    if (!a.horaEstimada && !b.horaEstimada) return 0;
    if (!a.horaEstimada) return 1;
    if (!b.horaEstimada) return -1;
    return a.horaEstimada.localeCompare(b.horaEstimada);
  });
}

/**
 * Qué va a la comanda de cocina (HU-29). En la tabla de gastronomía, las líneas de servicio del
 * catálogo que no son tercerizadas, ordenadas por hora. Quedan afuera la línea del salón (su
 * horario ya está en el encabezado) y los tercerizados, que son audiovisual y pantallas, no
 * cocina. Los adicionales escritos a mano van aparte, al pie y en el orden en que se cargaron:
 * pueden ser de cocina («torta de cumpleaños») o no («decoración»), y dejarlos afuera sería peor
 * que mostrarlos.
 */
export function lineasDeComanda(lineas: ConsultaDetallada['lineas']): {
  gastronomia: Linea[];
  aMano: Linea[];
} {
  return {
    gastronomia: porHora(lineas.filter((l) => l.tipo === 'servicio' && !l.tercerizado)),
    aMano: lineas.filter((l) => l.tipo === 'adicional'),
  };
}

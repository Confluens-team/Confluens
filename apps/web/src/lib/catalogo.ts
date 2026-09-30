const SIN_CATEGORIA = 'Otros servicios';

// Orden en que el tarifario del cliente presenta la carta (docs/negocio/tarifario-2026.md). Las
// categorías que no estén acá van al final, en el orden en que llegan.
const ORDEN_TARIFARIO = [
  'Coffee breaks',
  'Desayunos',
  'Degustación',
  'Lunch y cocktail',
  'Almuerzo y cena',
];

function posicion(categoria: string) {
  const indice = ORDEN_TARIFARIO.indexOf(categoria);
  return indice === -1 ? ORDEN_TARIFARIO.length : indice;
}

// Agrupa servicios por categoría, con las categorías en el orden del tarifario y los servicios de
// cada una en el orden en que vienen del endpoint. Lo usan la landing (sin precios) y el cotizador
// (con precios).
export function agruparPorCategoria<T extends { categoria: string | null }>(
  servicios: T[],
): [string, T[]][] {
  const grupos = new Map<string, T[]>();
  for (const servicio of servicios) {
    const categoria = servicio.categoria ?? SIN_CATEGORIA;
    const grupo = grupos.get(categoria);
    if (grupo) {
      grupo.push(servicio);
    } else {
      grupos.set(categoria, [servicio]);
    }
  }
  return [...grupos].sort(([a], [b]) => posicion(a) - posicion(b));
}

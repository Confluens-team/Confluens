// HU-54 del backlog, parte de la fecha (reunión 05/11/2026, «Recálculo automático» en dominio.md):
// cuando el personal cambia la fecha del evento, el presupuesto se recalcula solo con los precios
// de la fecha nueva, proyectados con el incremento mensual (RN-13). No hay que tocar ningún botón.
//
// - Se recalculan el salón y los servicios propios del catálogo: toman el precio vigente del
//   catálogo proyectado a la fecha nueva. Los ajustes a mano (RN-03) de esas líneas se pierden: el
//   aviso de la pantalla lo dice y se pueden volver a hacer.
// - No cambian los tercerizados (no reciben el incremento, RN-10), los que siguen a cotizar en el
//   catálogo ni los adicionales escritos a mano.
// - Si se vuelve a la fecha original, cada línea que ya estaba recupera su precio guardado.
//
// Funciones puras: la pantalla les pasa cómo proyectar y de dónde sale el precio del catálogo.

export interface SalonConPrecio {
  salonId: number;
  precio: string;
}

export interface LineaConPrecio {
  clave: string;
  servicioId: number | null;
  descripcion: string;
  precio: string;
  tercerizado: boolean;
}

export interface FuentesDePrecio {
  // El precio guardado de lo que ya estaba en el presupuesto: por salón y por clave de línea.
  // Vacíos si ya no hay a qué volver (un Expirado que se recalculó con los vigentes).
  originalesSalon: Map<number, string>;
  originalesLinea: Map<string, string>;
  fechaOriginal: string;
  jornadaOriginalCoincide: boolean;
  // Precio del catálogo, sin proyectar. null si no hay (el salón no existe o el servicio está a
  // cotizar): esa línea no se toca.
  precioSalonCatalogo: (salonId: number) => string | null;
  precioServicioCatalogo: (servicioId: number) => string | null;
  proyectar: (precio: string, fecha: string) => string;
}

export function preciosParaFecha<S extends SalonConPrecio, L extends LineaConPrecio>(
  fecha: string,
  salones: S[],
  lineas: L[],
  fuentes: FuentesDePrecio,
): { salones: S[]; lineas: L[] } {
  const enFechaOriginal = fecha === fuentes.fechaOriginal;
  return {
    salones: salones.map((salon) => {
      const original = fuentes.originalesSalon.get(salon.salonId);
      if (enFechaOriginal && fuentes.jornadaOriginalCoincide && original !== undefined) {
        return { ...salon, precio: original };
      }
      const catalogo = fuentes.precioSalonCatalogo(salon.salonId);
      return catalogo === null ? salon : { ...salon, precio: fuentes.proyectar(catalogo, fecha) };
    }),
    lineas: lineas.map((linea) => {
      if (linea.servicioId === null || linea.tercerizado) return linea;
      const original = fuentes.originalesLinea.get(linea.clave);
      if (enFechaOriginal && original !== undefined) return { ...linea, precio: original };
      const catalogo = fuentes.precioServicioCatalogo(linea.servicioId);
      return catalogo === null ? linea : { ...linea, precio: fuentes.proyectar(catalogo, fecha) };
    }),
  };
}

export interface CambioDePrecio {
  clave: string;
  descripcion: string;
  antes: string;
  ahora: string;
}

// Las líneas que ya estaban en el presupuesto y cuyo precio unitario quedó distinto del guardado.
export function cambiosDePrecio(
  salones: SalonConPrecio[],
  lineas: LineaConPrecio[],
  originalesSalon: Map<number, string>,
  originalesLinea: Map<string, string>,
  nombreSalon: (salonId: number) => string,
): CambioDePrecio[] {
  const distinto = (antes: string | undefined, ahora: string) =>
    antes !== undefined && ahora !== '' && Number(antes) !== Number(ahora);
  return [
    ...salones
      .filter((s) => distinto(originalesSalon.get(s.salonId), s.precio))
      .map((s) => ({
        clave: `salon-${s.salonId}`,
        descripcion: `Salón ${nombreSalon(s.salonId)}`,
        antes: originalesSalon.get(s.salonId)!,
        ahora: s.precio,
      })),
    ...lineas
      .filter((l) => distinto(originalesLinea.get(l.clave), l.precio))
      .map((l) => ({
        clave: l.clave,
        descripcion: l.descripcion,
        antes: originalesLinea.get(l.clave)!,
        ahora: l.precio,
      })),
  ];
}

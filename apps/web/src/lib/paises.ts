import { type CodigoPais, PAISES_TELEFONICOS } from '@confluens/shared';

export interface OpcionPais {
  pais: CodigoPais;
  nombre: string;
  prefijo: string;
  bandera: string;
}

// Bandera como emoji: cada letra del código ISO pasa a su "regional indicator symbol".
function bandera(pais: string): string {
  return String.fromCodePoint(...[...pais].map((letra) => 0x1f1e6 + letra.charCodeAt(0) - 65));
}

// Nombres en español desde el navegador, para no mantener una lista propia de países.
const nombres = new Intl.DisplayNames(['es'], { type: 'region' });

// Opciones del selector de país del celular, ordenadas por nombre.
export const OPCIONES_PAIS: OpcionPais[] = PAISES_TELEFONICOS.map(({ pais, prefijo }) => ({
  pais,
  prefijo,
  nombre: nombres.of(pais) ?? pais,
  bandera: bandera(pais),
})).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

import {
  type CountryCode,
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
} from 'libphonenumber-js/mobile';
import { z } from 'zod';

// El teléfono del cliente es el canal de contacto principal: el Responsable de Eventos le escribe
// por WhatsApp (wa.me), así que tiene que ser un celular y quedar guardado en formato
// internacional E.164 (+5493516123456), que es lo que wa.me necesita. Verificar que el número
// exista (código por SMS o WhatsApp) queda para una iteración futura con un proveedor.
//
// Se usan los metadatos "mobile" de libphonenumber-js: con ellos isValid() solo acepta celulares.
// Sin código de país se asume Argentina.

const CARACTERES_DE_TELEFONO = /^[+\d\s().-]+$/;

// País en ISO 3166-1 alfa-2 ('AR', 'UY'...), el que elige el cliente en el selector del registro.
export type CodigoPais = CountryCode;
export const PAIS_POR_DEFECTO: CodigoPais = 'AR';

// Países con su código telefónico internacional, para el selector del formulario. Los nombres no
// van acá: la web los toma del navegador (Intl.DisplayNames) en el idioma del cliente.
export const PAISES_TELEFONICOS: { pais: CodigoPais; prefijo: string }[] = getCountries().map(
  (pais) => ({ pais, prefijo: getCountryCallingCode(pais) }),
);

/**
 * Devuelve el celular en E.164 o null si no es un celular válido.
 *
 * `pais` es el del selector: el cliente escribe solo el número nacional (3516167991) y el código
 * del país lo pone el sistema. Si el texto empieza con +, manda el código que trae.
 *
 * Un número argentino escrito sin el 15 ni el 9 (351 6123456) no distingue un fijo de un celular;
 * por decisión de producto se toma como celular y se le agrega el 9 de los móviles.
 */
export function normalizarCelular(
  texto: string,
  pais: CodigoPais = PAIS_POR_DEFECTO,
): string | null {
  if (!CARACTERES_DE_TELEFONO.test(texto)) return null;

  const numero = parsePhoneNumberFromString(texto, pais);
  if (!numero) return null;
  if (numero.isValid()) return numero.number;

  if (numero.countryCallingCode === '54' && !numero.nationalNumber.startsWith('9')) {
    const comoCelular = parsePhoneNumberFromString(`+549${numero.nationalNumber}`);
    if (comoCelular?.isValid()) return comoCelular.number;
  }
  return null;
}

// Mensaje de cara al público: lo ve quien se registra en la landing.
export const esquemaCelular = z
  .string()
  .trim()
  // abort: con el campo vacío alcanza con ese error; sin él, también saldría el de formato.
  .min(1, { error: 'Ingresá tu celular', abort: true })
  .refine((texto) => normalizarCelular(texto) !== null, {
    error: 'Ingresá un celular válido para el país elegido',
  })
  .overwrite((texto) => normalizarCelular(texto) ?? texto);

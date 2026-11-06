/**
 * Lo que se deja tipear en un campo de importe (`InputImporte`): dígitos y un solo punto decimal,
 * con hasta dos decimales, que es lo que acepta `esquemaImporte`. La coma pasa a punto, porque es
 * el separador que se usa en Argentina. Todo lo demás (letras, signos, espacios) se descarta al
 * tipear o al pegar (reunión con el cliente, 05/11/2026).
 */
export function limpiarImporte(texto: string): string {
  const soloValidos = texto.replace(/,/g, '.').replace(/[^\d.]/g, '');
  const punto = soloValidos.indexOf('.');
  if (punto === -1) return soloValidos;
  const decimales = soloValidos.slice(punto + 1).replace(/\./g, '');
  return `${soloValidos.slice(0, punto)}.${decimales.slice(0, 2)}`;
}

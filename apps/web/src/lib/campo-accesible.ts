/**
 * AC4 de la auditoría de accesibilidad (WCAG 3.3.1 y 4.1.3). Los errores de validación se
 * mostraban como un párrafo al lado del campo: se ven, pero el lector de pantalla no los relaciona
 * con el input ni los anuncia al aparecer, así que quien no ve la pantalla no se entera de qué
 * campo quedó mal.
 *
 * `ariaDeCampo` devuelve los atributos que van en el input y `idDeError` el id del párrafo del
 * error, que además lleva role="alert" para que se anuncie en el momento.
 *
 * Se usa con el mismo id que ya tiene el input y su <Label htmlFor>:
 *
 *   <Input id="reg-email" {...ariaDeCampo('reg-email', errors.email?.message)} />
 *   {errors.email && <p id={idDeError('reg-email')} role="alert">{errors.email.message}</p>}
 */
export function idDeError(id: string): string {
  return `${id}-error`;
}

export function ariaDeCampo(
  id: string,
  error: string | undefined,
  // Algunos campos ya describen con un texto de ayuda (el formato del celular, por ejemplo): se
  // mantiene y el error se suma, en ese orden, que es el que lee el lector de pantalla.
  idAyuda?: string,
): { 'aria-invalid': boolean; 'aria-describedby': string | undefined } {
  const ids = [idAyuda, error ? idDeError(id) : undefined].filter(Boolean);
  return {
    'aria-invalid': error !== undefined,
    'aria-describedby': ids.length > 0 ? ids.join(' ') : undefined,
  };
}

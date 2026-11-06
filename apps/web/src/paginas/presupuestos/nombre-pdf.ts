/**
 * El nombre que el navegador le propone al PDF del presupuesto formal:
 * `presupuesto-AAAA-MM-DD-apellido`, con la fecha del evento (reunión con el cliente, 05/11/2026).
 * El apellido va en minúsculas, sin tildes y con guiones; sin apellido (una razón social) va el
 * nombre. La extensión la agrega el navegador.
 */
export function nombrePdfPresupuesto(
  fechaEvento: string,
  cliente: { nombre: string; apellido?: string | null },
): string {
  const quien = (cliente.apellido?.trim() || cliente.nombre)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return quien ? `presupuesto-${fechaEvento}-${quien}` : `presupuesto-${fechaEvento}`;
}

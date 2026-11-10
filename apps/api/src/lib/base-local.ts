// Los hosts de una base que corre en la máquina de quien desarrolla: la de docker-compose.yml.
const HOSTS_LOCALES = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * Si la connection string apunta a una base local. Lo usa el seed para decidir si carga los
 * usuarios de prueba: tienen una contraseña escrita en el repo, así que no pueden terminar en una
 * base que no sea la de desarrollo. Una URL ausente o mal formada no es local: ante la duda, no se
 * cargan.
 */
export function esBaseLocal(urlBase: string | undefined): boolean {
  if (!urlBase) return false;
  try {
    return HOSTS_LOCALES.has(new URL(urlBase).hostname);
  } catch {
    return false;
  }
}

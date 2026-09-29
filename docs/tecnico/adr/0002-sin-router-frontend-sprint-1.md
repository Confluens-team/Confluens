# ADR 0002 — Sin router en el frontend (Sprint 1)

**Fecha:** 2026-09  ·  **Estado:** reemplazada por ADR-0005

## Contexto

HU-27 agrega la primera navegación real de la web: antes de iniciar sesión se ve el formulario de
login, después se ve el panel con el menú según el rol. `react-router-dom` no figura en la tabla de
stack de `AGENTS.md` (§2) ni en `arquitectura.md`, así que agregarlo requeriría avisar por §7 antes
de instalarlo. Con una sola bifurcación de pantalla (login vs. panel), todavía no hay URLs
distintas que justifiquen un router: no hay deep-linking, ni un botón "atrás" del navegador que
sea parte de ningún criterio de aceptación del sprint.

## Decisión

`App.tsx` decide qué mostrar con estado de React, no con rutas: mientras `useSesion()` carga, un
spinner; sin sesión, `<IniciarSesion/>`; con sesión, `<Panel/>`. No se instala `react-router-dom` en
este sprint.

## Consecuencias

**A favor.** No suma una dependencia nueva a mitad de un sprint enfocado en el walking skeleton.
La lógica de "qué se ve" es un `if` en vez de configuración de rutas, más simple de leer para dos
pantallas.

**En contra.** No hay URL propia por pantalla: no se puede compartir un link directo al panel ni
usar el botón "atrás" del navegador para volver al login. Esto va a sorprender a quien abra el
código esperando encontrar rutas reales, y hay que revisarlo apenas el panel tenga más de dos o
tres secciones navegables (por ejemplo cuando HU-28, administración de usuarios, y los reportes de
ingresos de GERENTE_GENERAL dejen de ser ítems de menú sin pantalla propia).

**Alternativas descartadas.** `react-router-dom`: se descartó para este sprint porque no está en el
stack aprobado y una sola bifurcación de pantalla no lo justifica todavía; queda pendiente
evaluarlo cuando el panel crezca.

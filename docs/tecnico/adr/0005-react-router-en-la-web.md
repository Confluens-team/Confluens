# ADR 0005 — React Router en la web

**Fecha:** 2026-09  ·  **Estado:** aceptada (reemplaza a la ADR 0002)

## Contexto

La ADR 0002 dejó la navegación de la web en estado de React porque había una sola bifurcación de
pantalla (login o panel). Al cerrar el Sprint 1 eso cambió: hay landing, cotizador y presupuesto
del cliente, login del personal, el panel del resto del personal y el del Administrador del
Sistema con cinco pestañas. Sin URLs no se puede entrar directo al panel del administrador, el
botón "atrás" del navegador sale del sitio y cada pantalla nueva agranda un `if` en `App.tsx`. La
propia ADR 0002 pedía revisar la decisión cuando el panel tuviera varias secciones.

## Decisión

La web usa `react-router` 7.18.4 (modo librería, con `BrowserRouter`). Es la última versión
compatible con el stack: la 8 exige React 19 y Node 22, y el proyecto usa React 18 y Node 20. En
la 7, el paquete `react-router` ya incluye lo que antes era `react-router-dom`.

| Ruta | Pantalla |
|---|---|
| `/` | Landing pública |
| `/cotizar` (`?salon=<id>`) | Cotizador del cliente registrado |
| `/presupuesto` | Presupuesto recién generado (viaja en el `state` de la navegación) |
| `/acceso` | Login del personal |
| `/admin/:pestania` | Panel del Administrador del Sistema: `consultas`, `agenda`, `clientes`, `catalogo`, `cuenta` |
| `/panel` | Panel del resto del personal |

Las rutas deciden solo qué se ve: sin la sesión o el rol que corresponde, redirigen a `/` o a
`/acceso`. Los permisos reales los sigue aplicando la API. `apps/web/vercel.json` reescribe
cualquier ruta a `index.html`, así una URL como `/admin/agenda` funciona al entrar directo o al
recargar.

## Consecuencias

**A favor.** Cada pantalla tiene su URL: se puede compartir un link o guardar un favorito, entrar
directo a `/admin`, y usar el botón "atrás". `App.tsx` pasa de un árbol de `if` a una tabla de
rutas.

**En contra.** Suma una dependencia. El presupuesto recién generado no se vuelve a pedir a la API:
si se recarga `/presupuesto`, se vuelve al cotizador. Dentro de la pestaña Consultas y del panel
del resto del personal, los pasos intermedios (tomar consulta, detalle del evento) siguen en
estado de React; se pueden pasar a rutas cuando haga falta enlazarlos.

**Alternativas descartadas.** Seguir sin router: ya no alcanza, por lo dicho en el contexto.
React Router 8: exige React 19 y Node 22. TanStack Router: suma otra herramienta al stack, y React
Router es el que ya figuraba en la arquitectura del proyecto.

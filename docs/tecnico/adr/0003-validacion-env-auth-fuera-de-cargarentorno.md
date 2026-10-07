# ADR 0003 — Validación de JWT_SECRET y FRONTEND_URL fuera de cargarEntorno()

**Fecha:** 2026-09  ·  **Estado:** aceptada

## Contexto

`config/entorno.ts` (`cargarEntorno()`) es el validador estricto de variables de entorno que hoy
usa únicamente `servidor.ts`: si falta `DATABASE_URL` corta el proceso con `process.exit(1)`.
`apps/api/src/app.test.ts` y `enums.test.ts` corren en CI (`ci.yml`) sin ningún `DATABASE_URL` ni
otra variable de entorno seteada, porque ese workflow no levanta un servicio de Postgres. Si el
módulo de auth de HU-27 importara `cargarEntorno()` en su cadena de imports para leer `JWT_SECRET`
o `FRONTEND_URL`, `crearApp()` (la que usan esos tests) heredaría esa validación estricta y mataría
el proceso de test en CI.

## Decisión

`JWT_SECRET` y `FRONTEND_URL` se leen directamente de `process.env` dentro de `lib/jwt.ts` y
`app.ts`, con un valor por defecto seguro para desarrollo/test. La verificación estricta
(`throw` si falta) solo se aplica cuando `NODE_ENV === 'production'`. `config/entorno.ts` no se
modifica y sigue siendo usado únicamente por `servidor.ts`, el entrypoint real.

## Consecuencias

**A favor.** `apps/api/src/app.test.ts` y el resto de tests sobre `crearApp()` siguen corriendo en
CI sin necesitar Postgres ni variables de entorno completas. En producción, arrancar sin
`JWT_SECRET` sigue fallando de forma explícita.

**En contra.** El repo termina con dos mecanismos distintos de validar configuración: el estricto
de `config/entorno.ts` (usado solo por `servidor.ts`) y lecturas puntuales de `process.env` con
default propio (usadas por `lib/jwt.ts` y `app.ts`). Esto puede sorprender a quien asuma que toda
variable de entorno pasa por `cargarEntorno()`. Si aparecen más módulos con esta misma necesidad,
conviene consolidar el patrón en vez de repetir lecturas sueltas de `process.env`.

**Alternativas descartadas.** Hacer que `cargarEntorno()` tolere la ausencia de variables en
entorno de test: se descartó porque debilitaría la red de seguridad que ese validador da en
producción. Agregar un servicio de Postgres a `ci.yml` para que `DATABASE_URL` siempre exista: se
descartó por estar fuera del alcance de HU-27 y por ser configuración compartida que requiere
avisar antes (§7); queda anotado como aviso para el equipo cuando alguna historia futura necesite
testear contra una base real.

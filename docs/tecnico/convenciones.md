# Convenciones de código

Detalle de cómo se escribe el código. Las reglas de trabajo (ramas, commits, límites entre grupos,
qué no puede hacer un agente) están en `/AGENTS.md`.

## Idioma y nombres

- **Español** en todo el código propio: variables, funciones, tipos, archivos, carpetas, commits.
- **Sin tildes ni ñ** en identificadores y nombres de archivo: `salon`, `sena`, `tamanioPagina`.
- Excepciones: APIs de librerías, nombres impuestos por herramientas (`main.tsx`, `App.tsx`,
  `vite.config.ts`, `index.ts`, `components/ui/` de shadcn), las claves del contrato de respuesta
  (`data`, `meta`, `error`, `code`, `message`, `details`) y los valores de `code`.
- Los nombres de entidades, estados y enums salen **literalmente** de `../producto/dominio.md` y
  `modelo-datos.md`. Los valores de enum respetan mayúsculas: `EnConsulta`, no `EN_CONSULTA`.

| Qué | Forma | Ejemplo |
|---|---|---|
| Carpetas | kebab-case | `modulos/solicitudes/` |
| Archivos TS que no son componentes | kebab-case + sufijo de rol | `eventos.servicio.ts`, `salon.esquema.ts` |
| Componentes React | PascalCase, uno por archivo, export nombrado | `CalendarioSalones.tsx` |
| Hooks | `use-nombre.ts` exporta `useNombre` | `use-salones.ts` |
| Variables y funciones | camelCase | `calcularSena` |
| Tipos, clases, componentes | PascalCase | `Presupuesto` |
| Constantes globales inmutables | UPPER_SNAKE_CASE | `CODIGOS_ERROR` |
| Rutas HTTP | kebab-case, plural, en español | `/api/solicitudes/:id` |

**Imports.** En `apps/api` y `packages/shared` los relativos llevan extensión `.js`
(`import { x } from './x.js'`), como exige NodeNext. En `apps/web` se usa el alias `@/` para
`src/`. Los imports de solo tipos usan `import type` (lo exige ESLint).

## Módulos de la API

Un módulo por área del dominio en `apps/api/src/modulos/<modulo>/` (ver `arquitectura.md`):

| Archivo | Responsabilidad |
|---|---|
| `<modulo>.rutas.ts` | `Router` de Express, middleware `validar()` y registro en OpenAPI |
| `<modulo>.controlador.ts` | Lee `req`, llama al servicio y arma la respuesta. Sin lógica de negocio. |
| `<modulo>.servicio.ts` | Reglas RN-xx. Lanza `ErrorApi` ante reglas incumplidas. No conoce `req`/`res`. |
| `<modulo>.repositorio.ts` | Acceso a datos con Prisma (`src/lib/prisma.ts`) |
| `*.test.ts` | Tests al lado del archivo que prueban |

- Los handlers async se envuelven con `asincrono()` (`src/lib/asincrono.ts`): Express 4 no captura
  errores de promesas.
- Los errores esperados se lanzan con `ErrorApi` (`src/lib/errores.ts`). Nunca armar
  `res.status(4xx).json(...)` a mano: `manejadorErrores` es el único que escribe errores.
- Todo endpoint se registra en OpenAPI (`registroOpenApi.registerPath`) con los schemas de `shared`.
- Los tipos de Prisma **no** llegan a la web: la API mapea a los tipos de `shared`.

## Schemas compartidos (`packages/shared`)

- Un archivo por entidad en `src/esquemas/<entidad>.esquema.ts`, re-exportado desde `index.ts`.
- Schema `esquemaEntidad` y tipo derivado `type Entidad = z.infer<typeof esquemaEntidad>`. Los de
  entrada siguen la misma forma: `esquemaCrearEvento` / `CrearEvento`.
- Importes: `esquemaImporte`, string con hasta 2 decimales (el `Decimal` de Prisma serializado).
  Fechas con hora: ISO 8601 UTC. Fechas de calendario: `YYYY-MM-DD`.
- En la web se usan con `zodResolver`; en la API con `validar({ body, query, params })`.
- Solo TypeScript y Zod: no importa Express, Prisma, React ni nada de `apps/`.

## Comandos

Desde la raíz:

| Comando | Qué hace |
|---|---|
| `npm run dev` | shared (watch), API en http://localhost:3000 (docs en `/api/docs`, genera antes el cliente de Prisma) y web en http://localhost:5173 |
| `npm run build` / `typecheck` / `lint` / `test` | Corren en todos los workspaces |
| `npm run format` / `format:check` | Prettier |
| `npm run db:up` / `db:down` | Levanta o baja PostgreSQL local (Docker) |
| `npm run prisma:migrate -w @confluens/api` | Crea y aplica una migración en local (`prisma migrate dev`) |
| `npm run prisma:deploy -w @confluens/api` | Aplica migraciones pendientes (CI y producción) |
| `npm run prisma:seed -w @confluens/api` | Carga salones, distribuciones y servicios del tarifario |
| `npm run <script> -w @confluens/<workspace>` | Corre un script en un solo workspace |

Si el typecheck de API o web no ve un cambio de `shared`, correr `npm run build -w @confluens/shared`.

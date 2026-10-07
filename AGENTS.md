# AGENTS.md

Confluens: gestión de eventos para Los Abuelos Servicios Gastronómicos. Este archivo lo leen
siempre todos los agentes (Claude Code, Codex) y las personas del equipo. Es corto a propósito:
el detalle está en `docs/`. Si algo no está escrito, **preguntar antes de decidir**; si la tarea
contradice este archivo o `docs/`, avisar el conflicto en vez de elegir en silencio.

## 1. Protocolo de contexto

Antes de implementar cualquier historia:

1. Leer `docs/README.md`.
2. Abrir **solo** los archivos que la tarea necesita, según la tabla de ese README. No leer
   `docs/` entero.
3. Si la tarea depende de algo listado en `docs/producto/pendientes.md`, parar y preguntar.

Nombres de entidades, estados y enums: literales de `docs/producto/dominio.md` y
`docs/tecnico/modelo-datos.md`. Convenciones de código: `docs/tecnico/convenciones.md`.

## 2. Stack y estructura

Versiones fijas, sin `^` ni `~` (`.npmrc` tiene `save-exact=true`). Capas y límites entre
workspaces en `docs/tecnico/arquitectura.md`.

| Área                  | Versiones                                                                                                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime               | Node 20 LTS (≥ 20.19, `.nvmrc`), npm workspaces, typescript 5.9.3                                                                                                         |
| Backend               | express 4.22.3, zod 4.6.4, @asteasolutions/zod-to-openapi 9.1.0, swagger-ui-express 5.0.1, tsx 4.23.13, bcrypt 6.0.0, jsonwebtoken 9.0.3, cookie-parser 1.4.7, cors 2.8.6 |
| Base de datos         | PostgreSQL 16 (`postgres:16.15-alpine` local, Neon en la nube) + `btree_gist`; prisma, @prisma/client y @prisma/adapter-pg 7.10.0                                         |
| Frontend              | react y react-dom 18.3.1, react-router 7.18.4, vite 7.3.6, @vitejs/plugin-react 5.2.0, tailwindcss y @tailwindcss/vite 4.3.3, shadcn 4.21.0, radix-ui 1.6.7               |
| Datos en la web       | @tanstack/react-query 5.102.8, react-hook-form 7.88.0, @hookform/resolvers 5.9.1                                                                                          |
| Calendario y gráficos | @fullcalendar/* 6.1.21, recharts 3.10.1                                                                                                                                   |
| Tests                 | vitest 4.1.11, supertest 7.2.2                                                                                                                                            |
| Calidad               | eslint 9.39.5, typescript-eslint 8.70.0, prettier 3.9.6, husky 9.1.7, lint-staged 16.4.0, @commitlint/cli y config-conventional 20.5.3                                    |

Figura en `arquitectura.md` pero todavía no está instalado: React Testing Library. Lo agrega la
primera historia que lo necesite, avisando (§6). En el Sprint 1 ya se agregaron bcrypt, jsonwebtoken,
cookie-parser y cors (HU-27), node-cron (vencimiento de señas) y react-router (ADR 0005).

```
apps/api/          API REST. Único workspace con acceso a la base.
  prisma/          schema.prisma, migrations/, seed.ts
  src/modulos/     Un módulo por área: <modulo>.rutas|controlador|servicio|repositorio.ts
apps/web/          SPA React. Nunca importa de apps/api.
  src/paginas/     Una carpeta por pantalla
packages/shared/   Schemas de Zod y tipos derivados. No importa nada de apps/.
docs/              Fuente de verdad del dominio y del producto.
```

## 3. Ramas y commits

- Una rama por historia, desde `develop`: `feat/HU-XX-descripcion` (kebab-case, sin tildes).
  Tareas sin historia: `chore/descripcion` o `docs/descripcion`.
- Commits en Conventional Commits, validados por commitlint, con la HU como scope:
  `feat(HU-32): agrega alta de servicios`. Tipos: `feat`, `fix`, `refactor`, `test`, `docs`,
  `chore`, `ci`, `build`, `perf`, `style`. Descripción en español, minúscula, presente, sin punto
  final. Un cambio lógico por commit.
- Se integra a `develop` solo por pull request, con la plantilla, CI en verde y revisión de otro
  integrante. Nunca push directo a `develop`, `--force` ni `--no-verify`.
- `main` es la rama de release: recibe solo merges de `develop`, por decisión del equipo. Ninguna
  rama de historia apunta a `main`.

## 4. Formato de respuesta de la API

Tipos en `packages/shared/src/api/respuesta.ts`. Éxito: `200`, `201` o `204`.

```json
{ "data": {} }
{ "data": [], "meta": { "page": 1, "pageSize": 20, "total": 134 } }
```

Error: siempre por `ErrorApi` y el middleware `manejadorErrores`, nunca a mano.

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Los datos enviados no son válidos",
    "details": [{ "campo": "fechaDeseada", "mensaje": "Fecha inválida" }]
  }
}
```

| Status | `code`                    | Cuándo                                                            |
| ------ | ------------------------- | ----------------------------------------------------------------- |
| 400    | `VALIDATION_ERROR`        | No pasa el schema de Zod o el JSON está malformado                |
| 401    | `UNAUTHENTICATED`         | Falta sesión o es inválida                                        |
| 403    | `FORBIDDEN`               | Autenticado pero sin permiso para su rol                          |
| 404    | `NOT_FOUND`               | El recurso o la ruta no existen                                   |
| 409    | `CONFLICT`                | Choca con el estado actual (por ejemplo, solapamiento de eventos) |
| 422    | `BUSINESS_RULE_VIOLATION` | Datos válidos que violan una regla RN-xx                          |
| 429    | `RATE_LIMITED`            | Se pasó el límite de peticiones de la ruta                        |
| 500    | `INTERNAL_ERROR`          | Error no previsto. Nunca expone detalles internos.                |

`message` va en español y se puede mostrar al usuario; `code` es estable y la web decide con él.

## 5. Qué se testea

- **Sí:** lógica de negocio y reglas RN-xx (cálculo de presupuesto y seña, solapamiento,
  transiciones de estado, plazos), funciones puras de los servicios y endpoints con lógica
  (status, formato de error, permisos por rol).
- **No:** CRUD simple sin reglas, componentes de presentación, código generado ni configuración.

Vitest en todos los workspaces, Supertest sobre `crearApp()`. Tests `*.test.ts` al lado del código.

## 6. Qué no puede hacer un agente sin avisar

Detenerse, explicar qué quiere cambiar y por qué, y esperar confirmación antes de:

- Modificar `apps/api/prisma/schema.prisma` o crear, editar o borrar migraciones.
- Instalar, actualizar o desinstalar dependencias.
- Tocar configuración compartida: ESLint, TypeScript (`tsconfig*.json`), Prettier, commitlint,
  Husky, lint-staged, CI (`.github/`), `docker-compose.yml`, `prisma.config.ts` o `packages/shared`.
- Cambiar cualquier valor de enum o regla de negocio de `docs/producto/dominio.md`.

Nunca: tocar la carpeta `.claude/`, commitear `.env` o credenciales, editar
`apps/api/src/generated/` o una migración ya aplicada, ni desactivar reglas de ESLint o TypeScript
sin explicarlo en el PR.

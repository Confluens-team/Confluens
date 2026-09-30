# Arquitectura

Monorepo con npm workspaces. Docker solo para la base de datos local.

```
confluens/
├── apps/
│   ├── api/          Node 20 + Express 4 + TypeScript + Prisma
│   └── web/          React 18 + TypeScript + Vite
├── packages/
│   └── shared/       Tipos y schemas de Zod compartidos entre api y web
└── docs/
```

## Límites entre workspaces

`packages/shared` **no importa nada** de `apps/`. Es la única dependencia común y contiene los
schemas de Zod que validan tanto en el cliente como en el servidor, más los tipos derivados de
ellos. Si un tipo lo usan los dos lados, vive acá; si lo usa uno solo, vive en ese workspace.

`apps/web` nunca importa de `apps/api`, ni al revés. El contrato entre ambos es HTTP más los
tipos de `shared`.

## Capas en `apps/api`

Cada módulo del dominio vive en su carpeta, `src/modulos/<modulo>/` (plural, kebab-case), con un
archivo por capa:

```
<modulo>.rutas.ts        → definición de endpoints y middleware
<modulo>.controlador.ts  → parseo del request, llamada al servicio, forma de la respuesta
<modulo>.servicio.ts     → lógica de negocio. Es donde viven las reglas RN-xx.
<modulo>.repositorio.ts  → acceso a datos vía Prisma
```

Regla: los controllers no consultan Prisma directamente y los services no conocen `req` ni `res`.
La lógica de negocio tiene que poder testearse sin levantar el servidor.

La carpeta por módulo es también el límite de trabajo entre grupos: cada grupo edita solo sus
módulos (ver `AGENTS.md`).

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 18, Vite, Tailwind, shadcn/ui, TanStack Query, React Hook Form + Zod, FullCalendar, Recharts |
| Backend | Node 20 LTS, Express 4, TypeScript, Prisma, OpenAPI/Swagger |
| Base de datos | PostgreSQL 16 (Neon en la nube, Docker en local) |
| Tests | Vitest, Supertest, React Testing Library |
| CI/CD | GitHub Actions |
| Deploy | Vercel (web), Render (api), Neon (base) |

Las versiones se fijan sin `^` ni `~` en los `package.json`, para que los tres entornos de
desarrollo instalen exactamente lo mismo.

## Autenticación

JWT en cookie httpOnly, contraseñas con hash bcrypt. El middleware de autorización valida el rol
contra el enum definido en `dominio.md`. El rol `CLIENTE` existe en el enum desde el Sprint 1
aunque se active en el Sprint 2.

## Tareas programadas

`node-cron` en el proceso del backend, para dos tareas:

- **Expiración de presupuestos** (RN-08): pasa a `Expirado` los `Estimado` con `venceEn` vencido.
  No cancela eventos ni borra nada.
- **Incremento mensual de precios** (RN-10): aplica `porcentajeMensual` a los servicios propios y
  a los salones, y registra un `AjustePrecio`. No toca tercerizados ni presupuestos emitidos.

**No existe** una tarea de cancelación automática por falta de seña (se eliminó en la entrevista
del 24/09/2026). Requiere que el proceso se mantenga
activo: verificar el plan de Render antes de depender de esto en producción.

## Correo saliente

El canal público envía un correo al cliente cuando confirma una consulta. El proveedor todavía no
está elegido (`../producto/pendientes.md`, S-11): se decide en una ADR antes de implementarlo, y
la clave va en variables de entorno validadas como el resto.

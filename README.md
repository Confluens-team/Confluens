# Confluens

Sistema Integral de Gestión de Eventos para Los Abuelos Servicios Gastronómicos SRL (Hotel Dr. César Carman). Centraliza el ciclo completo del evento —consulta, presupuesto, prereserva, confirmación, comanda de cocina y cobro. Incluye landing pública con los salones y acceso directo a la reserva. Proyecto de tesis, Analista en Sistemas (UTN).

## Levantar el proyecto

Requisitos: Node 20.19 o superior (`nvm use` toma la versión de `.nvmrc`) y Docker.

```bash
git clone https://github.com/Confluens-team/Confluens.git && cd Confluens
cp .env.example .env
npm install
npm run db:up && npm run prisma:deploy -w @confluens/api
npm run prisma:seed -w @confluens/api
npm run dev
```

- Web: http://localhost:5173
- API: http://localhost:3000/api/salud
- Documentación de la API (Swagger): http://localhost:3000/api/docs

## Despliegue

Tres servicios, todos en capa gratuita: **Neon** (PostgreSQL), **Render** (API) y **Vercel** (web).
El `.env` de la raíz sigue apuntando a la base de Docker para desarrollar en local: las credenciales
de la nube **no** se escriben ahí, se cargan en los paneles de Render y Vercel.

### 1. Neon

Crear el proyecto (PostgreSQL 16, región `sa-east-1`) y copiar las dos connection strings que da el
panel. Son distintas y ambas hacen falta:

| Variable       | Cuál copiar                                   | Para qué                      |
| -------------- | --------------------------------------------- | ----------------------------- |
| `DATABASE_URL` | la **pooled** (el host incluye `-pooler`)     | la API en runtime             |
| `DIRECT_URL`   | la **directa** (el host no incluye `-pooler`) | migraciones del CLI de Prisma |

No hace falta habilitar `btree_gist` a mano: lo hace la migración
`20260913000000_habilitar_btree_gist`.

Para aplicar el esquema y los datos iniciales contra Neon desde la máquina local, sin tocar el
`.env` de Docker (una variable del shell tiene precedencia sobre el `.env`):

```bash
DIRECT_URL="<la-directa-de-neon>" npm run prisma:deploy -w @confluens/api
DIRECT_URL="<la-directa-de-neon>" npm run prisma:seed -w @confluens/api
```

### 2. Render (API)

`render.yaml` ya define el servicio: build del monorepo, `prisma migrate deploy`, health check en
`/api/salud` y `JWT_SECRET` generado por Render. En Render: **New → Blueprint** y elegir el repo.

Solo pide tres variables a mano: `DATABASE_URL`, `DIRECT_URL` y `FRONTEND_URL` (la URL de Vercel del
paso 3, sin barra final).

> El plan free suspende el servicio tras 15 minutos de inactividad y el primer request después
> tarda cerca de un minuto. Conviene despertar la API antes de una demostración.

### 3. Vercel (web)

`vercel.json` ya define el build y el rewrite a `index.html` que necesita react-router. Importar el
repo en Vercel y agregar una sola variable:

- `VITE_API_URL` = la URL del servicio de Render, **sin** `/api` al final.

Vite incorpora las variables `VITE_*` en el bundle **durante el build**, así que hay que cargarla
antes del primer deploy; si se cambia después, hay que volver a deployar.

### Orden y dependencia circular

Render necesita la URL de Vercel y Vercel la de Render. Se resuelve en este orden: desplegar Vercel
primero (la web queda sin API), cargar esa URL en `FRONTEND_URL` de Render, desplegar la API y
recién entonces poner `VITE_API_URL` en Vercel y volver a deployar.

## Documentación

- **[AGENTS.md](AGENTS.md)**: stack, ramas y commits, formato de la API, límites entre grupos y reglas para agentes de IA. Leer antes de contribuir.
- [docs/](docs/README.md): dominio, sprint en curso, modelo de datos, convenciones y tarifario. El README indica qué abrir según la tarea.

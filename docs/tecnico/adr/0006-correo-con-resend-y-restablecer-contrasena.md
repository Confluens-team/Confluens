# ADR 0006 — Correo con Resend y enlace para restablecer la contraseña sin tabla de tokens

**Fecha:** 2026-10  ·  **Estado:** aceptada

## Contexto

HU-09 del Sprint 2 (HU-48 del backlog) suma el criterio C8: el cliente y el personal pueden pedir
un enlace por correo para restablecer la contraseña. El sistema no tenía proveedor de correo
(`pendientes.md`, S-11), y HU-49 también lo necesita para el correo de consulta recibida. El enlace
tiene que vencer y servir una sola vez. Cambiar `schema.prisma` y agregar una migración solo para
guardar tokens es un costo que conviene evitar en medio del sprint.

## Decisión

Los correos se envían con **Resend**, llamando a su API HTTP con `fetch` (`lib/correo.ts`), sin
instalar su SDK. Las variables son `RESEND_API_KEY` y `CORREO_REMITENTE`, y se leen de
`process.env` como `JWT_SECRET` (ADR 0003). En desarrollo, sin clave, el correo se imprime en la
consola de la API. En producción, la falta de clave es un error.

El enlace para restablecer la contraseña lleva un **JWT que vence a los 30 minutos**, firmado con
`JWT_SECRET` más el hash actual de la contraseña del usuario (`lib/jwt.ts`). Al cambiar la
contraseña cambia el hash, así que el mismo enlace deja de verificar: es de un solo uso sin guardar
nada en la base. `POST /auth/contrasena/olvido` responde 204 siempre, exista o no la cuenta, y
busca y envía después de responder, para no revelar qué emails están registrados.

## Consecuencias

**A favor.**
- Sin dependencias nuevas y sin migraciones.
- El mismo envío de correo sirve después para HU-49.
- Un token de sesión no sirve para restablecer, y uno de restablecer no sirve como sesión, porque
  se firman con secretos distintos.

**En contra.**
- Mientras no haya un dominio verificado en Resend, el remitente de prueba
  (`onboarding@resend.dev`) solo puede enviar al correo del dueño de la cuenta. Para producción
  hay que verificar un dominio y configurar `CORREO_REMITENTE`.
- Las sesiones abiertas no se cierran al cambiar la contraseña, porque los JWT de sesión no se
  guardan; vencen solas por inactividad (HU-27).
- Falta limitar la cantidad de pedidos por IP o por email (rate limit) antes de publicar.

**Alternativas descartadas.**
- **Tabla de tokens en la base:** permite invalidarlos a mano, pero exige migración y limpieza de
  tokens vencidos.
- **SMTP con Nodemailer:** necesita credenciales de una casilla y suma una dependencia.
- **SDK de Resend:** agrega una dependencia para un único endpoint.
- **Código por WhatsApp o SMS:** depende del proveedor de verificación del celular (S-13), que va
  en sprints siguientes.

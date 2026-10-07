import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';

import { generarDocumentoOpenApi } from './docs/openapi.js';
import { manejadorErrores, rutaNoEncontrada } from './middlewares/manejador-errores.js';
import { rechazarHtml } from './middlewares/rechazar-html.js';
import { verificarOrigen } from './middlewares/verificar-origen.js';
import { rutasApi } from './rutas.js';

// FRONTEND_URL se lee directo de process.env (no de config/entorno.ts) por la misma
// razón que JWT_SECRET en lib/jwt.ts: config/entorno.ts exige DATABASE_URL y mata
// el proceso si falta, y crearApp() la usan los tests de app.test.ts/Supertest sin
// ninguna env var seteada en CI. El default apunta al puerto de Vite en local.
const FRONTEND_URL = process.env['FRONTEND_URL'] ?? 'http://localhost:5173';

export function crearApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  // H2 de la auditoría: en producción la API corre detrás del proxy de Render. Sin esto,
  // express-rate-limit ve la IP del proxy en todos los requests y limitaría a todos los
  // usuarios como si fueran uno. 1 = confiar solo en el salto más cercano.
  app.set('trust proxy', 1);
  // H4 de la auditoría (OWASP A05): CSP, HSTS, X-Content-Type-Options, X-Frame-Options y
  // Referrer-Policy. La API solo devuelve JSON, así que la CSP por defecto de helmet
  // (default-src 'self') no la afecta; se relaja únicamente para /api/docs, que es la única
  // ruta que sirve HTML y necesita los estilos y el bundle de Swagger UI.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          'default-src': ["'self'"],
          'script-src': ["'self'"],
          'style-src': ["'self'", "'unsafe-inline'"],
          'img-src': ["'self'", 'data:'],
          'frame-ancestors': ["'none'"],
        },
      },
      // La web es una SPA en otro dominio que consume esta API por fetch: una política
      // same-origin estricta en los recursos cross-origin rompería ese consumo.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(express.json());
  // cookie-parser: la sesión (HU-27) viaja en una cookie httpOnly, y los
  // middlewares de auth la leen desde req.cookies.
  app.use(cookieParser());
  // credentials:true es necesario para que el navegador mande/reciba la cookie de
  // sesión en requests cross-origin (Vercel↔Render en producción); `origin` fijo
  // (no `*`) porque un origin comodín es incompatible con credentials según la
  // spec de CORS.
  app.use(cors({ origin: FRONTEND_URL, credentials: true }));
  // H5 de la auditoría: CSRF explícito en las escrituras (ver verificar-origen.ts).
  app.use(verificarOrigen(FRONTEND_URL));
  // H3 de la auditoría: ningún campo de texto acepta marcado (ver rechazar-html.ts).
  app.use(rechazarHtml);

  app.use('/api', rutasApi);
  app.use(
    '/api/docs',
    // Swagger UI trae su propio CSS y su bundle inline: con la CSP de arriba no carga.
    helmet.contentSecurityPolicy({
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'", "'unsafe-inline'"],
        'style-src': ["'self'", "'unsafe-inline'"],
        'img-src': ["'self'", 'data:'],
      },
    }),
    swaggerUi.serve,
    swaggerUi.setup(generarDocumentoOpenApi()),
  );

  app.use(rutaNoEncontrada);
  app.use(manejadorErrores);

  return app;
}

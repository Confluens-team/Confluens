import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { manejadorErrores } from './manejador-errores.js';

// H2 de la auditoría de seguridad. El tope de cada ruta se saltea en NODE_ENV=test (ver
// limitadores.ts), así que acá se prueba lo propio del middleware —que el corte sale por
// ErrorApi con el contrato de §4 de AGENTS.md y no con el texto plano de la librería— montando
// un limitador de ventana chica sobre una app mínima, con el skip desactivado.
describe('crearLimitador (H2)', () => {
  it('al pasar el tope responde 429 RATE_LIMITED con el formato de error de la API', async () => {
    const { crearLimitador } = await import('./limitadores.js');
    const nodeEnv = process.env['NODE_ENV'];
    delete process.env['NODE_ENV'];

    try {
      const app = express();
      app.use(crearLimitador(1, 60_000, 'Demasiados intentos'), (_req, res) => {
        res.status(200).json({ data: null });
      });
      app.use(manejadorErrores);

      expect((await request(app).get('/')).status).toBe(200);

      const segunda = await request(app).get('/');
      expect(segunda.status).toBe(429);
      expect(segunda.body.error).toEqual({
        code: 'RATE_LIMITED',
        message: 'Demasiados intentos',
      });
    } finally {
      process.env['NODE_ENV'] = nodeEnv;
    }
  });
});

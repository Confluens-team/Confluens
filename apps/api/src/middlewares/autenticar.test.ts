import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { asincrono } from '../lib/asincrono.js';
import { registrarAuditoria } from '../lib/auditoria.js';
import { firmarToken, NOMBRE_COOKIE_SESION } from '../lib/jwt.js';
import { autenticar } from './autenticar.js';

// HU-25 del backlog: el usuario de la sesión llega como actor de la auditoría a lo que corre
// después de autenticar, aunque pase por asincrono() y por varios await (como una transacción).
describe('autenticar abre el contexto de la auditoría', () => {
  it('lo que el handler audita queda a nombre del usuario de la sesión', async () => {
    const tx = { auditLog: { create: vi.fn() } };
    const app = express();
    app.use(cookieParser());
    app.post(
      '/prueba',
      autenticar,
      asincrono(async (_req, res) => {
        await new Promise((resolver) => setTimeout(resolver, 1));
        await registrarAuditoria(tx as never, {
          entidad: 'Salon',
          entidadId: 1,
          anterior: { nombre: 'A' },
          nuevo: { nombre: 'B' },
        });
        res.status(204).end();
      }),
    );

    const cookie = `${NOMBRE_COOKIE_SESION}=${firmarToken({
      id: 12,
      email: 'gg@confluens.test',
      rol: 'GERENTE_GENERAL',
    })}`;
    const respuesta = await request(app).post('/prueba').set('Cookie', [cookie]);

    expect(respuesta.status).toBe(204);
    expect(tx.auditLog.create.mock.calls[0]![0].data.usuarioId).toBe(12);
  });
});

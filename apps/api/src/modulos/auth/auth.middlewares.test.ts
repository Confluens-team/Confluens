import type { Sesion } from '@confluens/shared';
import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

import { ErrorApi } from '../../lib/errores.js';
import { firmarToken, NOMBRE_COOKIE_SESION } from '../../lib/jwt.js';
import { autenticar } from '../../middlewares/autenticar.js';
import { autorizar } from '../../middlewares/autorizar.js';

// req/res/next simulados a mano: alcanza para probar la lógica de los middlewares
// sin levantar un servidor HTTP real (ver arquitectura.md: "la lógica de negocio
// tiene que poder testearse sin levantar el servidor", extendido acá a middlewares).
function resFake(): Response {
  return { cookie: vi.fn() } as unknown as Response;
}

describe('middlewares/autenticar', () => {
  it('sin cookie llama a next con ErrorApi.noAutenticado', () => {
    const req = { cookies: {} } as Request;
    const res = resFake();
    const next = vi.fn();

    autenticar(req, res, next as NextFunction);

    expect(next).toHaveBeenCalledWith(expect.any(ErrorApi));
    expect((next.mock.calls[0]?.[0] as ErrorApi).status).toBe(401);
  });

  it('con cookie inválida (forjada) llama a next con ErrorApi.noAutenticado', () => {
    const req = { cookies: { [NOMBRE_COOKIE_SESION]: 'token-forjado' } } as unknown as Request;
    const res = resFake();
    const next = vi.fn();

    autenticar(req, res, next as NextFunction);

    expect((next.mock.calls[0]?.[0] as ErrorApi).status).toBe(401);
  });

  it('con cookie válida setea req.usuario, renueva la cookie y llama a next sin error', () => {
    const sesion: Sesion = { id: 1, email: 'ge@confluens.test', rol: 'GERENTE_GENERAL' };
    const req = {
      cookies: { [NOMBRE_COOKIE_SESION]: firmarToken(sesion) },
    } as unknown as Request;
    const res = resFake();
    const next = vi.fn();

    autenticar(req, res, next as NextFunction);

    expect(req.usuario).toEqual(sesion);
    expect(res.cookie).toHaveBeenCalledWith(
      NOMBRE_COOKIE_SESION,
      expect.any(String),
      expect.any(Object),
    );
    expect(next).toHaveBeenCalledWith(); // sin argumentos: no hay error
  });
});

describe('middlewares/autorizar (criterio 3: RE rechazado, GG aceptado)', () => {
  it('rechaza un rol que no está en la lista permitida', () => {
    const req = {
      usuario: { id: 1, email: 're@confluens.test', rol: 'RESPONSABLE_EVENTOS' } as Sesion,
    } as Request;
    const next = vi.fn();

    autorizar('GERENTE_GENERAL')(req, resFake(), next as NextFunction);

    expect((next.mock.calls[0]?.[0] as ErrorApi).status).toBe(403);
  });

  it('acepta un rol que sí está en la lista permitida', () => {
    const req = {
      usuario: { id: 1, email: 'ge@confluens.test', rol: 'GERENTE_GENERAL' } as Sesion,
    } as Request;
    const next = vi.fn();

    autorizar('GERENTE_GENERAL')(req, resFake(), next as NextFunction);

    expect(next).toHaveBeenCalledWith();
  });

  it('rechaza si no hay sesión (autorizar debe ir siempre después de autenticar)', () => {
    const req = {} as Request;
    const next = vi.fn();

    autorizar('GERENTE_GENERAL')(req, resFake(), next as NextFunction);

    expect((next.mock.calls[0]?.[0] as ErrorApi).status).toBe(403);
  });
});

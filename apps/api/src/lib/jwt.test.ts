import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';

import { firmarToken, verificarToken, versionDelToken } from './jwt.js';

// El secreto de desarrollo que usa jwt.ts cuando no hay JWT_SECRET (los tests corren sin env vars).
const SECRETO = 'clave-de-desarrollo-confluens-no-usar-en-produccion';
const sesion = { id: 1, email: 'gg@confluens.test', rol: 'GERENTE_GENERAL' as const };

// El token es lo único que prueba quién es el usuario: cualquier cosa que no sea exactamente uno
// firmado por nosotros, vigente y con la forma de una sesión, tiene que dar null (→ 401).
describe('verificarToken', () => {
  it('devuelve la sesión de un token firmado y vigente', () => {
    expect(verificarToken(firmarToken(sesion))).toEqual(sesion);
  });

  it('devuelve null para un token vencido', () => {
    const vencido = jwt.sign(sesion, SECRETO, { expiresIn: -60 });

    expect(verificarToken(vencido)).toBeNull();
  });

  it('devuelve null para un token firmado con otro secreto', () => {
    const ajeno = jwt.sign(sesion, 'otro-secreto-cualquiera', { expiresIn: '1h' });

    expect(verificarToken(ajeno)).toBeNull();
  });

  it('devuelve null para un token sin firma (alg: none)', () => {
    const sinFirma = jwt.sign(sesion, '', { algorithm: 'none' });

    expect(verificarToken(sinFirma)).toBeNull();
  });

  it('devuelve null para un token firmado con otro algoritmo que HS256', () => {
    const otroAlgoritmo = jwt.sign(sesion, SECRETO, { algorithm: 'HS512', expiresIn: '1h' });

    expect(verificarToken(otroAlgoritmo)).toBeNull();
  });

  it('devuelve null si le cambiaron el contenido sin volver a firmar', () => {
    const [cabecera, , firma] = firmarToken(sesion).split('.');
    const otroPayload = Buffer.from(
      JSON.stringify({ ...sesion, rol: 'ADMINISTRADOR_SISTEMA' }),
    ).toString('base64url');

    expect(verificarToken(`${cabecera}.${otroPayload}.${firma}`)).toBeNull();
  });

  it.each([
    ['sin rol', { id: 1, email: 'gg@confluens.test' }],
    ['con un rol que no existe', { ...sesion, rol: 'SUPERUSUARIO' }],
    ['con el rol en minúsculas', { ...sesion, rol: 'gerente_general' }],
    ['sin id', { email: sesion.email, rol: sesion.rol }],
    ['con un id negativo', { ...sesion, id: -1 }],
    ['con el id como texto', { ...sesion, id: '1' }],
    ['con un correo inválido', { ...sesion, email: 'no-es-un-correo' }],
    ['vacío', {}],
  ])('devuelve null para un token bien firmado pero %s', (_caso, payload) => {
    const token = jwt.sign(payload, SECRETO, { expiresIn: '1h' });

    expect(verificarToken(token)).toBeNull();
  });

  it.each(['', ' ', 'abc', 'a.b.c', '....', 'Bearer xyz', 'null', 'undefined'])(
    'devuelve null para el texto "%s", que no es un token',
    (texto) => {
      expect(verificarToken(texto)).toBeNull();
    },
  );

  it('ignora los claims de más y se queda con los de la sesión', () => {
    const token = jwt.sign({ ...sesion, admin: true, v: 4 }, SECRETO, { expiresIn: '1h' });

    expect(verificarToken(token)).toEqual(sesion);
  });
});

describe('versionDelToken', () => {
  it('lee la versión de sesión si el token la trae', () => {
    expect(versionDelToken(firmarToken(sesion, 7))).toBe(7);
    expect(versionDelToken(firmarToken(sesion, 0))).toBe(0);
  });

  it('devuelve null si el token no la trae, la trae como texto o como decimal', () => {
    expect(versionDelToken(firmarToken(sesion))).toBeNull();
    expect(versionDelToken(jwt.sign({ ...sesion, v: '3' }, SECRETO))).toBeNull();
    expect(versionDelToken(jwt.sign({ ...sesion, v: 1.5 }, SECRETO))).toBeNull();
  });

  it('devuelve null para un texto que no es un token', () => {
    expect(versionDelToken('abc')).toBeNull();
    expect(versionDelToken('')).toBeNull();
  });
});

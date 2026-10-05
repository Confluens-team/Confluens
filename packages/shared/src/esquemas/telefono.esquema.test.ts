import { describe, expect, it } from 'vitest';

import { esquemaRegistroCliente } from './sesion.esquema.js';
import { esquemaCelular, normalizarCelular } from './telefono.esquema.js';

describe('normalizarCelular', () => {
  it.each([
    ['351 15 612-3456', '+5493516123456'],
    ['0351 156123456', '+5493516123456'],
    ['+54 9 351 612 3456', '+5493516123456'],
    ['11 15 6234-5678', '+5491162345678'],
    ['+598 94 123 456', '+59894123456'],
  ])('acepta el celular %s y lo devuelve en E.164', (texto, esperado) => {
    expect(normalizarCelular(texto)).toBe(esperado);
  });

  it.each([
    ['351 6123456', '+5493516123456'],
    ['0351 6123456', '+5493516123456'],
    ['+54 351 6123456', '+5493516123456'],
  ])('toma como celular un número argentino escrito sin el 15 (%s)', (texto, esperado) => {
    expect(normalizarCelular(texto)).toBe(esperado);
  });

  it.each(['123', '4567890', 'abc', 'abc 351 6123456', '0800 333 4444', '+598 2 123 4567'])(
    'rechaza %s',
    (texto) => {
      expect(normalizarCelular(texto)).toBeNull();
    },
  );
});

describe('esquemaCelular', () => {
  it('sin celular devuelve un solo error, el de campo vacío', () => {
    const resultado = esquemaCelular.safeParse('   ');
    expect(resultado.error?.issues.map((issue) => issue.message)).toEqual(['Ingresá tu celular']);
  });

  it('con un número inválido explica cómo escribirlo', () => {
    const resultado = esquemaCelular.safeParse('4567890');
    expect(resultado.error?.issues[0]?.message).toMatch(/celular válido/);
  });
});

describe('esquemaRegistroCliente', () => {
  const datos = {
    nombre: 'Ana',
    apellido: 'Paz',
    email: '  Ana.Paz@Mail.com ',
    telefono: '351 15 612-3456',
    contrasena: 'secreta1',
  };

  it('normaliza el email a minúsculas sin espacios y el celular a E.164', () => {
    expect(esquemaRegistroCliente.parse(datos)).toMatchObject({
      email: 'ana.paz@mail.com',
      telefono: '+5493516123456',
    });
  });

  it('con un email sin formato válido indica el campo (C2 de HU-48)', () => {
    const resultado = esquemaRegistroCliente.safeParse({ ...datos, email: 'ana@' });
    expect(resultado.error?.issues.map((issue) => issue.path)).toEqual([['email']]);
  });
});

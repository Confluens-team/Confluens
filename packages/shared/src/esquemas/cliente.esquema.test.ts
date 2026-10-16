import { describe, expect, it } from 'vitest';

import { esquemaModificarCliente } from './cliente.esquema.js';

const valido = { nombre: 'Ana', apellido: 'Pérez', telefono: '351 6123456' };

describe('esquemaModificarCliente', () => {
  it('normaliza el celular a E.164 y el correo a minúsculas sin espacios', () => {
    const resultado = esquemaModificarCliente.parse({ ...valido, correo: '  Ana@Empresa.COM ' });

    expect(resultado.telefono).toBe('+5493516123456');
    expect(resultado.correo).toBe('ana@empresa.com');
  });

  it('el correo y el apellido son opcionales', () => {
    const resultado = esquemaModificarCliente.parse({ nombre: 'Acme SA', telefono: '3516123456' });

    expect(resultado.correo).toBeUndefined();
    expect(resultado.apellido).toBeUndefined();
  });

  it('un apellido vacío queda como null (razón social)', () => {
    expect(esquemaModificarCliente.parse({ ...valido, apellido: '  ' }).apellido).toBeNull();
  });

  it('acepta una razón social con símbolos y números', () => {
    expect(esquemaModificarCliente.parse({ ...valido, nombre: 'Acme & Hijos S.A. 2' }).nombre).toBe(
      'Acme & Hijos S.A. 2',
    );
  });

  it.each([
    ['nombre vacío', { ...valido, nombre: '   ' }, 'nombre'],
    ['sin nombre', { telefono: valido.telefono }, 'nombre'],
    ['teléfono vacío', { ...valido, telefono: '' }, 'telefono'],
    ['teléfono que no es celular', { ...valido, telefono: '123' }, 'telefono'],
    ['correo inválido', { ...valido, correo: 'no-es-un-correo' }, 'correo'],
    ['correo vacío', { ...valido, correo: '' }, 'correo'],
  ])('rechaza %s indicando el campo', (_caso, datos, campo) => {
    const resultado = esquemaModificarCliente.safeParse(datos);

    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues.map((i) => i.path[0])).toContain(campo);
  });
});

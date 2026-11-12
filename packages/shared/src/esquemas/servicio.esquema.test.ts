import { describe, expect, it } from 'vitest';

import { esquemaCrearServicio, esquemaModificarServicio } from './servicio.esquema.js';

const servicio = {
  nombre: 'Coffee break estándar',
  descripcion: 'Café, té y masas',
  unidadMedida: 'persona',
  precio: '5200.00',
  porPersona: true,
  tercerizado: false,
  admiteModalidad: false,
  // La modificación manda el estado completo, categoría incluida; el alta no la lleva y la ignora.
  categoria: null,
};

// Textos del catálogo (HU-32 y alta): tope de largo para que un nombre de miles de caracteres no
// rompa el listado (PO, 08/11/2026). Alta y modificación tienen las mismas reglas.
describe.each([
  ['alta', esquemaCrearServicio],
  ['modificación', esquemaModificarServicio],
] as const)('textos del servicio — %s', (_nombre, esquema) => {
  const con = (cambio: Record<string, unknown>) => esquema.safeParse({ ...servicio, ...cambio });
  const campoDelError = (cambio: Record<string, unknown>) => con(cambio).error?.issues[0]?.path[0];

  it('acepta el largo máximo de cada texto', () => {
    expect(con({ nombre: 'a'.repeat(100) }).success).toBe(true);
    expect(con({ descripcion: 'a'.repeat(500) }).success).toBe(true);
    expect(con({ unidadMedida: 'a'.repeat(30) }).success).toBe(true);
  });

  it('rechaza un carácter de más, diciendo el campo y el tope', () => {
    const nombre = con({ nombre: 'a'.repeat(101) });
    expect(nombre.success).toBe(false);
    expect(nombre.error?.issues[0]?.path[0]).toBe('nombre');
    expect(nombre.error?.issues[0]?.message).toBe('El nombre admite hasta 100 caracteres');

    expect(campoDelError({ descripcion: 'a'.repeat(501) })).toBe('descripcion');
    expect(con({ descripcion: 'a'.repeat(501) }).error?.issues[0]?.message).toBe(
      'La descripción admite hasta 500 caracteres',
    );
    expect(campoDelError({ unidadMedida: 'a'.repeat(31) })).toBe('unidadMedida');
  });

  it('rechaza un texto enorme sin colgarse', () => {
    expect(con({ nombre: 'a'.repeat(1_000_000) }).success).toBe(false);
  });

  it('recorta los espacios de los bordes antes de medir', () => {
    const resultado = con({ nombre: `  ${'a'.repeat(100)}  ` });

    expect(resultado.success).toBe(true);
    expect(resultado.data?.nombre).toBe('a'.repeat(100));
  });

  it('un texto de solo espacios cuenta como vacío', () => {
    for (const campo of ['nombre', 'descripcion', 'unidadMedida']) {
      expect(campoDelError({ [campo]: '    ' }), campo).toBe(campo);
    }
  });

  it('exige los tres textos: vacíos, nulos o ausentes se rechazan', () => {
    for (const campo of ['nombre', 'descripcion', 'unidadMedida']) {
      expect(campoDelError({ [campo]: '' }), `${campo} vacío`).toBe(campo);
      expect(campoDelError({ [campo]: null }), `${campo} nulo`).toBe(campo);
      expect(campoDelError({ [campo]: undefined }), `${campo} ausente`).toBe(campo);
    }
  });

  it('cuenta caracteres y no bytes: las tildes y los emojis valen uno', () => {
    expect(con({ nombre: 'ñ'.repeat(100) }).success).toBe(true);
    expect(con({ nombre: 'é'.repeat(101) }).success).toBe(false);
  });
});

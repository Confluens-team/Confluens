import { describe, expect, it } from 'vitest';

import { FOTOS, fotoDeSalon, fotoOptimizada } from './fotos';

const URL_CLOUDINARY =
  'https://res.cloudinary.com/demo/image/upload/v1791423768/confluens/salones/abc.png';

describe('fotoOptimizada', () => {
  it('a una foto de Cloudinary le pide formato y calidad automáticos y el ancho indicado', () => {
    expect(fotoOptimizada(URL_CLOUDINARY, 800)).toBe(
      'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_limit,w_800/v1791423768/confluens/salones/abc.png',
    );
  });

  it('deja como están las fotos que no son de Cloudinary', () => {
    expect(fotoOptimizada('https://example.com/foto.jpg', 800)).toBe(
      'https://example.com/foto.jpg',
    );
    expect(fotoOptimizada(FOTOS.evento, 800)).toBe(FOTOS.evento);
  });
});

describe('fotoDeSalon', () => {
  it('usa la foto cargada, optimizada, o la de ambiente si no tiene', () => {
    expect(fotoDeSalon({ nombre: 'Paraná', fotoUrl: URL_CLOUDINARY }, 200)).toContain('w_200/');
    expect(fotoDeSalon({ nombre: 'Auditorio', fotoUrl: null })).toBe(FOTOS.auditorio);
  });
});

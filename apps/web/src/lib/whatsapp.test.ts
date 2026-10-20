import { describe, expect, it } from 'vitest';

import { enlaceWhatsApp } from './whatsapp';

describe('enlaceWhatsApp', () => {
  it('usa el celular en formato internacional sin el +', () => {
    expect(enlaceWhatsApp('+5493516123456')).toBe('https://wa.me/5493516123456');
  });

  it('normaliza un teléfono viejo que no quedó en E.164', () => {
    expect(enlaceWhatsApp('351 15-612-3456')).toBe('https://wa.me/5493516123456');
  });

  it('codifica el mensaje prearmado', () => {
    expect(enlaceWhatsApp('+5493516123456', 'Hola Ana, ¿cómo estás?')).toBe(
      'https://wa.me/5493516123456?text=Hola%20Ana%2C%20%C2%BFc%C3%B3mo%20est%C3%A1s%3F',
    );
  });

  it('sin un celular válido no hay enlace', () => {
    expect(enlaceWhatsApp('123')).toBeNull();
    expect(enlaceWhatsApp('')).toBeNull();
  });
});

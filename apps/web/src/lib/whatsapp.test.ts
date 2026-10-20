import { describe, expect, it } from 'vitest';

import { enlaceWhatsApp, mensajeWhatsApp } from './whatsapp';

describe('mensajeWhatsApp', () => {
  it('con el evento en consulta avisa que se recibió la consulta', () => {
    expect(mensajeWhatsApp('Ana', 'EnConsulta')).toBe(
      'Hola, Ana, somos Los Abuelos Servicios Gastronómicos y recibimos tu consulta. A la brevedad nos estaremos comunicando para enviarte el presupuesto.',
    );
  });

  it('en cualquier otro estado el chat se abre vacío', () => {
    expect(mensajeWhatsApp('Ana', 'Reservado')).toBeUndefined();
    expect(mensajeWhatsApp('Ana', 'Cobrado')).toBeUndefined();
    expect(mensajeWhatsApp('Ana', 'Cancelado')).toBeUndefined();
  });
});

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

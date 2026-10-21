import { describe, expect, it } from 'vitest';

import { enlaceWhatsApp, mensajeWhatsApp } from './whatsapp';

describe('mensajeWhatsApp', () => {
  it('con el evento en consulta avisa que se recibió la consulta', () => {
    expect(mensajeWhatsApp('Ana', 'EnConsulta')).toBe(
      'Hola, Ana, gracias por comunicarse con LA Eventos.\n' +
        'Le confirmamos que hemos recibido correctamente su solicitud de presupuesto y estaremos dando seguimiento a su requerimiento para avanzar con la propuesta correspondiente.\n' +
        '\n' +
        'A la brevedad nos pondremos en contacto con usted.\n' +
        'Agradecemos su interés en nuestros servicios.\n' +
        '\n' +
        'LA Eventos\n' +
        'Experiencias que nacen en cada detalle.',
    );
  });

  it('los saltos de línea viajan codificados en el enlace', () => {
    const enlace = enlaceWhatsApp('+5493516123456', mensajeWhatsApp('Ana', 'EnConsulta'));
    expect(enlace).toContain('?text=Hola%2C%20Ana%2C%20gracias');
    expect(enlace).toContain('LA%20Eventos.%0ALe%20confirmamos');
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

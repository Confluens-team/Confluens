import { describe, expect, it, vi } from 'vitest';

import { avisarConsultaRecibida, correoDeConsulta } from './presupuestos.correo.js';
import type { DatosCorreoConsulta } from './presupuestos.correo.js';

function datos(cambios: Partial<DatosCorreoConsulta> = {}): DatosCorreoConsulta {
  return {
    nombre: 'Marina',
    correo: 'marina@example.com',
    telefono: '+54 9 351 555-1234',
    consultaId: 30,
    tipo: 'Corporativo',
    ...cambios,
  };
}

describe('correoDeConsulta', () => {
  it('va al correo del cliente con el número de consulta en el asunto', () => {
    const correo = correoDeConsulta(datos());

    expect(correo.para).toBe('marina@example.com');
    expect(correo.asunto).toBe('Recibimos tu consulta N° 30 en Los Abuelos');
  });

  it('en el cotizador repite el mensaje de la pantalla, con el teléfono del cliente', () => {
    const { texto } = correoDeConsulta(datos());

    expect(texto).toContain('Hola Marina, generamos tu presupuesto estimado.');
    expect(texto).toContain(
      'Un responsable de eventos va a revisar la disponibilidad del salón y se va a comunicar con vos al +54 9 351 555-1234.',
    );
    expect(texto).toContain('Número de consulta: 30');
  });

  it('en la consulta social repite el mensaje de su pantalla', () => {
    const { texto } = correoDeConsulta(datos({ tipo: 'Social', consultaId: 40 }));

    expect(texto).toContain('Hola Marina, recibimos tu consulta.');
    expect(texto).toContain('Cada evento social es único.');
    expect(texto).toContain('al +54 9 351 555-1234 para elegir juntos el salón');
    expect(texto).toContain('Número de consulta: 40');
  });

  it('es solo una confirmación: sin resumen del evento, importes ni vigencia', () => {
    for (const tipo of ['Corporativo', 'Social'] as const) {
      const { texto, html } = correoDeConsulta(datos({ tipo }));

      for (const contenido of [texto, html]) {
        expect(contenido).not.toContain('$');
        expect(contenido).not.toContain('IVA');
        expect(contenido).not.toContain('válido por');
        expect(contenido).not.toContain('Subtotal');
      }
    }
  });

  it('lleva el sello de Los Abuelos en el HTML', () => {
    const { html } = correoDeConsulta(datos());

    expect(html).toContain('LOS ABUELOS');
    expect(html).toContain('Los Abuelos Servicios Gastronómicos');
    // El bordó y el dorado de la web.
    expect(html).toContain('#5e1f1a');
    expect(html).toContain('#b08d57');
  });

  it('no depende de imágenes remotas', () => {
    expect(correoDeConsulta(datos()).html).not.toContain('<img');
  });

  it('escapa el HTML de lo que cargó el cliente', () => {
    const { html } = correoDeConsulta(
      datos({ nombre: '<script>alert(1)</script>', telefono: '"><img src=x>' }),
    );

    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('avisarConsultaRecibida', () => {
  it('manda el correo armado', async () => {
    const enviar = vi.fn(() => Promise.resolve());

    await avisarConsultaRecibida(datos(), enviar);

    expect(enviar).toHaveBeenCalledWith(expect.objectContaining({ para: 'marina@example.com' }));
  });

  it('no rechaza si el envío falla: lo registra', async () => {
    const enviar = vi.fn(() => Promise.reject(new Error('Resend respondió 500')));
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(avisarConsultaRecibida(datos(), enviar)).resolves.toBeUndefined();

    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('consulta 30'),
      'Resend respondió 500',
    );
    error.mockRestore();
  });
});

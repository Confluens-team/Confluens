import { describe, expect, it, vi } from 'vitest';

import {
  avisarConsultaRecibida,
  avisarConsultaSocialRecibida,
  correoDeConsulta,
  correoDeConsultaSocial,
} from './presupuestos.correo.js';
import type { DatosCorreoConsulta, DatosCorreoConsultaSocial } from './presupuestos.correo.js';

function datos(cambios: Partial<DatosCorreoConsulta['presupuesto']> = {}): DatosCorreoConsulta {
  return {
    nombre: 'Marina',
    correo: 'marina@example.com',
    presupuesto: {
      id: 30,
      total: '100000.00',
      venceEn: new Date('2026-11-17T15:00:00.000Z'),
      evento: { fecha: new Date('2026-11-15'), cantidadPersonas: 10 },
      lineas: [
        {
          descripcion: 'Salón Paraná (jornada completa)',
          cantidad: 1,
          subtotal: '60000.00',
          modalidad: 'Normal',
          aCotizar: false,
          horaEstimada: null,
        },
        {
          descripcion: 'Coffee Refresh',
          cantidad: 10,
          subtotal: '40000.00',
          modalidad: 'Normal',
          aCotizar: false,
          horaEstimada: '16:00',
        },
      ],
      ...cambios,
    },
  };
}

// Quita los espacios (incluido el duro): Intl separa el símbolo del importe con un NBSP.
const sinEspacios = (texto: string) => texto.replaceAll(/\s/g, '');

describe('correoDeConsulta', () => {
  it('va al correo del cliente con el número de consulta en el asunto', () => {
    const correo = correoDeConsulta(datos());

    expect(correo.para).toBe('marina@example.com');
    expect(correo.asunto).toBe('Recibimos tu consulta N° 30 en Los Abuelos');
  });

  it('resume el evento, el detalle, el IVA 21% y el total (RN-05)', () => {
    const { texto } = correoDeConsulta(datos());

    expect(texto).toContain('Hola Marina');
    expect(texto).toContain('domingo, 15 de noviembre de 2026');
    expect(texto).toContain('Personas: 10');
    expect(texto).toContain('Salón Paraná (jornada completa)');
    expect(texto).toContain('Coffee Refresh (16:00 h) x 10');
    // 100.000 sin IVA: IVA 21.000 y total 121.000.
    expect(sinEspacios(texto)).toContain('Subtotal:$100.000,00');
    expect(sinEspacios(texto)).toContain('IVA21%:$21.000,00');
    expect(sinEspacios(texto)).toContain('Total:$121.000,00');
  });

  it('informa la vigencia de 10 días hasta el vencimiento (RN-08)', () => {
    const { texto } = correoDeConsulta(datos());

    expect(texto).toContain('válido por 10 días, hasta el 17 de noviembre de 2026');
  });

  it('aclara que no reserva el salón (ADR 0007)', () => {
    expect(correoDeConsulta(datos()).texto).toContain('Esto no reserva el salón');
  });

  it('muestra la modalidad de un servicio con recargo (RN-11)', () => {
    const { texto } = correoDeConsulta(
      datos({
        lineas: [
          {
            descripcion: 'Coffee Refresh',
            cantidad: 10,
            subtotal: '104760.00',
            modalidad: 'Continuo',
            aCotizar: false,
            horaEstimada: null,
          },
        ],
      }),
    );

    expect(texto).toContain('Coffee Refresh - Continuo en salón x 10');
  });

  it('marca «A cotizar» la línea sin precio', () => {
    const { texto } = correoDeConsulta(
      datos({
        lineas: [
          {
            descripcion: 'Pantalla LED',
            cantidad: 1,
            subtotal: '0.00',
            modalidad: 'Normal',
            aCotizar: true,
            horaEstimada: null,
          },
        ],
      }),
    );

    expect(texto).toContain('Pantalla LED: A cotizar');
  });

  it('escapa el HTML de lo que escribió el cliente', () => {
    const { html } = correoDeConsulta({ ...datos(), nombre: '<script>alert(1)</script>' });

    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('no se cae si el presupuesto no tiene vencimiento', () => {
    const { texto } = correoDeConsulta(datos({ venceEn: null }));

    expect(texto).toContain('válido por 10 días.');
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

function datosSociales(
  cambios: Partial<DatosCorreoConsultaSocial['presupuesto']['evento']> = {},
): DatosCorreoConsultaSocial {
  return {
    nombre: 'Marina',
    correo: 'marina@example.com',
    presupuesto: {
      id: 40,
      evento: {
        fecha: new Date('2026-12-05'),
        cantidadPersonas: 120,
        tipo: 'Social',
        tipoSocial: 'Casamiento',
        tipoSocialDetalle: null,
        tipoJornada: 'completa',
        horaInicioEstimada: '21:00',
        ...cambios,
      },
    },
  };
}

describe('correoDeConsultaSocial (ADR 0008)', () => {
  it('va al correo del cliente con el número de consulta en el asunto', () => {
    const correo = correoDeConsultaSocial(datosSociales());

    expect(correo.para).toBe('marina@example.com');
    expect(correo.asunto).toBe('Recibimos tu consulta N° 40 en Los Abuelos');
  });

  it('resume lo que contó el cliente y no menciona precios ni IVA', () => {
    const { texto } = correoDeConsultaSocial(datosSociales());

    expect(texto).toContain('Hola Marina');
    expect(texto).toContain('Tipo de evento: Social · Casamiento');
    expect(texto).toContain('sábado, 5 de diciembre de 2026');
    expect(texto).toContain('Personas: 120');
    expect(texto).toContain('Jornada: Jornada completa');
    expect(texto).toContain('Hora estimada de inicio: 21:00 h');
    expect(texto).toContain('Todavía no tiene precio');
    expect(texto).not.toContain('IVA');
    expect(texto).not.toContain('$');
  });

  it('muestra el detalle cuando el evento es «Otro»', () => {
    const { texto } = correoDeConsultaSocial(
      datosSociales({ tipoSocial: 'Otro', tipoSocialDetalle: 'Despedida de soltera' }),
    );

    expect(texto).toContain('Social · Despedida de soltera');
  });

  it('omite la jornada y la hora si no se pidieron', () => {
    const { texto } = correoDeConsultaSocial(
      datosSociales({ tipoJornada: null, horaInicioEstimada: null }),
    );

    expect(texto).not.toContain('Jornada');
    expect(texto).not.toContain('Hora estimada');
  });

  it('escapa el HTML de lo que escribió el cliente', () => {
    const { html } = correoDeConsultaSocial(
      datosSociales({ tipoSocial: 'Otro', tipoSocialDetalle: '<img src=x onerror=alert(1)>' }),
    );

    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });
});

describe('avisarConsultaSocialRecibida', () => {
  it('manda el correo armado', async () => {
    const enviar = vi.fn(() => Promise.resolve());

    await avisarConsultaSocialRecibida(datosSociales(), enviar);

    expect(enviar).toHaveBeenCalledWith(expect.objectContaining({ para: 'marina@example.com' }));
  });

  it('no rechaza si el envío falla: lo registra', async () => {
    const enviar = vi.fn(() => Promise.reject(new Error('Resend respondió 500')));
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(avisarConsultaSocialRecibida(datosSociales(), enviar)).resolves.toBeUndefined();

    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('consulta 40'),
      'Resend respondió 500',
    );
    error.mockRestore();
  });
});

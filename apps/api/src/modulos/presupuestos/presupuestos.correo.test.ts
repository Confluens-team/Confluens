import { describe, expect, it, vi } from 'vitest';

import { avisarConsultaRecibida, correoDeConsulta } from './presupuestos.correo.js';
import type { DatosCorreoConsulta } from './presupuestos.correo.js';

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

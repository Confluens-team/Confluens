import type { RegistroAuditoria } from '@confluens/shared';
import { describe, expect, it } from 'vitest';

import { cantidadDeCampos, etiquetaDeRegistro, inicialesDe, resumenDelCambio } from './auditoria';
import { versionDe } from './historial-auditoria';

const registro = (cambios: Partial<RegistroAuditoria>): RegistroAuditoria => ({
  id: 1,
  fecha: '2026-11-05T12:00:00.000Z',
  usuario: { id: 1, email: 're@confluens.test', rol: 'RESPONSABLE_EVENTOS' },
  entidad: 'Evento',
  entidadId: '73',
  campos: [],
  valorAnterior: null,
  valorNuevo: null,
  tipo: 'modificacion',
  sensible: false,
  requiereRevision: false,
  revision: null,
  ...cambios,
});

const alta = registro({
  id: 1,
  tipo: 'alta',
  campos: ['estado', 'cantidadPersonas', 'tipo'],
  valorNuevo: { estado: 'EnConsulta', cantidadPersonas: 120, tipo: 'Corporativo' },
});
const cambioDePersonas = registro({
  id: 2,
  fecha: '2026-11-06T12:00:00.000Z',
  campos: ['cantidadPersonas'],
  valorAnterior: { cantidadPersonas: 120 },
  valorNuevo: { cantidadPersonas: 150 },
});
const reserva = registro({
  id: 3,
  fecha: '2026-11-07T12:00:00.000Z',
  campos: ['estado'],
  valorAnterior: { estado: 'EnConsulta' },
  valorNuevo: { estado: 'Reservado' },
});
// Un pago del mismo evento: es otro registro y no se mezcla con el evento.
const pago = registro({
  id: 4,
  entidad: 'Pago',
  entidadId: '7',
  tipo: 'alta',
  campos: ['monto'],
  valorNuevo: { monto: '960000.00' },
});

describe('versionDe', () => {
  const historial = [reserva, pago, cambioDePersonas, alta];

  it('reconstruye el registro en esa versión, con lo que cambió primero y su valor anterior', () => {
    expect(versionDe(historial, 2)).toEqual({
      completo: true,
      campos: [
        { campo: 'cantidadPersonas', antes: 120, despues: 150, cambio: true },
        { campo: 'estado', antes: 'EnConsulta', despues: 'EnConsulta', cambio: false },
        { campo: 'tipo', antes: 'Corporativo', despues: 'Corporativo', cambio: false },
      ],
    });
  });

  it('cada versión ve solo lo que pasó hasta ella', () => {
    const ultima = versionDe(historial, 3)!;
    expect(ultima.campos[0]).toEqual({
      campo: 'estado',
      antes: 'EnConsulta',
      despues: 'Reservado',
      cambio: true,
    });
    expect(ultima.campos.find((c) => c.campo === 'cantidadPersonas')?.despues).toBe(150);
  });

  it('sin el alta en la auditoría, la versión no es completa', () => {
    expect(versionDe([reserva], 3)?.completo).toBe(false);
    expect(versionDe(historial, 99)).toBeNull();
  });
});

describe('cómo se cuenta un cambio', () => {
  it('iniciales del email y del Sistema', () => {
    expect(inicialesDe('rf@confluens.test')).toBe('RF');
    expect(inicialesDe('lucia.ferreyra@x.com')).toBe('LF');
    expect(inicialesDe(null)).toBe('SI');
  });

  it('el registro por su nombre y número', () => {
    expect(etiquetaDeRegistro({ entidad: 'Presupuesto', entidadId: '65' })).toBe('Presupuesto #65');
    expect(etiquetaDeRegistro({ entidad: 'ConfiguracionPrecios', entidadId: '1' })).toBe(
      'Incremento de precios',
    );
  });

  it('el resumen de cada cambio', () => {
    expect(resumenDelCambio(pago)).toMatch(/^Registró un pago de \$/);
    expect(
      resumenDelCambio(
        registro({ entidad: 'Pago', campos: ['anuladoEn', 'anuladoPorId'], tipo: 'baja' }),
      ),
    ).toBe('Anuló un pago');
    expect(resumenDelCambio(alta)).toBe('Creó evento');
    expect(resumenDelCambio(reserva)).toBe('Pasó a Reservado');
    expect(resumenDelCambio(cambioDePersonas)).toBe('Cambió personas');
    expect(cantidadDeCampos(cambioDePersonas)).toBe('1 campo modificado');
    expect(cantidadDeCampos(alta)).toBe('Registro creado');
  });
});

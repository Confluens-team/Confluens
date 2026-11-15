import { describe, expect, it } from 'vitest';

import { esCambioSensible, requiereRevision, tipoDeAccion } from './auditoria-sensible.js';

describe('esCambioSensible', () => {
  it('cualquier cambio de un pago o del incremento de precios es sensible', () => {
    expect(esCambioSensible({ entidad: 'Pago', campos: ['monto', 'fecha'] })).toBe(true);
    expect(
      esCambioSensible({ entidad: 'ConfiguracionPrecios', campos: ['porcentajeMensual'] }),
    ).toBe(true);
  });

  it('en el resto, solo los campos de plata o de permisos', () => {
    expect(esCambioSensible({ entidad: 'Servicio', campos: ['precio'] })).toBe(true);
    expect(esCambioSensible({ entidad: 'Servicio', campos: ['descripcion'] })).toBe(false);
    expect(esCambioSensible({ entidad: 'Salon', campos: ['precioMediaJornada'] })).toBe(true);
    expect(esCambioSensible({ entidad: 'Presupuesto', campos: ['total', 'lineas'] })).toBe(true);
    expect(esCambioSensible({ entidad: 'Presupuesto', campos: ['avisoRecepcionEn'] })).toBe(false);
    expect(esCambioSensible({ entidad: 'Usuario', campos: ['rol'] })).toBe(true);
    expect(esCambioSensible({ entidad: 'MedioPago', campos: ['nombre'] })).toBe(false);
  });

  it('una entidad sin regla nunca es sensible', () => {
    expect(esCambioSensible({ entidad: 'Evento', campos: ['estado', 'salones'] })).toBe(false);
  });
});

describe('requiereRevision', () => {
  it('lo sensible de quien no es GG espera la revisión', () => {
    expect(requiereRevision({ sensible: true, usuario: { rol: 'RESPONSABLE_FINANZAS' } })).toBe(
      true,
    );
  });

  it('lo del GG y lo del Sistema no la esperan, y lo no sensible tampoco', () => {
    expect(requiereRevision({ sensible: true, usuario: { rol: 'GERENTE_GENERAL' } })).toBe(false);
    expect(requiereRevision({ sensible: true, usuario: null })).toBe(false);
    expect(requiereRevision({ sensible: false, usuario: { rol: 'RESPONSABLE_EVENTOS' } })).toBe(
      false,
    );
  });
});

describe('tipoDeAccion', () => {
  it('sin valor anterior es un alta', () => {
    expect(
      tipoDeAccion({ campos: ['monto'], valorAnterior: null, valorNuevo: { monto: '1' } }),
    ).toBe('alta');
  });

  it('anular, cancelar o desactivar es una baja', () => {
    const cambio = (valorNuevo: Record<string, unknown>, campos = Object.keys(valorNuevo)) => ({
      campos,
      valorAnterior: {},
      valorNuevo,
    });
    expect(tipoDeAccion(cambio({ anuladoEn: '2026-11-15T12:00:00.000Z' }))).toBe('baja');
    expect(tipoDeAccion(cambio({ estado: 'Cancelado' }))).toBe('baja');
    expect(tipoDeAccion(cambio({ activo: false }))).toBe('baja');
  });

  it('el resto es una modificación', () => {
    expect(
      tipoDeAccion({
        campos: ['estado'],
        valorAnterior: { estado: 'EnConsulta' },
        valorNuevo: { estado: 'Reservado' },
      }),
    ).toBe('modificacion');
    expect(
      tipoDeAccion({
        campos: ['activo'],
        valorAnterior: { activo: false },
        valorNuevo: { activo: true },
      }),
    ).toBe('modificacion');
  });
});

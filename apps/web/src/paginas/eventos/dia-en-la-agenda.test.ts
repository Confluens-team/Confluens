import { describe, expect, it } from 'vitest';

import { leerDiaEnLaAgenda, rutaDelDiaEnLaAgenda } from './dia-en-la-agenda';

describe('rutaDelDiaEnLaAgenda', () => {
  it('toma el día de la fecha sin correrlo por la zona horaria', () => {
    expect(rutaDelDiaEnLaAgenda({ fecha: '2026-12-05T00:00:00.000Z', estado: 'EnConsulta' })).toBe(
      '/admin/agenda?fecha=2026-12-05&estado=EnConsulta',
    );
  });

  it('se lee de vuelta tal cual', () => {
    const ruta = rutaDelDiaEnLaAgenda({ fecha: '2027-01-31T00:00:00.000Z', estado: 'Cobrado' });
    const parametros = new URLSearchParams(ruta.split('?')[1]);
    expect(leerDiaEnLaAgenda(parametros)).toEqual({ fecha: '2027-01-31', estado: 'Cobrado' });
  });
});

describe('leerDiaEnLaAgenda', () => {
  it('sin fecha no pide ningún día', () => {
    expect(leerDiaEnLaAgenda(new URLSearchParams())).toBeNull();
  });

  it('ignora una fecha mal formada o inexistente', () => {
    expect(leerDiaEnLaAgenda(new URLSearchParams('fecha=5-12-2026'))).toBeNull();
    expect(leerDiaEnLaAgenda(new URLSearchParams('fecha=2026-13-45'))).toBeNull();
  });

  it('ignora un estado que no existe pero conserva el día', () => {
    expect(leerDiaEnLaAgenda(new URLSearchParams('fecha=2026-12-05&estado=Otro'))).toEqual({
      fecha: '2026-12-05',
      estado: null,
    });
  });
});

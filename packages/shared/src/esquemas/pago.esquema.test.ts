import { describe, expect, it } from 'vitest';

import { esquemaCrearPago, MONTO_MAXIMO_PAGO } from './pago.esquema.js';

const pago = { fecha: '2026-10-06', monto: '1000', medioPagoId: 1 };
const montoDe = (monto: unknown) => esquemaCrearPago.safeParse({ ...pago, monto });

// Importe de un pago (HU-14). El tope de 500 millones por pago lo definió el PO (era de 100 y lo
// subió «por las dudas», 08/11/2026) para atajar un cero de más al tipear; la fecha, en cambio, no
// tiene tope.
describe('esquemaCrearPago — monto', () => {
  it('el tope es de 500 millones', () => {
    expect(MONTO_MAXIMO_PAGO).toBe(500_000_000);
  });

  it('acepta importes reales, con y sin decimales', () => {
    for (const monto of ['0.01', '1', '1000', '34412.40', '115297.52', '100000000.01']) {
      expect(montoDe(monto).success, monto).toBe(true);
    }
  });

  it('acepta exactamente 500 millones y rechaza un centavo más', () => {
    expect(montoDe('500000000').success).toBe(true);
    expect(montoDe('500000000.00').success).toBe(true);
    expect(montoDe('499999999.99').success).toBe(true);

    const encima = montoDe('500000000.01');
    expect(encima.success).toBe(false);
    expect(encima.error?.issues[0]?.message).toBe('El monto no puede superar $500.000.000');
  });

  it('rechaza los importes enormes, aunque entren en el formato', () => {
    for (const monto of ['500000001', '999999999', '9999999999.99']) {
      expect(montoDe(monto).success, monto).toBe(false);
    }
  });

  it('rechaza cero, negativos y los que no tienen formato de importe', () => {
    for (const monto of [
      '0',
      '0.00',
      '-1',
      '-0.01',
      '1000.123',
      '1000,50',
      '1e5',
      '',
      ' ',
      'abc',
    ]) {
      expect(montoDe(monto).success, monto).toBe(false);
    }
  });

  it('rechaza lo que no es texto: el monto viaja como string', () => {
    for (const monto of [1000, null, undefined, true, {}]) {
      expect(montoDe(monto).success, String(monto)).toBe(false);
    }
  });
});

describe('esquemaCrearPago — fecha y observación', () => {
  it('no pone tope a la fecha: acepta una muy antigua y una futura', () => {
    expect(esquemaCrearPago.safeParse({ ...pago, fecha: '1900-01-01' }).success).toBe(true);
    expect(esquemaCrearPago.safeParse({ ...pago, fecha: '2999-12-31' }).success).toBe(true);
  });

  it('rechaza una fecha que no existe o con otro formato', () => {
    for (const fecha of ['2026-02-30', '2026-13-01', '06/10/2026', '2026-10-06T10:00:00Z', '']) {
      expect(esquemaCrearPago.safeParse({ ...pago, fecha }).success, fecha).toBe(false);
    }
  });

  it('la observación es opcional, se recorta y llega hasta 500 caracteres', () => {
    expect(esquemaCrearPago.safeParse(pago).success).toBe(true);
    expect(esquemaCrearPago.safeParse({ ...pago, observacion: 'a'.repeat(500) }).success).toBe(
      true,
    );
    expect(esquemaCrearPago.safeParse({ ...pago, observacion: 'a'.repeat(501) }).success).toBe(
      false,
    );
    expect(esquemaCrearPago.safeParse({ ...pago, observacion: '   ' }).success).toBe(false);

    const recortada = esquemaCrearPago.parse({ ...pago, observacion: '  seña  ' });
    expect(recortada.observacion).toBe('seña');
  });
});

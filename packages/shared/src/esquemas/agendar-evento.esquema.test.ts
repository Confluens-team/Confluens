import { describe, expect, it } from 'vitest';

import { esquemaAgendarEvento } from './agendar-evento.esquema.js';

// HU-50: la distribución de un salón vale en todos sus días (sin `fecha`) o es de un día (con `fecha`).
const base = { inicio: '2027-05-14T12:00:00.000Z', fin: '2027-05-14T21:00:00.000Z' };
const pedir = (distribuciones: unknown[]) =>
  esquemaAgendarEvento.safeParse({ ...base, distribuciones });
const mensajes = (resultado: ReturnType<typeof pedir>) =>
  resultado.success ? [] : resultado.error.issues.map((i) => i.message);

describe('esquemaAgendarEvento: distribuciones', () => {
  it('acepta una distribución general por salón, como siempre', () => {
    expect(
      pedir([
        { salonId: 5, distribucionId: 1 },
        { salonId: 6, distribucionId: 2 },
      ]).success,
    ).toBe(true);
  });

  it('acepta el mismo salón con una distribución distinta cada día', () => {
    expect(
      pedir([
        { salonId: 5, distribucionId: 1, fecha: '2027-05-14' },
        { salonId: 5, distribucionId: 3, fecha: '2027-05-15' },
      ]).success,
    ).toBe(true);
  });

  it('rechaza dos distribuciones para el mismo salón el mismo día', () => {
    const repetida = pedir([
      { salonId: 5, distribucionId: 1, fecha: '2027-05-14' },
      { salonId: 5, distribucionId: 3, fecha: '2027-05-14' },
    ]);
    const general = pedir([
      { salonId: 5, distribucionId: 1 },
      { salonId: 5, distribucionId: 3 },
    ]);

    expect(mensajes(repetida)).toContain('Un salón no puede tener dos distribuciones el mismo día');
    expect(mensajes(general)).toContain('Un salón no puede tener dos distribuciones el mismo día');
  });

  it('rechaza mezclar la general de un salón con las de sus días: no dice cuál manda', () => {
    const mezcla = pedir([
      { salonId: 5, distribucionId: 1 },
      { salonId: 5, distribucionId: 3, fecha: '2027-05-15' },
    ]);

    expect(mensajes(mezcla)).toContain(
      'Un salón tiene una distribución para todos los días o una por día, no las dos',
    );
  });

  it('un salón puede ir general y otro por día en el mismo pedido', () => {
    expect(
      pedir([
        { salonId: 5, distribucionId: 1 },
        { salonId: 6, distribucionId: 2, fecha: '2027-05-14' },
        { salonId: 6, distribucionId: 4, fecha: '2027-05-15' },
      ]).success,
    ).toBe(true);
  });

  it('rechaza una fecha inválida', () => {
    expect(pedir([{ salonId: 5, distribucionId: 1, fecha: '14/05/2027' }]).success).toBe(false);
  });
});

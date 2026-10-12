import { describe, expect, it } from 'vitest';

import { MAXIMO_PERSONAS_EVENTO } from '../dominio/evento.js';
import {
  esquemaCantidadPersonas,
  horaDelEvento,
  minutosDeHora,
  ZONA_HORARIA_EVENTOS,
} from './comunes.esquema.js';

// ADR 0010: la hora de un evento se lee siempre contra una zona fija. Estos tests son lo que evita
// que la regla vuelva a depender de dónde corre el proceso: en las máquinas del equipo el sistema
// está en hora argentina y en Render el contenedor corre en UTC, así que sin la zona fija el mismo
// instante daría dos franjas distintas y la validación de la hora de un servicio cambiaría de
// resultado al desplegar.
describe('horaDelEvento', () => {
  it('lee el instante en la hora del salón, no en UTC', () => {
    // 15:00Z son las 12:00 en Córdoba (UTC-3).
    expect(horaDelEvento('2026-12-18T15:00:00.000Z')).toBe('12:00');
    expect(horaDelEvento('2026-12-18T21:00:00.000Z')).toBe('18:00');
  });

  it('usa el formato de 24 horas con cero adelante, igual que horaEstimada', () => {
    // 11:30Z son las 08:30: con hourCycle h12 saldría "8:30 a. m." y no se podría comparar.
    expect(horaDelEvento('2026-12-18T11:30:00.000Z')).toBe('08:30');
    // Medianoche de Córdoba: con h11/h12 saldría "0:00" o "12:00 a. m.".
    expect(horaDelEvento('2026-12-18T03:00:00.000Z')).toBe('00:00');
  });

  it('da lo mismo en verano que en invierno: Argentina no tiene horario de verano', () => {
    expect(horaDelEvento('2026-01-15T15:00:00.000Z')).toBe('12:00');
    expect(horaDelEvento('2026-07-15T15:00:00.000Z')).toBe('12:00');
  });

  it('acepta un Date además del ISO que manda la API', () => {
    expect(horaDelEvento(new Date('2026-12-18T15:00:00.000Z'))).toBe('12:00');
  });

  it('un instante del día anterior en UTC sigue siendo del día del evento en Córdoba', () => {
    // 02:00Z del 19 son las 23:00 del 18 en Córdoba: un evento que termina tarde.
    expect(horaDelEvento('2026-12-19T02:00:00.000Z')).toBe('23:00');
  });

  it('la zona es la de Córdoba', () => {
    expect(ZONA_HORARIA_EVENTOS).toBe('America/Argentina/Cordoba');
  });
});

describe('minutosDeHora', () => {
  it('convierte "HH:mm" a minutos desde la medianoche', () => {
    expect(minutosDeHora('00:00')).toBe(0);
    expect(minutosDeHora('08:30')).toBe(510);
    expect(minutosDeHora('23:59')).toBe(1439);
  });

  it('ordena igual que comparar los textos, que es de lo que se aprovecha la web', () => {
    const horas = ['13:00', '08:30', '19:45'];
    const porMinutos = [...horas].sort((a, b) => minutosDeHora(a) - minutosDeHora(b));
    const porTexto = [...horas].sort();
    expect(porMinutos).toEqual(porTexto);
  });
});

// La cantidad de asistentes es lo que multiplica a cada servicio por persona: un decimal o un
// número desmedido se arrastra a todo el presupuesto. Antes el schema solo pedía un entero
// positivo, así que un evento de 999.999 personas pasaba y el social no tenía ningún techo (no
// elige salón, ADR 0008, así que la capacidad no lo frenaba).
describe('esquemaCantidadPersonas', () => {
  it('acepta un entero entre 1 y el tope', () => {
    for (const valor of [1, 50, 280, MAXIMO_PERSONAS_EVENTO]) {
      expect(esquemaCantidadPersonas.safeParse(valor).success, String(valor)).toBe(true);
    }
  });

  it('rechaza pasarse del tope, con un mensaje que se puede mostrar', () => {
    const resultado = esquemaCantidadPersonas.safeParse(MAXIMO_PERSONAS_EVENTO + 1);
    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues[0]?.message).toBe(
      `Para más de ${MAXIMO_PERSONAS_EVENTO} personas, consultanos`,
    );
  });

  it('rechaza decimales: una cantidad de personas con coma o punto no existe', () => {
    for (const valor of [2.5, 0.5, 49.99]) {
      expect(esquemaCantidadPersonas.safeParse(valor).success, String(valor)).toBe(false);
    }
    expect(esquemaCantidadPersonas.safeParse(2.5).error?.issues[0]?.message).toBe(
      'Ingresá un número entero de personas',
    );
  });

  it('rechaza cero y negativos', () => {
    expect(esquemaCantidadPersonas.safeParse(0).success).toBe(false);
    expect(esquemaCantidadPersonas.safeParse(-10).success).toBe(false);
  });

  it('no coacciona: un string no es una cantidad', () => {
    expect(esquemaCantidadPersonas.safeParse('50').success).toBe(false);
    expect(esquemaCantidadPersonas.safeParse('50').error?.issues[0]?.message).toBe(
      'Ingresá la cantidad de personas',
    );
  });
});

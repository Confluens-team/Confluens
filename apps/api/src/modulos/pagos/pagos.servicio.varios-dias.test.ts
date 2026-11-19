import type { ChoqueDeSalon } from '@confluens/shared';
import { describe, expect, it, vi } from 'vitest';

import { Prisma } from '../../generated/prisma/client.js';
import type { PagosRepositorio } from './pagos.repositorio.js';
import { registrarPago } from './pagos.servicio.js';

// HU-50, parte 3: la seña de un evento de varios días lo reserva ENTERO. Cada día tiene que tener su
// horario y su salón, se controla cada uno contra los eventos reservados de ese día y, si hay choques,
// se avisa de todos. Contra un repositorio de mentira.

const parana = { id: 5, nombre: 'Paraná' };
const pucara = { id: 6, nombre: 'Pucará' };
const renglon = (s: typeof parana) => ({ salonId: s.id, salon: s });

const dia = (id: number, fecha: string, salones: (typeof parana)[], conHorario = true) => ({
  id,
  fecha: new Date(fecha),
  inicio: conHorario ? new Date(`${fecha}T12:00:00.000Z`) : null,
  fin: conHorario ? new Date(`${fecha}T21:00:00.000Z`) : null,
  salones: salones.map(renglon),
});

function evento(dias: ReturnType<typeof dia>[]) {
  return {
    id: 20,
    estado: 'EnConsulta',
    senaRegistradaEn: null,
    fecha: dias[0]!.fecha,
    fechaFin: dias[dias.length - 1]!.fecha,
    // El resumen: el inicio del primer día y el fin del último.
    inicio: dias[0]!.inicio,
    fin: dias[dias.length - 1]!.fin,
    salones: dias.flatMap((d) => d.salones),
    dias,
    presupuestos: [
      { id: 7, estado: 'Estimado', total: new Prisma.Decimal('1000'), requiereFactura: false },
    ],
  };
}

function repoDeMentira(eventoDelRepo: ReturnType<typeof evento>, choques: ChoqueDeSalon[] = []) {
  return {
    buscarDetallado: vi.fn(() => Promise.resolve(eventoDelRepo)),
    buscarMedioPagoActivo: vi.fn(() => Promise.resolve({ id: 1 })),
    sumarPagos: vi.fn(() => Promise.resolve(null)),
    buscarSolapamiento: vi.fn(),
    buscarChoquesPorDia: vi.fn(() => Promise.resolve(choques)),
    buscarConsultasSuperpuestas: vi.fn(() => Promise.resolve([])),
    crear: vi.fn(() => Promise.resolve({ id: 1 })),
    confirmarPresupuestoYReservar: vi.fn(() => Promise.resolve({ estado: 'Reservado' })),
    marcarCobrado: vi.fn(),
    crearEnTransaccion: vi.fn((ejecutar: (tx: undefined) => unknown) => ejecutar(undefined)),
  };
}
const comoRepo = (repo: object) => repo as unknown as PagosRepositorio;

// El 20% de 1000 es 200: este pago reserva el evento.
const sena = { fecha: '2027-05-01', monto: '300.00', medioPagoId: 1 } as never;

const tresDias = () => [
  dia(100, '2027-05-14', [parana]),
  dia(101, '2027-05-15', [parana, pucara]),
  dia(102, '2027-05-16', [pucara]),
];

describe('registrarPago que reserva un evento de varios días (HU-50)', () => {
  it('reserva el evento entero si todos los días están agendados y libres', async () => {
    const repo = repoDeMentira(evento(tresDias()));
    const resultado = await registrarPago(20, sena, comoRepo(repo));

    expect(resultado.reservoElSalon).toBe(true);
    expect(repo.confirmarPresupuestoYReservar).toHaveBeenCalledTimes(1);
    const [{ franjas }] = repo.buscarChoquesPorDia.mock.calls[0] as unknown as [
      { franjas: { fecha: string; salonIds: number[] }[] },
    ];
    // Cada día con SUS salones; no se mira el resumen del evento.
    expect(franjas.map((f) => [f.fecha, f.salonIds])).toEqual([
      ['2027-05-14', [5]],
      ['2027-05-15', [5, 6]],
      ['2027-05-16', [6]],
    ]);
    expect(repo.buscarSolapamiento).not.toHaveBeenCalled();
  });

  it('un día del medio sin horario no se reserva: 422 claro, antes de aceptar la plata', async () => {
    const dias = tresDias();
    dias[1] = dia(101, '2027-05-15', [parana, pucara], false);
    const repo = repoDeMentira(evento(dias));

    await expect(registrarPago(20, sena, comoRepo(repo))).rejects.toMatchObject({
      status: 422,
      message: expect.stringContaining('sábado 15/05/2027'),
    });
    expect(repo.crear).not.toHaveBeenCalled();
    expect(repo.confirmarPresupuestoYReservar).not.toHaveBeenCalled();
  });

  it('un día sin salón tampoco: 422', async () => {
    const dias = tresDias();
    dias[2] = dia(102, '2027-05-16', []);
    const repo = repoDeMentira(evento(dias));

    await expect(registrarPago(20, sena, comoRepo(repo))).rejects.toMatchObject({ status: 422 });
    expect(repo.crear).not.toHaveBeenCalled();
  });

  it('con un choque en cualquier día el evento no queda reservado «a medias»: 409 con la lista', async () => {
    const choque: ChoqueDeSalon = {
      fecha: '2027-05-15',
      salon: pucara,
      evento: {
        id: 52,
        estado: 'Reservado',
        cliente: 'Constructora Medina SRL',
        inicio: '2027-05-15T12:00:00.000Z',
        fin: '2027-05-15T21:00:00.000Z',
      },
    };
    const repo = repoDeMentira(evento(tresDias()), [choque]);

    const error = await registrarPago(20, sena, comoRepo(repo)).catch((e: unknown) => e);

    expect(error).toMatchObject({ status: 409 });
    expect((error as Error).message).toContain('1 de sus 3 días tiene un salón ocupado');
    expect((error as Error).message).toContain('Salón Pucará: reservado por el evento #52');
    expect(repo.crear).not.toHaveBeenCalled();
    expect(repo.confirmarPresupuestoYReservar).not.toHaveBeenCalled();
  });

  it('un pago que no llega a la seña no reserva ni mira los días', async () => {
    const repo = repoDeMentira(evento(tresDias()));
    const chico = { fecha: '2027-05-01', monto: '100.00', medioPagoId: 1 } as never;

    const resultado = await registrarPago(20, chico, comoRepo(repo));

    expect(resultado.reservoElSalon).toBe(false);
    expect(repo.buscarChoquesPorDia).not.toHaveBeenCalled();
  });
});

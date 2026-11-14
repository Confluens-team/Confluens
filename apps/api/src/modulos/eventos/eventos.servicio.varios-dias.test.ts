import type { ChoqueDeSalon } from '@confluens/shared';
import { describe, expect, it, vi } from 'vitest';

import { agendarEvento } from './eventos.servicio.js';
import type { EventosRepositorio } from './eventos.repositorio.js';

// HU-50, parte 3: agendar un evento de varios días. Cada día tiene su horario, se controla contra los
// eventos reservados de ESE día y, si hay choques, se avisa de todos. Contra un repositorio de mentira.

const salon = (id: number, nombre: string) => ({ id, nombre });
const parana = salon(5, 'Paraná');
const pucara = salon(6, 'Pucará');
const fila = (s: { id: number; nombre: string }) => ({
  salonId: s.id,
  salon: s,
  distribucion: null,
  distribucionId: null,
});

// Tres días: Paraná el primero, los dos el segundo y Pucará el tercero.
const dias = [
  { fecha: '2027-05-14', personas: 40, salones: [parana] },
  { fecha: '2027-05-15', personas: 80, salones: [parana, pucara] },
  { fecha: '2027-05-16', personas: 30, salones: [pucara] },
];

function eventoDeTresDias() {
  return {
    id: 20,
    estado: 'EnConsulta',
    fecha: new Date('2027-05-14'),
    fechaFin: new Date('2027-05-16'),
    cantidadPersonas: 80,
    inicio: null,
    fin: null,
    // Un renglón por día y salón, como los guarda la base.
    salones: dias.flatMap((d) => d.salones.map(fila)),
    dias: dias.map((d, i) => ({
      id: 100 + i,
      fecha: new Date(d.fecha),
      inicio: null,
      fin: null,
      cantidadPersonas: d.personas,
      tipoJornada: 'completa',
      salones: d.salones.map(fila),
    })),
  };
}

const distribuciones = [
  { id: 1, salonId: 5, nombre: 'Banquete', capacidad: 100, activo: true },
  { id: 2, salonId: 6, nombre: 'Banquete', capacidad: 60, activo: true },
];

function repoDeMentira(choques: ChoqueDeSalon[] = []) {
  return {
    buscarDetallado: vi.fn(() => Promise.resolve(eventoDeTresDias())),
    buscarDistribuciones: vi.fn(() => Promise.resolve(distribuciones)),
    buscarSolapamiento: vi.fn(() => Promise.resolve(null)),
    buscarChoquesPorDia: vi.fn(() => Promise.resolve(choques)),
    crearEnTransaccion: vi.fn((ejecutar: (tx: undefined) => unknown) => ejecutar(undefined)),
    agendarConDistribuciones: vi.fn(() => Promise.resolve()),
  };
}
const comoRepo = (repo: object) => repo as unknown as EventosRepositorio;

// 09:00 a 18:00 en Córdoba (UTC-3).
const horario = (fecha: string, desde = '12:00', hasta = '21:00') => ({
  fecha,
  inicio: `${fecha}T${desde}:00.000Z`,
  fin: `${fecha}T${hasta}:00.000Z`,
});
const pedido = (extra: Record<string, unknown> = {}) =>
  ({
    distribuciones: [
      { salonId: 5, distribucionId: 1 },
      { salonId: 6, distribucionId: 2 },
    ],
    dias: dias.map((d) => horario(d.fecha)),
    modalidadSalonRestaurante: false,
    confirmarCapacidadExcedida: false,
    ...extra,
  }) as never;

describe('agendarEvento de varios días (HU-50)', () => {
  it('guarda el horario de cada día y controla cada uno con SUS salones', async () => {
    const repo = repoDeMentira();
    await agendarEvento(20, pedido(), comoRepo(repo));

    const [guardado] = repo.agendarConDistribuciones.mock.calls[0] as unknown as [
      { horarios: { fecha: string; inicio: Date }[] },
    ];
    expect(guardado.horarios.map((h) => h.fecha)).toEqual([
      '2027-05-14',
      '2027-05-15',
      '2027-05-16',
    ]);
    const [{ franjas }] = repo.buscarChoquesPorDia.mock.calls[0] as unknown as [
      { franjas: { fecha: string; salonIds: number[] }[] },
    ];
    expect(franjas.map((f) => [f.fecha, f.salonIds])).toEqual([
      ['2027-05-14', [5]],
      ['2027-05-15', [5, 6]],
      ['2027-05-16', [6]],
    ]);
    // No se usa la búsqueda del evento entero, que daría falsos choques entre un día y otro.
    expect(repo.buscarSolapamiento).not.toHaveBeenCalled();
  });

  it('un horario puede pasar la medianoche: termina al día siguiente', async () => {
    const repo = repoDeMentira();
    const conMadrugada = pedido({
      dias: [
        horario('2027-05-14'),
        {
          fecha: '2027-05-15',
          inicio: '2027-05-15T23:00:00.000Z',
          fin: '2027-05-16T05:00:00.000Z',
        },
        horario('2027-05-16'),
      ],
    });

    await expect(agendarEvento(20, conMadrugada, comoRepo(repo))).resolves.toBeDefined();
  });

  it('avisa de TODOS los choques, cada uno con su día, salón, evento y horario, y no escribe nada', async () => {
    const choque = (fecha: string, s: typeof parana, eventoId: number): ChoqueDeSalon => ({
      fecha,
      salon: s,
      evento: {
        id: eventoId,
        estado: 'Reservado',
        cliente: 'Constructora Medina SRL',
        inicio: `${fecha}T12:00:00.000Z`,
        fin: `${fecha}T21:00:00.000Z`,
      },
    });
    const repo = repoDeMentira([
      choque('2027-05-14', parana, 52),
      choque('2027-05-16', pucara, 61),
    ]);

    const error = await agendarEvento(20, pedido(), comoRepo(repo)).catch((e: unknown) => e);

    expect(error).toMatchObject({ status: 409 });
    const { message, detalles } = error as { message: string; detalles: { campo: string }[] };
    expect(message).toContain('2 de sus 3 días tienen un salón ocupado');
    expect(message).toContain('Salón Paraná: reservado por el evento #52');
    expect(message).toContain('Salón Pucará: reservado por el evento #61');
    expect(message).toContain('El otro día está libre');
    expect(detalles.map((d) => d.campo)).toEqual(['2027-05-14', '2027-05-16']);
    expect(repo.agendarConDistribuciones).not.toHaveBeenCalled();
  });

  it('falta el horario de un día: 422 que dice cuál', async () => {
    const repo = repoDeMentira();
    const faltaUno = pedido({ dias: [horario('2027-05-14'), horario('2027-05-16')] });

    await expect(agendarEvento(20, faltaUno, comoRepo(repo))).rejects.toMatchObject({
      status: 422,
      message: expect.stringContaining('sábado 15/05/2027'),
    });
    expect(repo.agendarConDistribuciones).not.toHaveBeenCalled();
  });

  it('un día que no es del evento sobra: 422', async () => {
    const repo = repoDeMentira();
    const deMas = pedido({ dias: [...dias.map((d) => horario(d.fecha)), horario('2027-05-17')] });

    await expect(agendarEvento(20, deMas, comoRepo(repo))).rejects.toMatchObject({ status: 422 });
  });

  it('el horario suelto de un día no alcanza para un evento de varios: 422', async () => {
    const repo = repoDeMentira();
    const suelto = pedido({
      dias: undefined,
      inicio: '2027-05-14T12:00:00.000Z',
      fin: '2027-05-14T21:00:00.000Z',
    });

    await expect(agendarEvento(20, suelto, comoRepo(repo))).rejects.toMatchObject({ status: 422 });
  });

  it('el horario de un día tiene que empezar ese día y terminar después de empezar', async () => {
    const repo = repoDeMentira();
    const otroDia = pedido({
      dias: [
        {
          fecha: '2027-05-14',
          inicio: '2027-05-15T12:00:00.000Z',
          fin: '2027-05-15T21:00:00.000Z',
        },
        horario('2027-05-15'),
        horario('2027-05-16'),
      ],
    });
    const alReves = pedido({
      dias: [horario('2027-05-14', '21:00', '12:00'), horario('2027-05-15'), horario('2027-05-16')],
    });

    await expect(agendarEvento(20, otroDia, comoRepo(repo))).rejects.toMatchObject({ status: 422 });
    await expect(agendarEvento(20, alReves, comoRepo(repo))).rejects.toMatchObject({ status: 422 });
  });

  it('la capacidad se mira por día: 80 personas en Paraná + Pucará (160) pasan; 80 en Pucará solo no', async () => {
    const repo = repoDeMentira();
    // El segundo día tiene 80 personas y dos salones (100 + 60): entra. Si el tercero, con Pucará solo
    // (60), tuviera 80, no entraría.
    await expect(agendarEvento(20, pedido(), comoRepo(repo))).resolves.toBeDefined();

    const excedido = eventoDeTresDias();
    excedido.dias[2]!.cantidadPersonas = 80;
    repo.buscarDetallado.mockResolvedValueOnce(excedido);
    await expect(agendarEvento(20, pedido(), comoRepo(repo))).rejects.toMatchObject({
      status: 422,
      message: expect.stringContaining('domingo 16/05/2027'),
    });

    repo.buscarDetallado.mockResolvedValueOnce(excedido);
    await expect(
      agendarEvento(20, pedido({ confirmarCapacidadExcedida: true }), comoRepo(repo)),
    ).resolves.toBeDefined();
  });
});

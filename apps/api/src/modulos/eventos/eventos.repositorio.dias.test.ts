import { describe, expect, it, vi } from 'vitest';

// Si el módulo se importa sin esto abre un cliente real de Prisma: acá todo pasa por el `tx` falso.
vi.mock('../../lib/prisma.js', () => ({ prisma: {} }));

const { conActor } = await import('../../lib/auditoria.js');
const { agendarConDistribuciones } = await import('./eventos.repositorio.js');

// HU-50 parte 1 (ADR 0014): agendar fija el horario del DÍA y no el del evento. El resumen del evento
// (inicio y fin) lo recalcula la base, y escribirlo a mano lo rechaza un trigger.
describe('eventos.repositorio: agendarConDistribuciones (HU-50)', () => {
  it('escribe el horario en el día, deja solo la modalidad en el evento y guarda cada distribución', async () => {
    const inicio = new Date('2026-11-15T12:00:00Z');
    const fin = new Date('2026-11-15T21:00:00Z');
    const tx = {
      evento: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 20, inicio: null, fin: null }),
        update: vi.fn().mockResolvedValue({}),
      },
      eventoDia: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      eventoSalon: {
        findMany: vi.fn().mockResolvedValue([]),
        update: vi.fn().mockResolvedValue({}),
      },
      auditLog: { create: vi.fn() },
    };

    await conActor({ usuarioId: 1, rol: 'RESPONSABLE_EVENTOS' }, () =>
      agendarConDistribuciones(
        {
          eventoId: 20,
          distribuciones: [
            { diaId: 1, salonId: 5, distribucionId: 11 },
            { diaId: 1, salonId: 6, distribucionId: 12 },
          ],
          inicio,
          fin,
          modalidadSalonRestaurante: true,
        },
        tx as never,
      ),
    );

    expect(tx.eventoDia.updateMany).toHaveBeenCalledWith({
      where: { eventoId: 20 },
      data: { inicio, fin },
    });
    // El evento no recibe inicio ni fin: son su resumen.
    expect(tx.evento.update).toHaveBeenCalledWith({
      where: { id: 20 },
      data: { modalidadSalonRestaurante: true },
    });
    // Cada renglón se escribe por su clave (día, salón): nunca por salón, que tocaría todos los días.
    expect(tx.eventoSalon.update).toHaveBeenCalledWith({
      where: { diaId_salonId: { diaId: 1, salonId: 5 } },
      data: { distribucionId: 11 },
    });
    expect(tx.eventoSalon.update).toHaveBeenCalledWith({
      where: { diaId_salonId: { diaId: 1, salonId: 6 } },
      data: { distribucionId: 12 },
    });
  });
});

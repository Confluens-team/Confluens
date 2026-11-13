import { describe, expect, it, vi } from 'vitest';

import { agendarEvento } from '../modulos/eventos/eventos.servicio.js';
import type { EventosRepositorio } from '../modulos/eventos/eventos.repositorio.js';
import { registrarPago } from '../modulos/pagos/pagos.servicio.js';
import type { PagosRepositorio } from '../modulos/pagos/pagos.repositorio.js';
import { reutilizarConfiguracion } from '../modulos/presupuestos/presupuestos.servicio.js';
import type { PresupuestosRepositorio } from '../modulos/presupuestos/presupuestos.repositorio.js';
import { esDeVariosDias } from './evento-de-varios-dias.js';

// HU-50: hasta que la agenda y la reserva sean por día, un evento de varios días se puede cotizar y
// modificar, pero no agendar, cobrar ni reutilizar: darían un resultado equivocado en silencio.

const undia = { fecha: new Date('2040-05-01'), fechaFin: new Date('2040-05-01') };
const tresDias = { fecha: new Date('2040-05-01'), fechaFin: new Date('2040-05-03') };

describe('esDeVariosDias', () => {
  it('es de varios días cuando el último día es posterior al primero', () => {
    expect(esDeVariosDias(tresDias)).toBe(true);
    expect(esDeVariosDias(undia)).toBe(false);
  });

  it('sin fecha de fin (un evento armado a mano en un test) es de un solo día', () => {
    expect(esDeVariosDias({ fecha: new Date('2040-05-01') })).toBe(false);
    expect(esDeVariosDias({ fecha: new Date('2040-05-01'), fechaFin: null })).toBe(false);
  });
});

describe('las acciones que todavía no admiten varios días responden 422 y no tocan nada', () => {
  it('agendar', async () => {
    const repo = {
      buscarDetallado: vi.fn(() => Promise.resolve({ id: 1, estado: 'EnConsulta', ...tresDias })),
      agendarConDistribuciones: vi.fn(),
    };

    await expect(
      agendarEvento(
        1,
        { inicio: '2040-05-01T12:00:00.000Z', fin: '2040-05-01T20:00:00.000Z' } as never,
        repo as unknown as EventosRepositorio,
      ),
    ).rejects.toMatchObject({ status: 422 });
    expect(repo.agendarConDistribuciones).not.toHaveBeenCalled();
  });

  it('cobrar la seña, antes de aceptar plata', async () => {
    const repo = {
      buscarDetallado: vi.fn(() => Promise.resolve({ id: 1, estado: 'EnConsulta', ...tresDias })),
      crearEnTransaccion: vi.fn(),
    };

    await expect(
      registrarPago(
        1,
        { monto: '1000', medioPagoId: 1 } as never,
        repo as unknown as PagosRepositorio,
      ),
    ).rejects.toMatchObject({ status: 422 });
    expect(repo.crearEnTransaccion).not.toHaveBeenCalled();
  });

  it('reutilizar', async () => {
    const repo = {
      buscarEventoParaReutilizar: vi.fn(() => Promise.resolve({ id: 1, ...tresDias })),
      crearEnTransaccion: vi.fn(),
    };

    await expect(
      reutilizarConfiguracion(
        1,
        { fecha: '2040-09-01', cantidadPersonas: 10, tipoJornada: 'completa' },
        repo as unknown as PresupuestosRepositorio,
      ),
    ).rejects.toMatchObject({ status: 422 });
    expect(repo.crearEnTransaccion).not.toHaveBeenCalled();
  });

  it('un evento de un solo día pasa la guarda', async () => {
    const repo = {
      buscarEventoParaReutilizar: vi.fn(() => Promise.resolve(null)),
    };

    // Llega a buscar el evento y falla por otro motivo (no existe), no por la guarda.
    await expect(
      reutilizarConfiguracion(
        1,
        { fecha: '2040-09-01', cantidadPersonas: 10, tipoJornada: 'completa' },
        repo as unknown as PresupuestosRepositorio,
      ),
    ).rejects.toMatchObject({ status: 404 });
  });
});

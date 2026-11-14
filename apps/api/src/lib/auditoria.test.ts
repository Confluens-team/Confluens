import { describe, expect, it, vi } from 'vitest';

import { Prisma } from '../generated/prisma/client.js';
import {
  calcularDiferencia,
  conActor,
  normalizar,
  registrarAuditoria,
  registrarAuditorias,
} from './auditoria.js';

// HU-25 del backlog: qué queda en el registro se decide acá, así que se prueba sin Postgres.
describe('normalizar', () => {
  it('lleva Decimal a string con 2 decimales y Date a ISO, también adentro de listas y objetos', () => {
    const fecha = new Date('2026-11-07T12:00:00.000Z');
    expect(normalizar(new Prisma.Decimal('1000'))).toBe('1000.00');
    expect(normalizar(fecha)).toBe('2026-11-07T12:00:00.000Z');
    expect(normalizar([{ precio: new Prisma.Decimal('5.5'), en: fecha }])).toEqual([
      { precio: '5.50', en: '2026-11-07T12:00:00.000Z' },
    ]);
    expect(normalizar(undefined)).toBeNull();
  });
});

describe('calcularDiferencia', () => {
  it('guarda solo los campos que cambiaron, con su valor anterior y el nuevo', () => {
    const diferencia = calcularDiferencia(
      { id: 1, nombre: 'Paraná', precioMediaJornada: new Prisma.Decimal('100.00') },
      { id: 1, nombre: 'Paraná', precioMediaJornada: new Prisma.Decimal('120') },
    );
    expect(diferencia).toEqual({
      campos: ['precioMediaJornada'],
      valorAnterior: { precioMediaJornada: '100.00' },
      valorNuevo: { precioMediaJornada: '120.00' },
    });
  });

  it('un mismo importe con otra escala no es un cambio', () => {
    expect(
      calcularDiferencia(
        { precio: new Prisma.Decimal('1000.00') },
        { precio: new Prisma.Decimal('1000') },
      ),
    ).toBeNull();
  });

  it('sin anterior es un alta: entran los campos con valor y valorAnterior queda vacío', () => {
    expect(calcularDiferencia(null, { id: 3, nombre: 'Banquete', descripcion: null })).toEqual({
      campos: ['nombre'],
      valorAnterior: null,
      valorNuevo: { nombre: 'Banquete' },
    });
  });

  it('nunca guarda el hash de la contraseña, la versión de sesión ni las marcas de fecha propias', () => {
    const diferencia = calcularDiferencia(
      {
        hashContrasena: 'a',
        versionSesion: 1,
        actualizadoEn: new Date(0),
        rol: 'RESPONSABLE_EVENTOS',
      },
      {
        hashContrasena: 'b',
        versionSesion: 2,
        actualizadoEn: new Date(),
        rol: 'RESPONSABLE_FINANZAS',
      },
    );
    expect(diferencia?.campos).toEqual(['rol']);
  });

  it('ignora los campos que el registro anterior no tiene (por ejemplo, relaciones incluidas)', () => {
    expect(calcularDiferencia({ nombre: 'A' }, { nombre: 'A', distribuciones: [] })).toBeNull();
  });

  it('compara listas por contenido', () => {
    expect(
      calcularDiferencia(
        { salones: [{ salonId: 1 }] },
        { salones: [{ salonId: 1 }, { salonId: 2 }] },
      )?.campos,
    ).toEqual(['salones']);
  });
});

describe('registrarAuditoria con el usuario de la sesión', () => {
  const cambio = {
    entidad: 'Salon' as const,
    entidadId: 1,
    anterior: { nombre: 'A' },
    nuevo: { nombre: 'B' },
  };

  it('sin usuario explícito toma el de la sesión, también después de un await', async () => {
    const tx = { auditLog: { create: vi.fn() } };
    await conActor({ usuarioId: 7, rol: 'GERENTE_GENERAL' }, async () => {
      await Promise.resolve();
      await registrarAuditoria(tx as never, cambio);
    });
    expect(tx.auditLog.create.mock.calls[0]![0].data.usuarioId).toBe(7);
  });

  it('sin sesión ni usuario explícito falla: no se registra a nombre del Sistema por descuido', async () => {
    const tx = { auditLog: { create: vi.fn() } };
    await expect(registrarAuditoria(tx as never, cambio)).rejects.toThrow(/sin usuario/);
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('el usuario explícito gana sobre la sesión; null es el Sistema', async () => {
    const tx = { auditLog: { create: vi.fn() } };
    await conActor({ usuarioId: 7, rol: 'GERENTE_GENERAL' }, () =>
      registrarAuditoria(tx as never, { ...cambio, usuarioId: null }),
    );
    expect(tx.auditLog.create.mock.calls[0]![0].data.usuarioId).toBeNull();
  });

  it('lo que hace el cliente desde el canal público no se audita', async () => {
    const tx = { auditLog: { create: vi.fn(), createMany: vi.fn() } };
    await conActor({ usuarioId: 30, rol: 'CLIENTE' }, async () => {
      expect(await registrarAuditoria(tx as never, cambio)).toBe(false);
      expect(await registrarAuditorias(tx as never, [cambio])).toBe(0);
    });
    expect(tx.auditLog.create).not.toHaveBeenCalled();
    expect(tx.auditLog.createMany).not.toHaveBeenCalled();
  });
});

describe('registrarAuditoria', () => {
  it('escribe con el tx recibido y el usuario; null es el Sistema', async () => {
    const tx = { auditLog: { create: vi.fn(), createMany: vi.fn() } };
    const escribio = await registrarAuditoria(tx as never, {
      usuarioId: null,
      entidad: 'Presupuesto',
      entidadId: 9,
      anterior: { estado: 'Estimado' },
      nuevo: { estado: 'Expirado' },
    });
    expect(escribio).toBe(true);
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        usuarioId: null,
        entidad: 'Presupuesto',
        entidadId: '9',
        campos: ['estado'],
        valorAnterior: { estado: 'Estimado' },
        valorNuevo: { estado: 'Expirado' },
      },
    });
  });

  it('sin cambios no escribe nada', async () => {
    const tx = { auditLog: { create: vi.fn() } };
    expect(
      await registrarAuditoria(tx as never, {
        usuarioId: 1,
        entidad: 'Salon',
        entidadId: 1,
        anterior: { nombre: 'A' },
        nuevo: { nombre: 'A' },
      }),
    ).toBe(false);
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('en lote escribe una fila por cambio real con un solo createMany', async () => {
    const tx = { auditLog: { createMany: vi.fn() } };
    const cantidad = await registrarAuditorias(tx as never, [
      {
        usuarioId: 2,
        entidad: 'Presupuesto',
        entidadId: 1,
        anterior: { estado: 'Estimado' },
        nuevo: { estado: 'Cancelado' },
      },
      {
        usuarioId: 2,
        entidad: 'Presupuesto',
        entidadId: 2,
        anterior: { estado: 'Cancelado' },
        nuevo: { estado: 'Cancelado' },
      },
    ]);
    expect(cantidad).toBe(1);
    expect(tx.auditLog.createMany.mock.calls[0]![0].data).toHaveLength(1);
  });
});

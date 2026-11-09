import { describe, expect, it } from 'vitest';

import { Prisma } from '../generated/prisma/client.js';
import { ErrorApi } from './errores.js';
import { comoConflictoSiYaExiste, esViolacionDeUnicidad } from './prisma-errores.js';

const errorDePrisma = (code: string, meta?: Record<string, unknown>) =>
  new Prisma.PrismaClientKnownRequestError('falló', { code, clientVersion: 'test', meta });

describe('esViolacionDeUnicidad', () => {
  it('reconoce el P2002 de Prisma', () => {
    expect(esViolacionDeUnicidad(errorDePrisma('P2002'))).toBe(true);
  });

  it('reconoce el SQLSTATE 23505 de Postgres que llega anidado desde el driver adapter', () => {
    const error = errorDePrisma('P2010', { driverAdapterError: { cause: { code: '23505' } } });

    expect(esViolacionDeUnicidad(error)).toBe(true);
  });

  it('no confunde otras violaciones: exclusión (23P01), clave foránea (P2003) o no encontrado', () => {
    expect(
      esViolacionDeUnicidad(
        errorDePrisma('P2039', { driverAdapterError: { cause: { code: '23P01' } } }),
      ),
    ).toBe(false);
    expect(esViolacionDeUnicidad(errorDePrisma('P2003'))).toBe(false);
    expect(esViolacionDeUnicidad(errorDePrisma('P2025'))).toBe(false);
  });

  it.each([new Error('P2002'), null, undefined, 'P2002', { code: 'P2002' }])(
    'no reconoce lo que no es un error de Prisma (%s)',
    (valor) => {
      expect(esViolacionDeUnicidad(valor)).toBe(false);
    },
  );
});

describe('comoConflictoSiYaExiste', () => {
  it('devuelve lo que devuelve la escritura si sale bien', async () => {
    await expect(comoConflictoSiYaExiste(async () => 42, 'repetido')).resolves.toBe(42);
  });

  it('traduce la violación de unicidad a un 409 CONFLICT con el mensaje dado', async () => {
    const resultado = comoConflictoSiYaExiste(async () => {
      throw errorDePrisma('P2002');
    }, 'Ya existe uno llamado «X»');

    await expect(resultado).rejects.toBeInstanceOf(ErrorApi);
    await expect(resultado).rejects.toMatchObject({
      status: 409,
      codigo: 'CONFLICT',
      message: 'Ya existe uno llamado «X»',
    });
  });

  it('deja pasar cualquier otro error tal cual: no se disfraza de conflicto', async () => {
    const otro = new Error('conexión perdida');

    await expect(
      comoConflictoSiYaExiste(async () => {
        throw otro;
      }, 'repetido'),
    ).rejects.toBe(otro);

    const deClave = errorDePrisma('P2003');
    await expect(
      comoConflictoSiYaExiste(async () => {
        throw deClave;
      }, 'repetido'),
    ).rejects.toBe(deClave);
  });
});

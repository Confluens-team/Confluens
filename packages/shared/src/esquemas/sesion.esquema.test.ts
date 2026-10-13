import { describe, expect, it } from 'vitest';

import { esquemaRegistroCliente } from './sesion.esquema.js';

// Nombre y apellido del registro del cliente (HU-48). El campo queda en la ficha con la que el
// equipo lo llama y le escribe, no es un texto libre: por eso no acepta dígitos ni símbolos y tiene
// techo de 30 caracteres. Antes no tenía ninguna de las dos cosas y se podía crear una cuenta con
// "Juan3!" o con un nombre de miles de caracteres.
const registro = {
  nombre: 'Ana',
  apellido: 'Pérez',
  email: 'ana@empresa.com',
  telefono: '+5493515551234',
  contrasena: 'secreta123',
};

const nombreDe = (nombre: string) => esquemaRegistroCliente.safeParse({ ...registro, nombre });

describe('esquemaRegistroCliente — nombre y apellido', () => {
  it('acepta los nombres reales que tienen tilde, ñ, espacio, guión o apóstrofe', () => {
    for (const nombre of [
      'Ana',
      'José María',
      'Muñoz',
      'García-López',
      "D'Angelo",
      'Ñandú',
      'de la Rúa',
    ]) {
      expect(nombreDe(nombre).success, nombre).toBe(true);
    }
  });

  it('rechaza dígitos y símbolos', () => {
    for (const nombre of ['Ana3', 'Ana!', 'Ana_Pérez', '<script>', 'Ana@casa', '123']) {
      expect(nombreDe(nombre).success, nombre).toBe(false);
    }
  });

  it('rechaza separadores al borde o repetidos, que no forman un nombre', () => {
    for (const nombre of ['-Ana', 'Ana-', 'Ana  María', 'Ana--María', "'Ana"]) {
      expect(nombreDe(nombre).success, nombre).toBe(false);
    }
  });

  it('corta en 30 caracteres', () => {
    expect(nombreDe('a'.repeat(30)).success).toBe(true);
    const largo = nombreDe('a'.repeat(31));
    expect(largo.success).toBe(false);
    expect(largo.error?.issues[0]?.message).toBe('Usá hasta 30 caracteres');
  });

  it('sigue exigiendo el campo, con el mensaje de cada uno', () => {
    expect(nombreDe('').error?.issues[0]?.message).toBe('Ingresá tu nombre');
    // El trim corre antes: solo espacios es un campo vacío, no un nombre con separador al borde.
    expect(nombreDe('   ').error?.issues[0]?.message).toBe('Ingresá tu nombre');
    expect(
      esquemaRegistroCliente.safeParse({ ...registro, apellido: '' }).error?.issues[0]?.message,
    ).toBe('Ingresá tu apellido');
  });

  it('el apellido se valida igual que el nombre', () => {
    expect(esquemaRegistroCliente.safeParse({ ...registro, apellido: 'Pérez2' }).success).toBe(
      false,
    );
    expect(esquemaRegistroCliente.safeParse({ ...registro, apellido: 'Pérez Gómez' }).success).toBe(
      true,
    );
  });
});

import { describe, expect, it } from 'vitest';

import {
  esquemaCredenciales,
  esquemaRegistrarUsuario,
  esquemaRegistroCliente,
  esquemaRestablecerContrasena,
} from './sesion.esquema.js';

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

// Contraseña de `largo` caracteres con letras distintas: una sola letra repetida no pasa la política.
const contrasenaDe = (largo: number) => 'abcdefghij'.repeat(Math.ceil(largo / 10)).slice(0, largo);

// Contraseña nueva (HU-30 del Sprint 4 y registro del cliente). De 8 caracteres a 72 bytes: bcrypt
// lee solo los primeros 72, así que dos contraseñas largas iguales hasta ahí tendrían el mismo hash
// (PO, 07/11/2026). Rige donde se crea o se cambia una contraseña, no en el login.
describe('contraseña nueva — largo', () => {
  const alta = { email: 'nuevo@confluens.test', rol: 'RESPONSABLE_EVENTOS' as const };
  const contrasenaDeAlta = (contrasena: unknown) =>
    esquemaRegistrarUsuario.safeParse({ ...alta, contrasena });

  it('acepta de 8 a 72 caracteres', () => {
    for (const largo of [8, 9, 20, 71, 72]) {
      expect(contrasenaDeAlta(contrasenaDe(largo)).success, String(largo)).toBe(true);
    }
  });

  it('rechaza menos de 8 caracteres, con el mensaje del mínimo', () => {
    for (const largo of [0, 1, 5, 6, 7]) {
      const resultado = contrasenaDeAlta(contrasenaDe(largo));
      expect(resultado.success, String(largo)).toBe(false);
      expect(resultado.error?.issues[0]?.message).toBe(
        'La contraseña debe tener al menos 8 caracteres',
      );
    }
  });

  it('rechaza más de 72 caracteres, con un mensaje que lo explica', () => {
    for (const largo of [73, 100, 5000]) {
      const resultado = contrasenaDeAlta(contrasenaDe(largo));
      expect(resultado.success, String(largo)).toBe(false);
      expect(resultado.error?.issues[0]?.message).toContain('demasiado larga');
      expect(resultado.error?.issues[0]?.message).toContain('72');
    }
  });

  it('el tope se mide en bytes: una tilde o un emoji cuentan más de uno', () => {
    // 36 letras con tilde son 72 bytes: entran justo. Una más se pasa.
    expect(contrasenaDeAlta('ñá'.repeat(18)).success).toBe(true);
    expect(contrasenaDeAlta(`${'ñá'.repeat(18)}ñ`).success).toBe(false);
    // 18 emojis son 72 bytes; con 19 bcrypt cortaría a mitad de uno.
    expect(contrasenaDeAlta('💰🌱'.repeat(9)).success).toBe(true);
    expect(contrasenaDeAlta(`${'💰🌱'.repeat(9)}💰`).success).toBe(false);
    // 71 bytes de ASCII más una "ñ" (2 bytes) son 73: se pasa por un byte.
    expect(contrasenaDeAlta(`${contrasenaDe(71)}ñ`).success).toBe(false);
  });

  it('no recorta la contraseña: los espacios de los bordes cuentan y se conservan', () => {
    const resultado = contrasenaDeAlta('  clave 2026  ');

    expect(resultado.success).toBe(true);
    expect(resultado.data?.contrasena).toBe('  clave 2026  ');
  });

  it('rechaza lo que no es texto', () => {
    for (const contrasena of [null, undefined, 12345678, ['clave-2026']]) {
      expect(contrasenaDeAlta(contrasena).success, String(contrasena)).toBe(false);
    }
  });

  it('el mismo techo rige en el registro y al restablecerla', () => {
    const larga = contrasenaDe(73);
    expect(esquemaRegistroCliente.safeParse({ ...registro, contrasena: larga }).success).toBe(
      false,
    );
    expect(
      esquemaRestablecerContrasena.safeParse({ token: 'abc', contrasena: larga }).success,
    ).toBe(false);
    // Y las dos aceptan el largo máximo.
    const justa = contrasenaDe(72);
    expect(esquemaRegistroCliente.safeParse({ ...registro, contrasena: justa }).success).toBe(true);
    expect(
      esquemaRestablecerContrasena.safeParse({ token: 'abc', contrasena: justa }).success,
    ).toBe(true);
  });

  it('el login no impone política: una cuenta con una contraseña vieja, corta o larga, tiene que poder entrar', () => {
    for (const contrasena of ['123', 'a'.repeat(200)]) {
      expect(esquemaCredenciales.safeParse({ email: 'ana@empresa.com', contrasena }).success).toBe(
        true,
      );
    }
  });
});

// Política de contraseñas (PO, 08/11/2026): prioriza el largo y frena lo obvio. No exige mayúsculas,
// minúsculas ni símbolos, porque empujan a contraseñas como `Contraseña1!` sin hacerlas más fuertes.
describe('contraseña nueva — política', () => {
  const alta = { email: 'nuevo@confluens.test', rol: 'RESPONSABLE_EVENTOS' as const };
  const resultadoDe = (contrasena: string) =>
    esquemaRegistrarUsuario.safeParse({ ...alta, contrasena });
  const mensajeDe = (contrasena: string) => resultadoDe(contrasena).error?.issues[0]?.message;

  it.each([
    ['ocho espacios', '        '],
    ['solo tabuladores', '\t\t\t\t\t\t\t\t'],
    ['espacios y tabuladores mezclados', ' \t \t \t \t'],
    ['veinte espacios', ' '.repeat(20)],
  ])('rechaza %s: no puede ser solo espacios', (_caso, contrasena) => {
    expect(resultadoDe(contrasena).success).toBe(false);
    expect(mensajeDe(contrasena)).toBe('La contraseña no puede ser solo espacios');
  });

  it.each([
    ['una letra', 'aaaaaaaa'],
    ['un número', '00000000'],
    ['un símbolo', '........'],
    ['una letra muy repetida', 'x'.repeat(40)],
    ['un emoji', '💰💰💰💰💰💰💰💰'],
  ])('rechaza %s repetida: no puede ser un único carácter', (_caso, contrasena) => {
    expect(resultadoDe(contrasena).success).toBe(false);
    expect(mensajeDe(contrasena)).toBe('La contraseña no puede ser un único carácter repetido');
  });

  it('acepta una contraseña con repeticiones mientras haya más de un carácter distinto', () => {
    for (const contrasena of ['aaaaaaab', 'abababab', '1111111a']) {
      expect(resultadoDe(contrasena).success, contrasena).toBe(true);
    }
  });

  it.each([
    '12345678',
    '123456789',
    'password',
    'Password1',
    'PASSWORD123',
    'contrasena',
    'Contraseña',
    'CONTRASEÑA1',
    'Bienvenido',
    'confluens',
    'Confluens123',
    'qwertyuiop',
    '1q2w3e4r',
  ])('rechaza la contraseña común "%s", sin importar mayúsculas ni tildes', (contrasena) => {
    expect(resultadoDe(contrasena).success).toBe(false);
    expect(mensajeDe(contrasena)).toBe('Esa contraseña es demasiado común. Elegí otra');
  });

  it('acepta una contraseña parecida a una común pero distinta', () => {
    for (const contrasena of [
      'password-segura',
      'contraseña-larga-2026',
      'Confluens2026!',
      'mi clave de 8',
      '12345678a',
    ]) {
      expect(resultadoDe(contrasena).success, contrasena).toBe(true);
    }
  });

  it('acepta una frase larga sin mayúsculas, números ni símbolos: lo que importa es el largo', () => {
    for (const contrasena of ['cuatro palabras sueltas', 'elperrodelvecino', 'ñandúsobreelrío']) {
      expect(resultadoDe(contrasena).success, contrasena).toBe(true);
    }
  });

  it('no exige mayúscula, minúscula ni símbolo', () => {
    for (const contrasena of ['todominuscula', 'TODOMAYUSCULA', '4815162342', 'soloLetrasYnada']) {
      expect(resultadoDe(contrasena).success, contrasena).toBe(true);
    }
  });

  it('la política rige en el alta del personal, el registro del cliente y al restablecerla', () => {
    const comun = '12345678';
    const buena = 'clave-2026';

    expect(esquemaRegistrarUsuario.safeParse({ ...alta, contrasena: comun }).success).toBe(false);
    expect(esquemaRegistroCliente.safeParse({ ...registro, contrasena: comun }).success).toBe(
      false,
    );
    expect(
      esquemaRestablecerContrasena.safeParse({ token: 'abc', contrasena: comun }).success,
    ).toBe(false);

    expect(esquemaRegistrarUsuario.safeParse({ ...alta, contrasena: buena }).success).toBe(true);
    expect(esquemaRegistroCliente.safeParse({ ...registro, contrasena: buena }).success).toBe(true);
    expect(
      esquemaRestablecerContrasena.safeParse({ token: 'abc', contrasena: buena }).success,
    ).toBe(true);
  });

  it('el login no aplica la política: una cuenta con una contraseña común puede seguir entrando', () => {
    expect(
      esquemaCredenciales.safeParse({ email: 'ana@empresa.com', contrasena: '12345678' }).success,
    ).toBe(true);
  });
});

// Correo de una cuenta: se normaliza antes de validar el formato.
describe('correo de una cuenta', () => {
  const alta = { rol: 'RESPONSABLE_EVENTOS' as const, contrasena: 'secreta123' };
  const correoDe = (email: unknown) => esquemaRegistrarUsuario.safeParse({ ...alta, email });

  it('lo pasa a minúsculas y le saca los espacios', () => {
    const resultado = correoDe('  Ana.Perez@Empresa.COM ');
    expect(resultado.data?.email).toBe('ana.perez@empresa.com');
  });

  it('acepta el alias con +, los puntos y los subdominios', () => {
    for (const email of ['ana+eventos@empresa.com', 'a.b.c@mail.empresa.com.ar', 'x@y.co']) {
      expect(correoDe(email).success, email).toBe(true);
    }
  });

  it('rechaza lo que no tiene forma de correo', () => {
    for (const email of [
      '',
      '   ',
      'sin-arroba',
      'ana@',
      '@empresa.com',
      'ana@@empresa.com',
      'ana perez@empresa.com',
      'ana@empresa',
      'ana..perez@empresa.com',
    ]) {
      expect(correoDe(email).success, email).toBe(false);
    }
  });

  it('rechaza lo que no es texto', () => {
    for (const email of [null, undefined, 42, {}]) {
      expect(correoDe(email).success, String(email)).toBe(false);
    }
  });
});

// Tope de largo del correo (PO, 08/11/2026): el del estándar, 254, el mismo que ya usa el cotizador.
describe('correo de una cuenta — largo', () => {
  const alta = { rol: 'RESPONSABLE_EVENTOS' as const, contrasena: 'secreta123' };
  const correoDe = (largo: number) => `${'a'.repeat(largo - '@e.co'.length)}@e.co`;

  it('acepta 254 caracteres y rechaza 255, con un mensaje que lo explica', () => {
    expect(esquemaRegistrarUsuario.safeParse({ ...alta, email: correoDe(254) }).success).toBe(true);

    const resultado = esquemaRegistrarUsuario.safeParse({ ...alta, email: correoDe(255) });
    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues[0]?.message).toBe('El email admite hasta 254 caracteres');
  });

  it('el tope se mide después de recortar y pasar a minúsculas', () => {
    const conEspacios = `   ${correoDe(254)}   `;

    expect(esquemaRegistrarUsuario.safeParse({ ...alta, email: conEspacios }).success).toBe(true);
  });

  it('rige también en el login, el registro del cliente y el restablecimiento', () => {
    const largo = correoDe(255);

    expect(esquemaCredenciales.safeParse({ email: largo, contrasena: 'x' }).success).toBe(false);
    expect(esquemaRegistroCliente.safeParse({ ...registro, email: largo }).success).toBe(false);
    expect(
      esquemaRestablecerContrasena.safeParse({ token: 'abc', contrasena: 'secreta123' }).success,
    ).toBe(true);
  });
});

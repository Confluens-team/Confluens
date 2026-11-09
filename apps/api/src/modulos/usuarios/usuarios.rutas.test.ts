import type { Rol } from '@confluens/shared';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { crearApp } from '../../app.js';
import { Prisma } from '../../generated/prisma/client.js';
import { compararContrasena } from '../../lib/contrasena.js';
import { firmarToken, NOMBRE_COOKIE_SESION, verificarToken } from '../../lib/jwt.js';

// Se mockea el repositorio, no la base: el CI no levanta Postgres (ADR 0003).
vi.mock('./usuarios.repositorio.js', () => ({
  buscarPorEmail: vi.fn(),
  crear: vi.fn(),
  listar: vi.fn(),
}));

const { buscarPorEmail, crear, listar } = await import('./usuarios.repositorio.js');
const buscarPorEmailMock = vi.mocked(buscarPorEmail);
const crearMock = vi.mocked(crear);
const listarMock = vi.mocked(listar);

const cookieDe = (rol: Rol) =>
  `${NOMBRE_COOKIE_SESION}=${firmarToken({ id: 1, email: 'gg@confluens.test', rol })}`;

const FECHA = new Date('2026-11-06T15:00:00.000Z');
const creado = (email: string, rol: Rol) => ({
  id: 7,
  email,
  rol,
  creadoEn: FECHA,
  actualizadoEn: FECHA,
});

const alta = { email: 'fran@confluens.test', rol: 'RESPONSABLE_EVENTOS', contrasena: 'inicial1' };

// Contraseña de `largo` caracteres con letras distintas: una sola letra repetida no pasa la política.
const contrasenaDe = (largo: number) => 'abcdefghij'.repeat(Math.ceil(largo / 10)).slice(0, largo);

describe('POST /api/usuarios (HU-30 del Sprint 4)', () => {
  const app = crearApp();

  beforeEach(() => {
    buscarPorEmailMock.mockReset().mockResolvedValue(null);
    crearMock.mockReset();
    listarMock.mockReset();
  });

  it('el GG registra un RE: 201 con el usuario, sin hash y sin tocar su propia sesión', async () => {
    crearMock.mockResolvedValue(creado('fran@confluens.test', 'RESPONSABLE_EVENTOS'));

    const respuesta = await request(app)
      .post('/api/usuarios')
      .set('Cookie', [cookieDe('GERENTE_GENERAL')])
      .send(alta);

    expect(respuesta.status).toBe(201);
    expect(respuesta.body).toEqual({
      data: {
        id: 7,
        email: 'fran@confluens.test',
        rol: 'RESPONSABLE_EVENTOS',
        creadoEn: FECHA.toISOString(),
        actualizadoEn: FECHA.toISOString(),
      },
    });
    // autenticar puede renovar la cookie de quien da el alta; nunca se emite una del usuario nuevo.
    const cookies = (respuesta.headers['set-cookie'] ?? []) as unknown as string[];
    for (const cookie of cookies) {
      const token = cookie.split(';')[0]!.split('=')[1]!;
      expect(verificarToken(token)?.email).toBe('gg@confluens.test');
    }
  });

  it('guarda el hash de la contraseña inicial, nunca el texto plano', async () => {
    crearMock.mockResolvedValue(creado('fran@confluens.test', 'RESPONSABLE_EVENTOS'));

    await request(app)
      .post('/api/usuarios')
      .set('Cookie', [cookieDe('GERENTE_GENERAL')])
      .send(alta);

    const guardado = crearMock.mock.calls[0]![0];
    expect(guardado.hashContrasena).not.toBe('inicial1');
    expect(await compararContrasena('inicial1', guardado.hashContrasena)).toBe(true);
  });

  it.each(['GERENTE_GENERAL', 'RESPONSABLE_FINANZAS'] as const)(
    'el GG registra un %s',
    async (rol) => {
      crearMock.mockResolvedValue(creado('nuevo@confluens.test', rol));

      const respuesta = await request(app)
        .post('/api/usuarios')
        .set('Cookie', [cookieDe('GERENTE_GENERAL')])
        .send({ ...alta, email: 'nuevo@confluens.test', rol });

      expect(respuesta.status).toBe(201);
      expect(crearMock).toHaveBeenCalledWith(expect.objectContaining({ rol }));
    },
  );

  it('el ADM registra a otro ADM', async () => {
    crearMock.mockResolvedValue(creado('admin2@confluens.test', 'ADMINISTRADOR_SISTEMA'));

    const respuesta = await request(app)
      .post('/api/usuarios')
      .set('Cookie', [cookieDe('ADMINISTRADOR_SISTEMA')])
      .send({ ...alta, email: 'admin2@confluens.test', rol: 'ADMINISTRADOR_SISTEMA' });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data.rol).toBe('ADMINISTRADOR_SISTEMA');
  });

  it('el GG no puede asignar el rol ADM: 403 FORBIDDEN', async () => {
    const respuesta = await request(app)
      .post('/api/usuarios')
      .set('Cookie', [cookieDe('GERENTE_GENERAL')])
      .send({ ...alta, rol: 'ADMINISTRADOR_SISTEMA' });

    expect(respuesta.status).toBe(403);
    expect(respuesta.body.error.code).toBe('FORBIDDEN');
    expect(crearMock).not.toHaveBeenCalled();
  });

  it.each(['RESPONSABLE_EVENTOS', 'RESPONSABLE_FINANZAS', 'CLIENTE'] as const)(
    'con sesión de %s responde 403: no registra usuarios',
    async (rol) => {
      const respuesta = await request(app)
        .post('/api/usuarios')
        .set('Cookie', [cookieDe(rol)])
        .send(alta);

      expect(respuesta.status).toBe(403);
      expect(respuesta.body.error.code).toBe('FORBIDDEN');
      expect(crearMock).not.toHaveBeenCalled();
    },
  );

  it('sin sesión responde 401', async () => {
    const respuesta = await request(app).post('/api/usuarios').send(alta);

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('el rol Cliente no se asigna por acá: 400 VALIDATION_ERROR', async () => {
    const respuesta = await request(app)
      .post('/api/usuarios')
      .set('Cookie', [cookieDe('ADMINISTRADOR_SISTEMA')])
      .send({ ...alta, rol: 'CLIENTE' });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
    expect(crearMock).not.toHaveBeenCalled();
  });

  it.each([
    ['un correo inválido', { email: 'fran' }],
    ['sin correo', { email: '' }],
    ['una contraseña de menos de 8 caracteres', { contrasena: '1234567' }],
  ])('con %s responde 400 VALIDATION_ERROR', async (_caso, cambio) => {
    const respuesta = await request(app)
      .post('/api/usuarios')
      .set('Cookie', [cookieDe('GERENTE_GENERAL')])
      .send({ ...alta, ...cambio });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
    expect(crearMock).not.toHaveBeenCalled();
  });

  // Contraseña: de 6 a 72 bytes (PO, 07/11/2026). bcrypt lee solo los primeros 72.
  it.each([
    ['8 caracteres, el mínimo', contrasenaDe(8)],
    ['72 caracteres, el máximo', contrasenaDe(72)],
    ['36 letras con tilde, que son justo 72 bytes', 'ñá'.repeat(18)],
    ['espacios en los bordes: no se recortan', '  clave 2026  '],
    ['símbolos y tildes', 'Contraseña-Ñandú_2026!'],
  ])('acepta una contraseña de %s', async (_caso, contrasena) => {
    crearMock.mockResolvedValue(creado('fran@confluens.test', 'RESPONSABLE_EVENTOS'));

    const respuesta = await request(app)
      .post('/api/usuarios')
      .set('Cookie', [cookieDe('GERENTE_GENERAL')])
      .send({ ...alta, contrasena });

    expect(respuesta.status).toBe(201);
    const guardado = crearMock.mock.calls[0]![0];
    expect(await compararContrasena(contrasena, guardado.hashContrasena)).toBe(true);
  });

  it.each([
    ['73 caracteres', contrasenaDe(73)],
    ['5000 caracteres', contrasenaDe(5000)],
    ['37 letras con tilde, que son 74 bytes', `${'ñá'.repeat(18)}ñ`],
    ['19 emojis, que son 76 bytes', `${'💰🌱'.repeat(9)}💰`],
  ])('rechaza una contraseña de %s con 400 y no crea nada', async (_caso, contrasena) => {
    const respuesta = await request(app)
      .post('/api/usuarios')
      .set('Cookie', [cookieDe('GERENTE_GENERAL')])
      .send({ ...alta, contrasena });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
    expect(respuesta.body.error.details[0].campo).toBe('contrasena');
    expect(respuesta.body.error.details[0].mensaje).toContain('72');
    expect(crearMock).not.toHaveBeenCalled();
  });

  it('un 73.º byte distinto no pasa inadvertido: dos contraseñas iguales hasta el 72 ya no conviven', async () => {
    // Era el problema: bcrypt hashea solo los primeros 72 bytes, así que estas dos daban el mismo
    // hash. Ahora la segunda ni se acepta.
    const base = contrasenaDe(72);
    crearMock.mockResolvedValue(creado('fran@confluens.test', 'RESPONSABLE_EVENTOS'));

    const justa = await request(app)
      .post('/api/usuarios')
      .set('Cookie', [cookieDe('GERENTE_GENERAL')])
      .send({ ...alta, contrasena: base });
    const pasada = await request(app)
      .post('/api/usuarios')
      .set('Cookie', [cookieDe('GERENTE_GENERAL')])
      .send({ ...alta, contrasena: `${base}X` });

    expect(justa.status).toBe(201);
    expect(pasada.status).toBe(400);
  });

  // Política de contraseñas (PO, 08/11/2026): largo mínimo de 8, sin ser trivial.
  it.each([
    ['solo espacios', '        ', 'La contraseña no puede ser solo espacios'],
    [
      'un único carácter repetido',
      'aaaaaaaa',
      'La contraseña no puede ser un único carácter repetido',
    ],
    ['una contraseña común', '12345678', 'Esa contraseña es demasiado común. Elegí otra'],
    [
      'una común con otras mayúsculas y tildes',
      'Contraseña',
      'Esa contraseña es demasiado común. Elegí otra',
    ],
  ])(
    'rechaza %s con 400, el mensaje de la regla y sin crear nada',
    async (_caso, contrasena, mensaje) => {
      const respuesta = await request(app)
        .post('/api/usuarios')
        .set('Cookie', [cookieDe('GERENTE_GENERAL')])
        .send({ ...alta, contrasena });

      expect(respuesta.status).toBe(400);
      expect(respuesta.body.error.details[0]).toEqual({ campo: 'contrasena', mensaje });
      expect(crearMock).not.toHaveBeenCalled();
    },
  );

  it('acepta una frase larga sin mayúsculas ni símbolos: lo que importa es el largo', async () => {
    crearMock.mockResolvedValue(creado('fran@confluens.test', 'RESPONSABLE_EVENTOS'));

    const respuesta = await request(app)
      .post('/api/usuarios')
      .set('Cookie', [cookieDe('GERENTE_GENERAL')])
      .send({ ...alta, contrasena: 'cuatro palabras sueltas' });

    expect(respuesta.status).toBe(201);
  });

  it('un 400 por la contraseña no la devuelve en la respuesta', async () => {
    const contrasena = '12345';

    const respuesta = await request(app)
      .post('/api/usuarios')
      .set('Cookie', [cookieDe('GERENTE_GENERAL')])
      .send({ ...alta, contrasena });

    expect(respuesta.status).toBe(400);
    expect(JSON.stringify(respuesta.body)).not.toContain(contrasena);
  });

  it.each([
    ['sin contraseña', { contrasena: undefined }],
    ['con la contraseña nula', { contrasena: null }],
    ['con la contraseña numérica', { contrasena: 123456 }],
    ['con la contraseña en una lista', { contrasena: ['secreta1'] }],
    ['sin rol', { rol: undefined }],
    ['con el rol nulo', { rol: null }],
    ['con el rol en minúsculas', { rol: 'responsable_eventos' }],
    ['con un rol que no existe', { rol: 'SUPERUSUARIO' }],
    ['con el correo nulo', { email: null }],
    ['con el correo numérico', { email: 42 }],
    ['con el correo sin arroba', { email: 'franconfluens.test' }],
    ['con el correo con espacios en el medio', { email: 'fran perez@confluens.test' }],
    ['con dos arrobas', { email: 'fran@@confluens.test' }],
    ['con un correo sin dominio', { email: 'fran@' }],
  ])('%s responde 400 VALIDATION_ERROR y no crea nada', async (_caso, cambio) => {
    const respuesta = await request(app)
      .post('/api/usuarios')
      .set('Cookie', [cookieDe('GERENTE_GENERAL')])
      .send({ ...alta, ...cambio });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
    expect(crearMock).not.toHaveBeenCalled();
  });

  it('un body vacío responde 400 con un detalle por campo', async () => {
    const respuesta = await request(app)
      .post('/api/usuarios')
      .set('Cookie', [cookieDe('GERENTE_GENERAL')])
      .send({});

    expect(respuesta.status).toBe(400);
    const campos = respuesta.body.error.details.map((detalle: { campo: string }) => detalle.campo);
    expect(campos.sort()).toEqual(['contrasena', 'email', 'rol']);
  });

  it('un JSON malformado responde 400 VALIDATION_ERROR', async () => {
    const respuesta = await request(app)
      .post('/api/usuarios')
      .set('Cookie', [cookieDe('GERENTE_GENERAL')])
      .set('Content-Type', 'application/json')
      .send('{"email": "fran@confluens.test", ');

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
    expect(crearMock).not.toHaveBeenCalled();
  });

  it('el body no puede fijar el id, el estado ni el hash: solo se guardan correo, rol y hash propio', async () => {
    crearMock.mockResolvedValue(creado('fran@confluens.test', 'RESPONSABLE_EVENTOS'));

    await request(app)
      .post('/api/usuarios')
      .set('Cookie', [cookieDe('GERENTE_GENERAL')])
      .send({
        ...alta,
        id: 999,
        activo: false,
        versionSesion: 50,
        hashContrasena: 'hash-impuesto',
        creadoEn: '2000-01-01T00:00:00.000Z',
      });

    const guardado = crearMock.mock.calls[0]![0];
    expect(Object.keys(guardado).sort()).toEqual(['email', 'hashContrasena', 'rol']);
    expect(guardado.hashContrasena).not.toBe('hash-impuesto');
  });

  // El alias con + no se "limpia": ana+eventos@… es otro correo que ana@….
  it.each(['ana+eventos@confluens.test', 'a.b.c@mail.confluens.com.ar', 'X@Y.CO'])(
    'acepta el correo %s y lo guarda en minúsculas, sin tocar el alias',
    async (email) => {
      crearMock.mockResolvedValue(creado(email.toLowerCase(), 'RESPONSABLE_EVENTOS'));

      const respuesta = await request(app)
        .post('/api/usuarios')
        .set('Cookie', [cookieDe('GERENTE_GENERAL')])
        .send({ ...alta, email });

      expect(respuesta.status).toBe(201);
      expect(crearMock).toHaveBeenCalledWith(
        expect.objectContaining({ email: email.toLowerCase() }),
      );
    },
  );

  it('dos correos que difieren solo en mayúsculas o espacios son el mismo: el segundo responde 409', async () => {
    buscarPorEmailMock.mockResolvedValue({ id: 3 });

    for (const email of ['FRAN@CONFLUENS.TEST', '  fran@confluens.test  ', 'Fran@Confluens.Test']) {
      const respuesta = await request(app)
        .post('/api/usuarios')
        .set('Cookie', [cookieDe('GERENTE_GENERAL')])
        .send({ ...alta, email });
      expect(respuesta.status, email).toBe(409);
      expect(buscarPorEmailMock).toHaveBeenLastCalledWith('fran@confluens.test');
    }
    expect(crearMock).not.toHaveBeenCalled();
  });

  it('el 409 por correo repetido no revela el rol ni los datos del usuario existente', async () => {
    buscarPorEmailMock.mockResolvedValue({ id: 3 });

    const respuesta = await request(app)
      .post('/api/usuarios')
      .set('Cookie', [cookieDe('GERENTE_GENERAL')])
      .send(alta);

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.details).toBeUndefined();
    expect(JSON.stringify(respuesta.body)).not.toMatch(/"id":\s*3|hash|rol/i);
  });

  it('el alta tampoco devuelve el hash ni la versión de sesión, aunque el repositorio los devuelva', async () => {
    crearMock.mockResolvedValue({
      ...creado('fran@confluens.test', 'RESPONSABLE_EVENTOS'),
      hashContrasena: '$2b$10$secreto',
      versionSesion: 0,
    } as never);

    const respuesta = await request(app)
      .post('/api/usuarios')
      .set('Cookie', [cookieDe('GERENTE_GENERAL')])
      .send(alta);

    expect(respuesta.status).toBe(201);
    expect(JSON.stringify(respuesta.body)).not.toMatch(/secreto|hash|versionSesion/i);
    expect(Object.keys(respuesta.body.data).sort()).toEqual([
      'actualizadoEn',
      'creadoEn',
      'email',
      'id',
      'rol',
    ]);
  });

  it('el correo de más de 254 caracteres responde 400', async () => {
    const respuesta = await request(app)
      .post('/api/usuarios')
      .set('Cookie', [cookieDe('GERENTE_GENERAL')])
      .send({ ...alta, email: `${'a'.repeat(250)}@e.co` });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.details[0].campo).toBe('email');
    expect(crearMock).not.toHaveBeenCalled();
  });

  it('el ADM puede registrar cada rol del personal y ninguno es Cliente', async () => {
    for (const rol of [
      'RESPONSABLE_EVENTOS',
      'RESPONSABLE_FINANZAS',
      'GERENTE_GENERAL',
      'ADMINISTRADOR_SISTEMA',
    ] as const) {
      crearMock.mockResolvedValue(creado(`${rol}@confluens.test`, rol));
      const respuesta = await request(app)
        .post('/api/usuarios')
        .set('Cookie', [cookieDe('ADMINISTRADOR_SISTEMA')])
        .send({ ...alta, email: `${rol}@confluens.test`.toLowerCase(), rol });
      expect(respuesta.status, rol).toBe(201);
    }
  });

  it('guarda el correo en minúsculas y sin espacios', async () => {
    crearMock.mockResolvedValue(creado('fran@confluens.test', 'RESPONSABLE_EVENTOS'));

    await request(app)
      .post('/api/usuarios')
      .set('Cookie', [cookieDe('GERENTE_GENERAL')])
      .send({ ...alta, email: '  Fran@Confluens.TEST ' });

    expect(buscarPorEmailMock).toHaveBeenCalledWith('fran@confluens.test');
    expect(crearMock).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'fran@confluens.test' }),
    );
  });

  it('un correo que ya es de otro usuario (también de un cliente) responde 409 CONFLICT', async () => {
    buscarPorEmailMock.mockResolvedValue({ id: 3 });

    const respuesta = await request(app)
      .post('/api/usuarios')
      .set('Cookie', [cookieDe('GERENTE_GENERAL')])
      .send({ ...alta, email: 'FRAN@confluens.test' });

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.code).toBe('CONFLICT');
    expect(crearMock).not.toHaveBeenCalled();
  });

  it('dos altas simultáneas con el mismo correo: el índice único (P2002) responde 409, no 500', async () => {
    crearMock.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    const respuesta = await request(app)
      .post('/api/usuarios')
      .set('Cookie', [cookieDe('GERENTE_GENERAL')])
      .send(alta);

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.code).toBe('CONFLICT');
  });
});

describe('GET /api/usuarios (HU-31 del Sprint 4)', () => {
  const app = crearApp();

  beforeEach(() => {
    listarMock.mockReset();
  });

  it.each(['GERENTE_GENERAL', 'ADMINISTRADOR_SISTEMA'] as const)(
    'con sesión de %s lista el personal con correo, rol y fecha de alta, sin hash',
    async (rol) => {
      listarMock.mockResolvedValue([
        creado('re@confluens.test', 'RESPONSABLE_EVENTOS'),
        creado('gg@confluens.test', 'GERENTE_GENERAL'),
      ]);

      const respuesta = await request(app)
        .get('/api/usuarios')
        .set('Cookie', [cookieDe(rol)]);

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.data).toHaveLength(2);
      expect(respuesta.body.data[0]).toEqual({
        id: 7,
        email: 're@confluens.test',
        rol: 'RESPONSABLE_EVENTOS',
        creadoEn: FECHA.toISOString(),
        actualizadoEn: FECHA.toISOString(),
      });
      expect(listarMock).toHaveBeenCalledWith(undefined);
    },
  );

  it('filtra por rol', async () => {
    listarMock.mockResolvedValue([creado('rf@confluens.test', 'RESPONSABLE_FINANZAS')]);

    const respuesta = await request(app)
      .get('/api/usuarios?rol=RESPONSABLE_FINANZAS')
      .set('Cookie', [cookieDe('GERENTE_GENERAL')]);

    expect(respuesta.status).toBe(200);
    expect(listarMock).toHaveBeenCalledWith('RESPONSABLE_FINANZAS');
  });

  it.each([
    ['en minúsculas', 'responsable_eventos'],
    ['inexistente', 'SUPERUSUARIO'],
    ['vacío', ''],
    ['con espacios', ' GERENTE_GENERAL '],
    ['con un número', '1'],
  ])('un filtro de rol %s responde 400 y no consulta', async (_caso, rol) => {
    const respuesta = await request(app)
      .get('/api/usuarios')
      .query({ rol })
      .set('Cookie', [cookieDe('GERENTE_GENERAL')]);

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
    expect(listarMock).not.toHaveBeenCalled();
  });

  it('un filtro de rol repetido (?rol=A&rol=B) responde 400: es una lista, no un rol', async () => {
    const respuesta = await request(app)
      .get('/api/usuarios?rol=GERENTE_GENERAL&rol=RESPONSABLE_EVENTOS')
      .set('Cookie', [cookieDe('GERENTE_GENERAL')]);

    expect(respuesta.status).toBe(400);
    expect(listarMock).not.toHaveBeenCalled();
  });

  it.each([
    'RESPONSABLE_EVENTOS',
    'RESPONSABLE_FINANZAS',
    'GERENTE_GENERAL',
    'ADMINISTRADOR_SISTEMA',
  ])('el filtro por %s se pasa tal cual al repositorio', async (rol) => {
    listarMock.mockResolvedValue([]);

    const respuesta = await request(app)
      .get('/api/usuarios')
      .query({ rol })
      .set('Cookie', [cookieDe('ADMINISTRADOR_SISTEMA')]);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toEqual([]);
    expect(listarMock).toHaveBeenCalledWith(rol);
  });

  it('un listado sin usuarios responde 200 con una lista vacía', async () => {
    listarMock.mockResolvedValue([]);

    const respuesta = await request(app)
      .get('/api/usuarios')
      .set('Cookie', [cookieDe('GERENTE_GENERAL')]);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({ data: [] });
  });

  // Defensa en profundidad: la respuesta lleva solo los campos públicos, aunque el repositorio
  // devolviera de más (hoy lo evita su `select`, que tiene su propio test).
  it('nunca expone el hash ni la versión de sesión, aunque el repositorio los devuelva', async () => {
    listarMock.mockResolvedValue([
      {
        ...creado('re@confluens.test', 'RESPONSABLE_EVENTOS'),
        hashContrasena: '$2b$10$secreto',
        versionSesion: 3,
      } as never,
    ]);

    const respuesta = await request(app)
      .get('/api/usuarios')
      .set('Cookie', [cookieDe('GERENTE_GENERAL')]);

    expect(respuesta.status).toBe(200);
    expect(Object.keys(respuesta.body.data[0]).sort()).toEqual([
      'actualizadoEn',
      'creadoEn',
      'email',
      'id',
      'rol',
    ]);
    expect(JSON.stringify(respuesta.body)).not.toMatch(/secreto|hash|versionSesion/i);
  });

  it('filtrar por el rol Cliente responde 400: los clientes se consultan en Clientes', async () => {
    const respuesta = await request(app)
      .get('/api/usuarios?rol=CLIENTE')
      .set('Cookie', [cookieDe('GERENTE_GENERAL')]);

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
    expect(listarMock).not.toHaveBeenCalled();
  });

  it.each(['RESPONSABLE_EVENTOS', 'RESPONSABLE_FINANZAS', 'CLIENTE'] as const)(
    'con sesión de %s responde 403',
    async (rol) => {
      const respuesta = await request(app)
        .get('/api/usuarios')
        .set('Cookie', [cookieDe(rol)]);

      expect(respuesta.status).toBe(403);
      expect(listarMock).not.toHaveBeenCalled();
    },
  );

  it('sin sesión responde 401', async () => {
    const respuesta = await request(app).get('/api/usuarios');

    expect(respuesta.status).toBe(401);
  });
});

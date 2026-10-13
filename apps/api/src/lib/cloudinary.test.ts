import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  borrarFoto,
  borrarFotoReemplazada,
  firmaDeSubida,
  firmar,
  leerCredenciales,
  publicIdDeUrl,
} from './cloudinary.js';

const CREDENCIALES = {
  CLOUDINARY_CLOUD_NAME: 'demo',
  CLOUDINARY_API_KEY: '123456',
  CLOUDINARY_API_SECRET: 'abcd',
};

function configurarCloudinary() {
  for (const [clave, valor] of Object.entries(CREDENCIALES)) vi.stubEnv(clave, valor);
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('firmar', () => {
  // Ejemplo de la documentación de Cloudinary ("Generating authentication signatures").
  it('ordena los parámetros, les pega el secreto y aplica SHA-1', () => {
    expect(
      firmar(
        {
          timestamp: 1315060510,
          public_id: 'sample_image',
          eager: 'w_400,h_300,c_pad|w_260,h_200,c_crop',
        },
        'abcd',
      ),
    ).toBe('bfd09f95f331f558cbd1320e67aa8d488770583e');
  });
});

describe('leerCredenciales', () => {
  it('devuelve null si falta alguna de las tres variables', () => {
    expect(leerCredenciales({ CLOUDINARY_CLOUD_NAME: 'demo', CLOUDINARY_API_KEY: '1' })).toBeNull();
  });

  it('arma las credenciales con las tres variables', () => {
    expect(leerCredenciales(CREDENCIALES)).toEqual({
      cloudName: 'demo',
      apiKey: '123456',
      apiSecret: 'abcd',
    });
  });
});

describe('firmaDeSubida', () => {
  it('firma carpeta, timestamp y transformación con el secreto, sin devolverlo', () => {
    configurarCloudinary();

    const firma = firmaDeSubida('salones', new Date('2026-10-07T12:00:00.000Z'));

    expect(firma).toEqual({
      cloudName: 'demo',
      apiKey: '123456',
      timestamp: 1791374400,
      carpeta: 'confluens/salones',
      transformacion: 'c_limit,w_1920,h_1920',
      firma: firmar(
        {
          folder: 'confluens/salones',
          timestamp: 1791374400,
          transformation: 'c_limit,w_1920,h_1920',
        },
        'abcd',
      ),
    });
    expect(JSON.stringify(firma)).not.toContain('abcd');
  });

  it('sin credenciales responde 422 en desarrollo', () => {
    vi.stubEnv('CLOUDINARY_CLOUD_NAME', '');

    expect(() => firmaDeSubida('servicios')).toThrow(
      expect.objectContaining({ status: 422, codigo: 'BUSINESS_RULE_VIOLATION' }),
    );
  });
});

describe('publicIdDeUrl', () => {
  it('saca el public_id de una foto nuestra, sin versión ni extensión', () => {
    expect(
      publicIdDeUrl(
        'https://res.cloudinary.com/demo/image/upload/v1791374400/confluens/salones/abc123.jpg',
        'demo',
      ),
    ).toBe('confluens/salones/abc123');
  });

  it.each([
    ['otra cuenta', 'https://res.cloudinary.com/otra/image/upload/v1/confluens/salones/abc.jpg'],
    ['otra carpeta', 'https://res.cloudinary.com/demo/image/upload/v1/sample.jpg'],
    ['otro sitio', 'https://example.com/confluens/salones/abc.jpg'],
    ['una foto del tarifario', '/fotos/evento.jpg'],
  ])('devuelve null con %s', (_caso, url) => {
    expect(publicIdDeUrl(url, 'demo')).toBeNull();
  });
});

describe('borrarFoto', () => {
  it('manda el destroy firmado de una foto nuestra', async () => {
    configurarCloudinary();
    const fetchMock = vi.fn(async () => new Response('{"result":"ok"}'));
    vi.stubGlobal('fetch', fetchMock);

    await borrarFoto('https://res.cloudinary.com/demo/image/upload/v1/confluens/salones/abc.jpg');

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, opciones] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.cloudinary.com/v1_1/demo/image/destroy');
    const cuerpo = opciones.body as URLSearchParams;
    expect(cuerpo.get('public_id')).toBe('confluens/salones/abc');
    expect(cuerpo.get('api_key')).toBe('123456');
    expect(cuerpo.get('signature')).toBe(
      firmar(
        { public_id: 'confluens/salones/abc', timestamp: Number(cuerpo.get('timestamp')) },
        'abcd',
      ),
    );
  });

  it('no llama a Cloudinary con una foto que no es nuestra', async () => {
    configurarCloudinary();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await borrarFoto('https://example.com/foto.jpg');

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('borrarFotoReemplazada', () => {
  it('borra la anterior cuando cambia o se quita', async () => {
    const borrar = vi.fn(async () => {});

    await borrarFotoReemplazada('https://vieja', 'https://nueva', borrar);
    await borrarFotoReemplazada('https://vieja', null, borrar);

    expect(borrar).toHaveBeenNthCalledWith(1, 'https://vieja');
    expect(borrar).toHaveBeenNthCalledWith(2, 'https://vieja');
  });

  it('no borra si no había foto, si es la misma o si el pedido no tocaba la foto', async () => {
    const borrar = vi.fn(async () => {});

    await borrarFotoReemplazada(null, 'https://nueva', borrar);
    await borrarFotoReemplazada('https://misma', 'https://misma', borrar);
    await borrarFotoReemplazada('https://vieja', undefined, borrar);

    expect(borrar).not.toHaveBeenCalled();
  });

  it('si Cloudinary falla, no propaga el error: el cambio ya quedó guardado', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const borrar = vi.fn(async () => {
      throw new Error('Cloudinary caído');
    });

    await expect(
      borrarFotoReemplazada('https://vieja', 'https://nueva', borrar),
    ).resolves.toBeUndefined();
  });
});

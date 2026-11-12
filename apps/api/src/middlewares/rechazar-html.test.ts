import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

import { ErrorApi } from '../lib/errores.js';
import { rechazarHtml } from './rechazar-html.js';

// Corre el middleware con un body y devuelve lo que le pasó a next(): nada si dejó pasar, o el
// ErrorApi 400 con el detalle de cada campo.
function correr(body: unknown) {
  const next = vi.fn();
  rechazarHtml({ body } as Request, {} as Response, next);
  expect(next).toHaveBeenCalledTimes(1);
  return next.mock.calls[0]![0] as ErrorApi | undefined;
}

const camposRechazados = (body: unknown) => {
  const error = correr(body);
  expect(error).toBeInstanceOf(ErrorApi);
  expect(error!.status).toBe(400);
  expect(error!.codigo).toBe('VALIDATION_ERROR');
  return error!.detalles!.map((detalle) => detalle.campo);
};

describe('rechazarHtml', () => {
  it('deja pasar un body sin marcado', () => {
    expect(
      correr({ nombre: 'Marina', observacion: 'Seña 20% — pagó "en mano" 💰' }),
    ).toBeUndefined();
  });

  it('deja pasar lo que no es un objeto con textos: vacío, números, null', () => {
    for (const body of [undefined, null, {}, [], { monto: 1000, activo: true, nota: null }]) {
      expect(correr(body), JSON.stringify(body)).toBeUndefined();
    }
  });

  it('rechaza una etiqueta y dice en qué campo está', () => {
    expect(camposRechazados({ nombre: 'Marina', observacion: '<b>hola</b>' })).toEqual([
      'observacion',
    ]);
  });

  it('nombra los campos anidados con puntos, igual que los errores de Zod', () => {
    expect(camposRechazados({ cliente: { nombre: '<i>x</i>' } })).toEqual(['cliente.nombre']);
  });

  it('nombra los elementos de una lista con el índice entre puntos, no entre corchetes', () => {
    const campos = camposRechazados({
      adicionales: [
        { descripcion: 'Flores', precioUnitario: '100' },
        { descripcion: '<script>x</script>', precioUnitario: '100' },
      ],
    });

    expect(campos).toEqual(['adicionales.1.descripcion']);
  });

  it('nombra una lista de textos y una lista dentro de otra', () => {
    expect(camposRechazados({ notas: ['ok', '<b>mal</b>'] })).toEqual(['notas.1']);
    expect(camposRechazados({ filas: [['ok'], ['ok', '<b>mal</b>']] })).toEqual(['filas.1.1']);
  });

  it('si el body mismo es una lista, el primer nivel es el índice', () => {
    expect(camposRechazados(['ok', '<b>mal</b>'])).toEqual(['1']);
  });

  it('informa todos los campos con marcado, no solo el primero', () => {
    const campos = camposRechazados({ a: '<b>1</b>', b: 'limpio', c: { d: '&amp;' } });

    expect(campos).toEqual(['a', 'c.d']);
  });

  it('rechaza las entidades HTML (&amp;, &#60;, &lt;)', () => {
    for (const texto of ['a &amp; b', 'a &#60; b', 'a &#x3c; b', 'a &lt; b']) {
      expect(camposRechazados({ texto }), texto).toEqual(['texto']);
    }
  });

  it('deja pasar el & suelto', () => {
    expect(correr({ texto: 'Cheque & vale' })).toBeUndefined();
  });

  it('el mensaje de cada detalle es el mismo para todos los campos', () => {
    const error = correr({ a: '<b>', b: '<i>' })!;

    expect(error.detalles).toEqual([
      { campo: 'a', mensaje: 'No se admite HTML en este campo' },
      { campo: 'b', mensaje: 'No se admite HTML en este campo' },
    ]);
  });
});

// Qué cuenta como marcado (PO, 08/11/2026). Solo lo que un navegador leería como etiqueta: un `<`
// suelto es texto, y `<!` y `<?` también se cortan porque sirven para tapar el HTML que sigue.
describe('rechazarHtml — qué se considera marcado', () => {
  const rechaza = (texto: string) => correr({ texto }) !== undefined;

  it.each([
    'Juan <juan@x.com>',
    'a < b',
    'pagó < 50%',
    '5 <3 corazón',
    '<3',
    'x < y y > z',
    'Cheque & vale',
    'precio > 100 y < 200',
    '<1',
    '< 5',
    'texto con > suelto',
  ])('deja pasar el texto "%s": no es una etiqueta', (texto) => {
    expect(rechaza(texto)).toBe(false);
  });

  it.each([
    '<b>hola</b>',
    '</p>',
    '<script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    '<img/src=x onerror=alert(1)>',
    '<svg\nonload=alert(1)>',
    '<IMG SRC=x>',
    '<a href="http://malo.com">click</a>',
    '<my-widget>',
    '<br/>',
    '<br />',
    '<iframe src=javascript:alert(1)>',
    '<body onload=alert(1)>',
    '<style>*{}</style>',
    '2 menús <b>veganos</b>',
  ])('rechaza la etiqueta "%s"', (texto) => {
    expect(rechaza(texto)).toBe(true);
  });

  // Una etiqueta sin cerrar al final del texto es peligrosa: si lo guardado se pega en una plantilla,
  // el `>` de lo que viene después la cierra y la ejecuta (`<img src=x onerror=alert(1)` + `</p>`).
  // Por eso un `<` pegado a una letra al final del texto se rechaza, y el costo es que `a<b` sin
  // espacios se ve igual que la etiqueta `<b` sin cerrar. Con espacios («a < b») pasa.
  it.each([
    '<script',
    'texto <script',
    'texto </div',
    '<img',
    '<p',
    '<img src=x onerror=alert(1)',
    'a<b',
  ])('rechaza una etiqueta sin cerrar al final del texto ("%s")', (texto) => {
    expect(rechaza(texto)).toBe(true);
  });

  it.each(['<!-- comentario', '<!DOCTYPE html>', '<![CDATA[x]]>', '<?php echo 1; ?>', 'a <!-- b'])(
    'rechaza los comentarios y las instrucciones ("%s"), que el patrón anterior dejaba pasar',
    (texto) => {
      expect(rechaza(texto)).toBe(true);
    },
  );

  it('encuentra la etiqueta aunque esté en medio de un texto largo', () => {
    expect(rechaza(`${'palabra '.repeat(500)}<script>x</script>`)).toBe(true);
  });

  it('no se cuelga con un texto enorme de signos < (sin retroceso exponencial)', () => {
    const inicio = Date.now();

    expect(rechaza('<'.repeat(100_000))).toBe(false);
    expect(rechaza(`${'<a'.repeat(50_000)}`)).toBe(true);
    expect(Date.now() - inicio).toBeLessThan(1000);
  });
});

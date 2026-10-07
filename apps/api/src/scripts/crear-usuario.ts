// Crea (o actualiza) un usuario del personal pidiendo los datos por la terminal. Existe para la base
// de Neon, donde no se corre el seed con los usuarios de prueba: así la contraseña nunca queda
// escrita en el código ni en el historial de la shell, y en la base solo se guarda el hash (HU-27).
//
// Uso, desde la raíz del monorepo:
//   npm run usuario:crear -w @confluens/api                  → usa .env (base local)
//   npm run usuario:crear -w @confluens/api -- .env.neon     → usa ese archivo (ruta desde la raíz)
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

import type { Rol } from '@confluens/shared';
import { z } from 'zod';

// CLIENTE queda afuera: los clientes se registran desde el canal público y necesitan su Cliente.
const ROLES_PERSONAL: Exclude<Rol, 'CLIENTE'>[] = [
  'RESPONSABLE_EVENTOS',
  'RESPONSABLE_FINANZAS',
  'GERENTE_GENERAL',
  'ADMINISTRADOR_SISTEMA',
];

// Mismo mínimo que el registro del canal público (esquemaRegistroCliente en packages/shared).
const LARGO_MINIMO_CONTRASENA = 6;

const raizMonorepo = fileURLToPath(new URL('../../../../', import.meta.url));
const archivoEntorno = resolve(raizMonorepo, process.argv[2] ?? '.env');

// Lee una línea sin mostrar lo que se escribe. Solo funciona en una terminal interactiva, a
// propósito: no se aceptan contraseñas por pipe para que no terminen en scripts o en el historial.
function leerOculto(pregunta: string): Promise<string> {
  return new Promise((resolver, rechazar) => {
    const entrada = process.stdin;
    process.stdout.write(pregunta);
    entrada.setRawMode(true);
    entrada.resume();
    entrada.setEncoding('utf8');
    let valor = '';

    const alTeclear = (teclas: string) => {
      for (const tecla of teclas) {
        if (tecla === '\r' || tecla === '\n') {
          terminar();
          process.stdout.write('\n');
          resolver(valor);
          return;
        }
        if (tecla === '\u0003') {
          terminar();
          process.stdout.write('\n');
          rechazar(new Error('Cancelado.'));
          return;
        }
        if (tecla === '\u007f' || tecla === '\b') {
          valor = valor.slice(0, -1);
        } else {
          valor += tecla;
        }
      }
    };
    const terminar = () => {
      entrada.off('data', alTeclear);
      entrada.setRawMode(false);
      entrada.pause();
    };
    entrada.on('data', alTeclear);
  });
}

async function main(): Promise<void> {
  if (!process.stdin.isTTY) {
    throw new Error('Este script se corre en una terminal interactiva.');
  }
  if (!existsSync(archivoEntorno)) {
    throw new Error(`No existe el archivo de entorno ${archivoEntorno}.`);
  }
  process.loadEnvFile(archivoEntorno);
  const urlBase = process.env['DATABASE_URL'];
  if (!urlBase) {
    throw new Error(`${archivoEntorno} no define DATABASE_URL.`);
  }
  console.log(`Base de destino: ${new URL(urlBase).host} (${archivoEntorno})\n`);

  // Import dinámico: lib/prisma.ts lee DATABASE_URL al cargarse, después de loadEnvFile.
  const { prisma } = await import('../lib/prisma.js');
  const { hashearContrasena } = await import('../lib/contrasena.js');
  const consola = createInterface({ input: process.stdin, output: process.stdout });
  let consolaAbierta = true;
  const cerrarConsola = () => {
    if (consolaAbierta) {
      consola.close();
      consolaAbierta = false;
    }
  };

  try {
    const email = (await consola.question('Email: ')).trim().toLowerCase();
    if (!z.email().safeParse(email).success) {
      throw new Error('El email no es válido.');
    }

    ROLES_PERSONAL.forEach((rol, i) => console.log(`  ${i + 1}. ${rol}`));
    const opcion = Number(await consola.question('Rol (número): '));
    const rol = ROLES_PERSONAL[opcion - 1];
    if (!rol) {
      throw new Error('Rol inválido.');
    }

    const existente = await prisma.usuario.findUnique({ where: { email } });
    if (existente) {
      if (existente.rol === 'CLIENTE') {
        throw new Error(
          'Ese email pertenece a un cliente; no se convierte en usuario del personal.',
        );
      }
      const respuesta = await consola.question(
        `Ya existe con rol ${existente.rol}. ¿Reemplazar su rol y contraseña? (s/N): `,
      );
      if (respuesta.trim().toLowerCase() !== 's') {
        console.log('Sin cambios.');
        return;
      }
    }

    // readline se cierra antes de pasar stdin a modo crudo: abierto, repetiría en pantalla lo que
    // se escribe y mostraría la contraseña.
    cerrarConsola();
    const contrasena = await leerOculto('Contraseña: ');
    if (contrasena.length < LARGO_MINIMO_CONTRASENA) {
      throw new Error(`La contraseña debe tener al menos ${LARGO_MINIMO_CONTRASENA} caracteres.`);
    }
    if ((await leerOculto('Repetir contraseña: ')) !== contrasena) {
      throw new Error('Las contraseñas no coinciden.');
    }

    const hashContrasena = await hashearContrasena(contrasena);
    await prisma.usuario.upsert({
      where: { email },
      create: { email, rol, hashContrasena },
      update: { rol, hashContrasena },
    });
    console.log(`${existente ? 'Actualizado' : 'Creado'}: ${email} (${rol}).`);
  } finally {
    cerrarConsola();
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

import { describe, expect, it } from 'vitest';

import type { Rol } from '../esquemas/usuario.esquema.js';
import {
  puedeCambiarFotos,
  puedePublicarEnLanding,
  type SeccionConfiguracion,
  veSeccion,
} from './permisos.js';

const GG = 'GERENTE_GENERAL';
const ADM = 'ADMINISTRADOR_SISTEMA';
const RE = 'RESPONSABLE_EVENTOS';
const RF = 'RESPONSABLE_FINANZAS';

// La tabla «Configuración de negocio por rol» de dominio.md. «Landing y fotos» la ve el GG porque
// puede cambiar las fotos, aunque no publicar. La auditoría es de GG y ADM.
const SECCIONES_POR_ROL: Record<SeccionConfiguracion, Rol[]> = {
  salones: [GG, ADM, RE, RF],
  servicios: [GG, ADM, RE, RF],
  medios: [GG, ADM, RF],
  landing: [GG, ADM],
  personal: [GG, ADM],
  auditoria: [GG, ADM],
};

describe('secciones de Configuración de negocio por rol (HU-56)', () => {
  const todos: Rol[] = [GG, ADM, RE, RF, 'CLIENTE'];

  it.each(Object.entries(SECCIONES_POR_ROL) as [SeccionConfiguracion, Rol[]][])(
    '%s la ven solo %j',
    (seccion, roles) => {
      for (const rol of todos) {
        expect(veSeccion(rol, seccion), `${rol} en ${seccion}`).toBe(roles.includes(rol));
      }
    },
  );

  it('el Cliente no ve ninguna sección', () => {
    for (const seccion of Object.keys(SECCIONES_POR_ROL) as SeccionConfiguracion[]) {
      expect(veSeccion('CLIENTE', seccion)).toBe(false);
    }
  });
});

describe('landing: fotos y publicación (dominio.md, «Roles»)', () => {
  it('las fotos las cambian el GG y el ADM', () => {
    expect(puedeCambiarFotos(GG)).toBe(true);
    expect(puedeCambiarFotos(ADM)).toBe(true);
    expect(puedeCambiarFotos(RE)).toBe(false);
    expect(puedeCambiarFotos(RF)).toBe(false);
    expect(puedeCambiarFotos('CLIENTE')).toBe(false);
  });

  it('qué se publica lo decide solo el ADM', () => {
    expect(puedePublicarEnLanding(ADM)).toBe(true);
    expect(puedePublicarEnLanding(GG)).toBe(false);
    expect(puedePublicarEnLanding(RE)).toBe(false);
    expect(puedePublicarEnLanding(RF)).toBe(false);
    expect(puedePublicarEnLanding('CLIENTE')).toBe(false);
  });
});

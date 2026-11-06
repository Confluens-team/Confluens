import { describe, expect, it } from 'vitest';

import { administraPersonal, puedeAsignarRol, rolesQueAsigna } from './personal.js';

describe('quién asigna qué rol (dominio.md, «Personal»)', () => {
  it('el ADM asigna cualquier rol del personal', () => {
    expect(rolesQueAsigna('ADMINISTRADOR_SISTEMA')).toEqual([
      'RESPONSABLE_EVENTOS',
      'RESPONSABLE_FINANZAS',
      'GERENTE_GENERAL',
      'ADMINISTRADOR_SISTEMA',
    ]);
    expect(puedeAsignarRol('ADMINISTRADOR_SISTEMA', 'ADMINISTRADOR_SISTEMA')).toBe(true);
  });

  it('el GG asigna GG, RE y RF, pero no ADM', () => {
    expect(puedeAsignarRol('GERENTE_GENERAL', 'GERENTE_GENERAL')).toBe(true);
    expect(puedeAsignarRol('GERENTE_GENERAL', 'RESPONSABLE_EVENTOS')).toBe(true);
    expect(puedeAsignarRol('GERENTE_GENERAL', 'RESPONSABLE_FINANZAS')).toBe(true);
    expect(puedeAsignarRol('GERENTE_GENERAL', 'ADMINISTRADOR_SISTEMA')).toBe(false);
  });

  it.each(['RESPONSABLE_EVENTOS', 'RESPONSABLE_FINANZAS', 'CLIENTE'] as const)(
    '%s no asigna ningún rol ni administra al personal',
    (rol) => {
      expect(rolesQueAsigna(rol)).toEqual([]);
      expect(puedeAsignarRol(rol, 'RESPONSABLE_EVENTOS')).toBe(false);
      expect(administraPersonal(rol)).toBe(false);
    },
  );

  it('el GG y el ADM administran al personal', () => {
    expect(administraPersonal('GERENTE_GENERAL')).toBe(true);
    expect(administraPersonal('ADMINISTRADOR_SISTEMA')).toBe(true);
  });
});

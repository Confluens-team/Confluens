import { describe, expect, it } from 'vitest';

import { esBaseLocal } from './base-local.js';

describe('esBaseLocal', () => {
  it('reconoce la base de docker-compose', () => {
    expect(esBaseLocal('postgresql://confluens:clave@localhost:5432/confluens?schema=public')).toBe(
      true,
    );
    expect(esBaseLocal('postgresql://confluens:clave@127.0.0.1:5433/confluens')).toBe(true);
    expect(esBaseLocal('postgresql://confluens:clave@[::1]:5432/confluens')).toBe(true);
  });

  it('una base de Neon no es local, con pooling o sin él', () => {
    expect(esBaseLocal('postgresql://u:clave@ep-algo-pooler.sa-east-1.aws.neon.tech/neondb')).toBe(
      false,
    );
    expect(esBaseLocal('postgresql://u:clave@ep-algo.sa-east-1.aws.neon.tech/neondb')).toBe(false);
  });

  it('un host que solo empieza o termina como uno local no es local', () => {
    expect(esBaseLocal('postgresql://u:clave@localhost.ejemplo.com:5432/base')).toBe(false);
    expect(esBaseLocal('postgresql://u:clave@no-es-localhost:5432/base')).toBe(false);
  });

  it('sin URL, o con una mal formada, no es local', () => {
    expect(esBaseLocal(undefined)).toBe(false);
    expect(esBaseLocal('')).toBe(false);
    expect(esBaseLocal('no es una url')).toBe(false);
  });
});

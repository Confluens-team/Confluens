import { describe, expect, it, vi } from 'vitest';

const updateMany = vi.fn();

vi.mock('../lib/prisma.js', () => ({ prisma: { presupuesto: { updateMany } } }));

const { controlarVigencia } = await import('./vigencia.trabajo.js');

describe('controlarVigencia (HU-10, RN-08)', () => {
  it('pasa a Expirado solo los Estimado con la vigencia vencida, sin tocar el evento', async () => {
    updateMany.mockResolvedValue({ count: 2 });
    const ahora = new Date('2026-10-05T12:00:00.000Z');

    const expirados = await controlarVigencia(ahora);

    expect(expirados).toBe(2);
    expect(updateMany).toHaveBeenCalledOnce();
    expect(updateMany).toHaveBeenCalledWith({
      where: { estado: 'Estimado', venceEn: { lt: ahora } },
      data: { estado: 'Expirado' },
    });
  });
});

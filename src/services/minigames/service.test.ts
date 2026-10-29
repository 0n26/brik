import { describe, expect, test } from 'bun:test';
import { createTestDatabase } from '../../core/testing.ts';
import service, { type MinigamesApi } from './service.ts';

const logger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };

async function initApi(): Promise<{ api: MinigamesApi; db: ReturnType<typeof createTestDatabase> }> {
  const db = createTestDatabase();
  await db.collection('wallet').insert({
    userId: 'u1',
    astrite: 100,
    tide: 0,
    stellarGlitter: 0,
  });
  const api = (await service.init({
    options: undefined,
    logger,
    memory: {} as never,
    db,
  })) as MinigamesApi;
  return { api, db };
}

describe('minigames service', () => {
  test('идентифицируется как minigames', () => {
    expect(service.name).toBe('minigames');
  });

  test('claimDailyLogin выдаёт серию', async () => {
    const { api } = await initApi();
    const result = await api.claimDailyLogin('u1');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.streak).toBeGreaterThanOrEqual(1);
  });

  test('playDice уважает дневной лимит', async () => {
    const { api } = await initApi();
    expect((await api.playDice('u1')).ok).toBe(true);
    expect((await api.playDice('u1')).ok).toBe(true);
    expect((await api.playDice('u1')).ok).toBe(true);
    const fourth = await api.playDice('u1');
    expect(fourth.ok).toBe(false);
  });

  test('getGameStats возвращает прогресс дня', async () => {
    const { api } = await initApi();
    await api.playDice('u1');
    const stats = await api.getGameStats('u1');
    expect(stats?.gamesPlayed).toBe(1);
  });
});

import { describe, expect, test } from 'bun:test';
import type { ServiceMap } from '../../core/index.ts';
import { createTestDatabase, runHandler } from '../../core/testing.ts';
import minigamesService, { type MinigamesApi } from '../../services/minigames/service.ts';
import module from './module.ts';

async function withMinigames() {
  const db = createTestDatabase();
  const minigames = (await minigamesService.init({
    options: undefined,
    logger: { debug() {}, info() {}, warn() {}, error() {} },
    memory: {} as never,
    db,
  })) as MinigamesApi;
  return { db, minigames };
}

function services(minigames: MinigamesApi): ServiceMap {
  return { minigames } as ServiceMap;
}

describe('модуль minigames', () => {
  test('/minigames показывает меню', async () => {
    const { db, minigames } = await withMinigames();
    const handler = module.handlers.find((h) => h.name === 'minigames')!;
    const result = await runHandler(handler, {
      services: services(minigames),
      db,
      input: {
        commandName: 'minigames',
        args: {},
        author: { id: 'u1', username: 'T' },
        channel: { id: 'c1', guildId: 'g1' },
      },
    });
    expect(result.kind).toBe('embed');
    if (result.kind === 'embed') {
      expect(result.embed.title).toContain('Мини-игры');
    }
  });

  test('/minigame dice возвращает результат', async () => {
    const { db, minigames } = await withMinigames();
    await db.collection('wallet').insert({
      userId: 'u1',
      astrite: 0,
      tide: 0,
      stellarGlitter: 0,
    });
    const handler = module.handlers.find((h) => h.name === 'minigame')!;
    const result = await runHandler(handler, {
      args: { game: 'dice' },
      services: services(minigames),
      db,
      input: {
        commandName: 'minigame',
        args: { game: 'dice' },
        author: { id: 'u1', username: 'T' },
        channel: { id: 'c1', guildId: 'g1' },
      },
    });
    expect(result.kind === 'embed' || result.kind === 'message').toBe(true);
  });

  test('/daily-login выдаёт награду', async () => {
    const { db, minigames } = await withMinigames();
    await db.collection('wallet').insert({
      userId: 'u1',
      astrite: 0,
      tide: 0,
      stellarGlitter: 0,
    });
    const handler = module.handlers.find((h) => h.name === 'daily-login')!;
    const result = await runHandler(handler, {
      services: services(minigames),
      db,
      input: {
        commandName: 'daily-login',
        args: {},
        author: { id: 'u1', username: 'T' },
        channel: { id: 'c1', guildId: 'g1' },
      },
    });
    expect(result.kind).toBe('embed');
  });
});

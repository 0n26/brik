import { describe, expect, test } from 'bun:test';
import { runHandler } from '../../core/testing.ts';
import gachaService from '../../services/gacha/service.ts';
import module from './module.ts';

describe('модуль gacha', () => {
  test('/daily отвечает при подключённом сервисе', async () => {
    const db = (await import('../../core/testing.ts')).createTestDatabase();
    const ctx = (await import('../../core/testing.ts')).createContext({ db });
    const gacha = await gachaService.init({ options: {}, logger: ctx.logger, memory: ctx.memory, db });
    const handler = module.handlers.find((h) => h.name === 'daily')!;
    const result = await runHandler(handler, {
      services: { gacha: gacha as any, shikimori: {} as any, weather: {} as any },
      db,
      input: { ...ctx.input, author: { id: 'mod-test-user', username: 'T' } },
    });
    expect(result.kind).toBe('embed');
  });

  test('/banner показывает embed', async () => {
    const db = (await import('../../core/testing.ts')).createTestDatabase();
    const ctx = (await import('../../core/testing.ts')).createContext({ db });
    const gacha = await gachaService.init({ options: {}, logger: ctx.logger, memory: ctx.memory, db });
    const handler = module.handlers.find((h) => h.name === 'banner')!;
    const result = await runHandler(handler, { services: { gacha: gacha as any, shikimori: {} as any, weather: {} as any }, db });
    expect(result.kind).toBe('embed');
  });
});

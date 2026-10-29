import { describe, expect, test } from 'bun:test';
import type { ServiceMap } from '../../core/index.ts';
import { createTestDatabase, runHandler } from '../../core/testing.ts';
import weaponsService, { type WeaponsApi } from '../../services/weapons/service.ts';
import module from './module.ts';

async function withWeapons() {
  const db = createTestDatabase();
  const weapons = (await weaponsService.init({
    options: undefined,
    logger: { debug() {}, info() {}, warn() {}, error() {} },
    memory: {} as never,
    db,
  })) as WeaponsApi;
  return { db, weapons };
}

function services(weapons: WeaponsApi): ServiceMap {
  return { weapons } as ServiceMap;
}

describe('модуль weapons', () => {
  test('/weapons показывает пустой список', async () => {
    const { db, weapons } = await withWeapons();
    const handler = module.handlers.find((h) => h.name === 'weapons')!;
    const result = await runHandler(handler, {
      services: services(weapons),
      db,
      input: {
        commandName: 'weapons',
        args: {},
        author: { id: 'u1', username: 'T' },
        channel: { id: 'c1', guildId: 'g1' },
      },
    });
    expect(result.kind).toBe('embed');
    if (result.kind === 'embed') {
      expect(result.embed.description).toContain('не найдено');
    }
  });

  test('/weapons показывает каталог', async () => {
    const { db, weapons } = await withWeapons();
    await db.collection('weapons').insert({
      id: 'w1',
      name: 'Клинок',
      description: 'Тест',
      rarity: 4,
      type: 'sword',
      baseAttack: 42,
      secondaryStat: { type: 'crit', value: 1 },
      enabled: true,
    });
    const handler = module.handlers.find((h) => h.name === 'weapons')!;
    const result = await runHandler(handler, {
      services: services(weapons),
      db,
      input: {
        commandName: 'weapons',
        args: {},
        author: { id: 'u1', username: 'T' },
        channel: { id: 'c1', guildId: 'g1' },
      },
    });
    expect(result.kind).toBe('embed');
    if (result.kind === 'embed') {
      expect(result.embed.description).toContain('Клинок');
    }
  });

  test('/weapon inventory отвечает на пустой инвентарь', async () => {
    const { db, weapons } = await withWeapons();
    const handler = module.handlers.find((h) => h.name === 'weapon')!;
    const result = await runHandler(handler, {
      args: { action: 'inventory' },
      services: services(weapons),
      db,
      input: {
        commandName: 'weapon',
        args: { action: 'inventory' },
        author: { id: 'u1', username: 'T' },
        channel: { id: 'c1', guildId: 'g1' },
      },
    });
    expect(result.kind).toBe('embed');
    if (result.kind === 'embed') {
      expect(result.embed.description).toContain('empty');
    }
  });
});

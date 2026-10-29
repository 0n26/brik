import { describe, expect, test } from 'bun:test';
import { createTestDatabase } from '../../core/testing.ts';
import service, { type WeaponsApi } from './service.ts';

const logger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };

async function initApi(): Promise<{ api: WeaponsApi; db: ReturnType<typeof createTestDatabase> }> {
  const db = createTestDatabase();
  const api = (await service.init({
    options: undefined,
    logger,
    memory: {} as never,
    db,
  })) as WeaponsApi;
  return { api, db };
}

describe('weapons service', () => {
  test('идентифицируется как weapons', () => {
    expect(service.name).toBe('weapons');
  });

  test('listAvailable фильтрует disabled', async () => {
    const { api, db } = await initApi();
    await db.collection('weapons').insert({
      id: 'on',
      name: 'On',
      description: '',
      rarity: 4,
      type: 'sword',
      baseAttack: 10,
      secondaryStat: { type: 'atk', value: 1 },
      enabled: true,
    });
    await db.collection('weapons').insert({
      id: 'off',
      name: 'Off',
      description: '',
      rarity: 3,
      type: 'sword',
      baseAttack: 5,
      secondaryStat: { type: 'atk', value: 1 },
      enabled: false,
    });
    const list = await api.listAvailable();
    expect(list.map((w) => w.id)).toEqual(['on']);
  });

  test('equipWeapon требует кошелёк и оружие', async () => {
    const { api } = await initApi();
    const missingWallet = await api.equipWeapon('u1', 'char1', 'weapon', 'missing');
    expect(missingWallet.ok).toBe(false);
  });

  test('equipWeapon экипирует при достаточном балансе', async () => {
    const { api, db } = await initApi();
    await db.collection('wallet').insert({
      userId: 'u1',
      astrite: 500,
      tide: 0,
      stellarGlitter: 0,
    });
    await db.collection('weapons').insert({
      id: 'blade',
      name: 'Blade',
      description: '',
      rarity: 4,
      type: 'sword',
      baseAttack: 20,
      secondaryStat: { type: 'atk', value: 1 },
      enabled: true,
      upgradeCost: 100,
    });
    const result = await api.equipWeapon('u1', 'char1', 'weapon', 'blade');
    expect(result.ok).toBe(true);
    const equipped = await api.getPlayerWeapon('u1', 'char1', 'weapon');
    expect(equipped?.weaponId).toBe('blade');
  });

  test('discardWeapon удаляет из инвентаря', async () => {
    const { api, db } = await initApi();
    await db.collection('player_weapons').insert({
      userId: 'u1',
      weaponId: 'blade',
      level: 1,
      obtainedAt: new Date().toISOString(),
    });
    expect((await api.discardWeapon('u1', 'blade')).ok).toBe(true);
    expect(await api.getWeapon('u1', 'blade')).toBeNull();
  });
});

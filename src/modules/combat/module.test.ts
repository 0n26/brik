import { describe, expect, test } from 'bun:test';
import { runHandler } from '../../core/testing.ts';
import type { ServiceMap } from '../../core/index.ts';
import combatService, { type CombatApi } from '../../services/combat/service.ts';
import module from './module.ts';

async function withCombat(): Promise<CombatApi> {
  return (await combatService.init({
    options: undefined,
    logger: { debug() {}, info() {}, warn() {}, error() {} },
    memory: {} as never,
    db: {} as never,
  })) as CombatApi;
}

function services(combat: CombatApi): ServiceMap {
  return { combat } as ServiceMap;
}

describe('модуль combat', () => {
  test('/combat показывает меню', async () => {
    const handler = module.handlers.find((h) => h.name === 'combat')!;
    const result = await runHandler(handler, { args: {} });
    expect(result.kind).toBe('embed');
    if (result.kind === 'embed') {
      expect(result.embed.title).toContain('Система боев');
    }
  });

  test('/combat-start начинает бой', async () => {
    const combat = await withCombat();
    const handler = module.handlers.find((h) => h.name === 'combat-start')!;
    const result = await runHandler(handler, {
      args: { player_count: 1, enemy_count: 2 },
      services: services(combat),
    });
    expect(result.kind).toBe('embed');
    if (result.kind === 'embed') {
      expect(result.embed.title).toContain('Бой начат');
      expect(result.embed.description).toContain('1 игроков против 2 врагов');
    }
  });

  test('/combat-action выполняет действие', async () => {
    const combat = await withCombat();
    const handler = module.handlers.find((h) => h.name === 'combat-action')!;
    const result = await runHandler(handler, {
      args: { action: 'attack', target: 'enemy1' },
      services: services(combat),
    });
    expect(result.kind).toBe('embed');
    if (result.kind === 'embed') {
      expect(result.embed.title).toContain('Действие');
      expect(result.embed.description).toContain('attack');
    }
  });
});

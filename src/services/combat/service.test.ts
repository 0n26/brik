import { describe, expect, it } from 'bun:test';
import service, { type CombatApi } from './service.ts';

const logger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };

const initApi = async (): Promise<CombatApi> =>
  await service.init({ options: {} as any, logger, memory: {} } as never) as CombatApi;

describe('combat service', () => {
  it('identifies as combat', () => {
    expect(service.name).toBe('combat');
  });

  it('calculateStats returns valid stats', async () => {
    const combat = await initApi();
    const stats = combat.calculateStats('test', 1, 5, 100);
    expect(stats.id).toBe('test');
    expect(stats.hp).toBeGreaterThan(0);
    expect(stats.atk).toBeGreaterThan(0);
    expect(stats.def).toBeGreaterThan(0);
    expect(stats.speed).toBeGreaterThan(0);
  });

  it('calculateDamage returns valid damage', async () => {
    const combat = await initApi();
    const attacker = combat.calculateStats('attacker', 1, 5, 100);
    const defender = combat.calculateStats('defender', 1, 5, 0);
    const damage = combat.calculateDamage(attacker, defender, 1.0);
    expect(damage.finalDamage).toBeGreaterThanOrEqual(0);
  });

  it('calculateTurnOrder returns sorted order', async () => {
    const combat = await initApi();
    const chars = [
      combat.calculateStats('slow', 1, 5, 0),
      combat.calculateStats('fast', 10, 5, 0),
    ];
    const order = combat.calculateTurnOrder(chars);
    expect(order).toEqual(['fast', 'slow']);
  });

  it('startBattle creates valid state', async () => {
    const combat = await initApi();
    const player = combat.calculateStats('player', 1, 5, 100);
    const enemy = combat.calculateStats('enemy', 5, 3, 20);
    const state = combat.startBattle([player], [enemy]);
    expect(state.turn).toBe(0);
    expect(state.attackerId).toBeDefined();
    expect(state.playerChars.length).toBe(1);
    expect(state.enemyChars.length).toBe(1);
  });

  it('nextTurn advances turn', async () => {
    const combat = await initApi();
    const player = combat.calculateStats('player', 1, 5, 100);
    const enemy = combat.calculateStats('enemy', 5, 3, 20);
    const state = combat.startBattle([player], [enemy]);
    const newState = combat.nextTurn(state);
    expect(newState.turn).toBe(1);
    expect(newState.attackerId).toBeDefined();
  });

  it('executeAction performs attack', async () => {
    const combat = await initApi();
    const player = combat.calculateStats('player', 1, 5, 100);
    const enemy = combat.calculateStats('enemy', 5, 3, 20);
    const state = combat.startBattle([player], [enemy]);
    const { state: newState, result } = combat.executeAction(state, 'player', 'attack');
    expect(newState.turn).toBe(1);
    expect('finalDamage' in result ? result.finalDamage : result.healAmount).toBeGreaterThan(0);
  });

  it('executeAction performs heal', async () => {
    const combat = await initApi();
    const player = combat.calculateStats('player', 1, 5, 100);
    const enemy = combat.calculateStats('enemy', 5, 3, 20);
    const state = combat.startBattle([player], [enemy]);
    const { result } = combat.executeAction(state, 'player', 'heal');
    if ('healAmount' in result) {
      expect(result.healAmount).toBeGreaterThan(0);
    } else {
      throw new Error('Expected heal result');
    }
  });

  it('isBattleOver detects winner', async () => {
    const combat = await initApi();
    const player = combat.calculateStats('player', 1, 5, 100);
    const enemy = combat.calculateStats('enemy', 5, 3, 20);
    const state = combat.startBattle([player], [enemy]);
    const result = combat.isBattleOver(state);
    expect(result.over).toBe(false);
  });
});
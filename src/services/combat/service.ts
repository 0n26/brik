import { defineService } from '../../core/index.ts';
import type {
  CharacterStats,
  BattleState,
  DamageInfo,
  Rarity,
} from './types.ts';

export interface CombatApi {
  calculateStats(characterId: string, level: number, rarity: Rarity, weaponAttack?: number): CharacterStats;
  calculateDamage(attacker: CharacterStats, defender: CharacterStats, multiplier: number, element?: string): DamageInfo;
  calculateTurnOrder(chars: CharacterStats[]): string[];
  applyEffect(state: BattleState, targetId: string, effectType: string, value: number, duration: number): BattleState;
  startBattle(playerChars: CharacterStats[], enemyChars: CharacterStats[]): BattleState;
  nextTurn(state: BattleState): BattleState;
  executeAction(state: BattleState, charId: string, actionType: 'attack' | 'skill' | 'ultimate' | 'heal', targetId?: string): { state: BattleState; result: DamageInfo | { healAmount: number } };
  isBattleOver(state: BattleState): { over: boolean; winner: 'player' | 'enemy' | null };
}

declare module '../../core/index.ts' {
  interface ServiceMap {
    combat?: CombatApi;
  }
}

export default defineService({
  name: 'combat',
  description: 'Боевая система: характеристики, урон, очерёдность, эффекты',
  init: async ({ logger }) => {
    const CRIT_RATE_CAP = 1.0;
    const CRIT_DMG_CAP = 3.0;

    const api: CombatApi = {
      calculateStats(characterId: string, level: number, rarity: Rarity, weaponAttack = 0): CharacterStats {
        const rarityMultipliers = { 3: 0.5, 4: 0.75, 5: 1.0 };
        const baseHp = 500 + level * 25 * rarityMultipliers[rarity];
        const baseAtk = 100 + level * 10 * rarityMultipliers[rarity];
        const baseDef = 50 + level * 5 * rarityMultipliers[rarity];
        const baseSpeed = 100 + level * 2;

        return {
          id: characterId,
          hp: Math.floor(baseHp),
          maxHp: Math.floor(baseHp),
          atk: Math.floor(baseAtk + weaponAttack),
          def: Math.floor(baseDef),
          speed: baseSpeed,
          critRate: Math.min(0.05 + level * 0.001, CRIT_RATE_CAP),
          critDmg: Math.min(1.5 + level * 0.01, CRIT_DMG_CAP),
          energy: 0,
          maxEnergy: 100,
          element: 'Spectro',
          resistance: 0.1,
        };
      },

      calculateDamage(attacker: CharacterStats, defender: CharacterStats, multiplier: number, element?: string): DamageInfo {
        const baseDamage = attacker.atk * multiplier;
        const defenseReduction = 100 / (100 + defender.def);
        const rawDamage = baseDamage * defenseReduction;
        const critical = Math.random() < attacker.critRate;
        const critMultiplier = critical ? attacker.critDmg : 1.0;
        let finalDamage = rawDamage * critMultiplier;
        const absorbed = defender.resistance > 0 ? finalDamage * defender.resistance : 0;
        finalDamage = Math.max(0, finalDamage - absorbed);

        return {
          baseDamage,
          finalDamage: Math.floor(finalDamage),
          damageType: element ? 'elemental' : 'physical',
          critical,
          absorbed: Math.floor(absorbed),
        };
      },

      calculateTurnOrder(chars: CharacterStats[]): string[] {
        return [...chars].sort((a, b) => b.speed - a.speed).map((c) => c.id);
      },

      applyEffect(state: BattleState, targetId: string, effectType: string, value: number, duration: number): BattleState {
        const effects = new Map(state.activeEffects);
        effects.set(targetId, { type: effectType, duration, value });
        return { ...state, activeEffects: effects };
      },

      startBattle(playerChars: CharacterStats[], enemyChars: CharacterStats[]): BattleState {
        const all = [...playerChars, ...enemyChars];
        const turnOrder = api.calculateTurnOrder(all);
        const attackerId = turnOrder[0] ?? '';
        const isPlayerTurn = playerChars.some((c) => c.id === attackerId);

        return {
          turn: 0,
          attackerId,
          defenderId: null,
          isPlayerTurn,
          playerChars,
          enemyChars,
          turnOrder,
          activeEffects: new Map(),
        };
      },

      nextTurn(state: BattleState): BattleState {
        const currentIdx = state.turnOrder.indexOf(state.attackerId);
        const nextIdx = (currentIdx + 1) % state.turnOrder.length;
        const nextCharId = state.turnOrder[nextIdx];

        return {
          ...state,
          turn: state.turn + 1,
          attackerId: nextCharId ?? '',
          defenderId: null,
          isPlayerTurn: !state.isPlayerTurn,
        };
      },

      executeAction(state: BattleState, charId: string, actionType: 'attack' | 'skill' | 'ultimate' | 'heal', targetId?: string): { state: BattleState; result: DamageInfo | { healAmount: number } } {
        const attacker = [...state.playerChars, ...state.enemyChars].find((c) => c.id === charId);
        if (!attacker) throw new Error(`Персонаж ${charId} не найден`);

        let target: CharacterStats | null = null;
        if (targetId) {
          target = [...state.playerChars, ...state.enemyChars].find((c) => c.id === targetId) ?? null;
        }

        let result: DamageInfo | { healAmount: number };

        // Apply active effects before action (e.g., damage over time, shields)
        const effects = new Map(state.activeEffects);
        effects.forEach((effect, id) => {
          effect.duration--;
          if (effect.duration <= 0) {
            effects.delete(id);
          }
        });

        if (actionType === 'heal') {
          const healAmount = Math.floor(attacker.atk * 1.5);
          result = { healAmount };
        } else {
          const multiplier = actionType === 'ultimate' ? 2.5 : actionType === 'skill' ? 1.5 : 1.0;
          const targetChar = target ?? [...state.enemyChars, ...state.playerChars].find((c) => c.id !== charId);
          if (!targetChar) throw new Error('Цель не найдена');
          result = this.calculateDamage(attacker, targetChar, multiplier);
        }

        // Apply effects after action (e.g., damage over time, shields, buffs/debuffs)
        // Expired effects already removed above; remaining effects persist to next turn
        const newState = this.nextTurn(state);

        return { state: newState, result };
      },

      isBattleOver(state: BattleState): { over: boolean; winner: 'player' | 'enemy' | null } {
        const playerAlive = state.playerChars.some((c) => c.hp > 0);
        const enemyAlive = state.enemyChars.some((c) => c.hp > 0);

        if (!playerAlive && !enemyAlive) return { over: true, winner: null };
        if (!playerAlive) return { over: true, winner: 'enemy' };
        if (!enemyAlive) return { over: true, winner: 'player' };
        return { over: false, winner: null };
      },
    };

    logger.info('combat: инициализирован');
    return api;
  },
});
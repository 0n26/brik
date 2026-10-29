import { defineService } from '../../core/index.ts';
import type { UserWallet } from './types.ts';

export interface WeaponsApi {
  listAvailable(): Promise<WeaponDef[]>;
  get(id: string): Promise<WeaponDef | null>;
  getPlayerWeapon(userId: string, characterId: string, slot: EquipmentSlot): Promise<PlayerWeapon | null>;
  equipWeapon(userId: string, characterId: string, slot: EquipmentSlot, weaponId: string): Promise<{ ok: true } | { ok: false; error: string }>;
  unequipWeapon(userId: string, characterId: string, slot: EquipmentSlot): Promise<{ ok: true } | { ok: false; error: string }>;
  upgradeWeapon(userId: string, weaponId: string): Promise<{ ok: true; level: number } | { ok: false; error: string }>;
  getPlayerWeapons(userId: string): Promise<PlayerWeapon[]>;
  getCharacterWeapons(userId: string, characterId: string): Promise<PlayerWeapon[]>;
  getWeapon(userId: string, weaponId: string): Promise<PlayerWeapon | null>;
  discardWeapon(userId: string, weaponId: string): Promise<{ ok: true } | { ok: false; error: string }>;
}

export type EquipmentSlot = 'weapon' | 'head' | 'body' | 'leg' | 'accessory';

export interface WeaponDef {
  id: string;
  name: string;
  description: string;
  rarity: number;
  type: string;
  baseAttack: number;
  secondaryStat: { type: string; value: number };
  passiveId?: string;
  enabled: boolean;
  imageUrl?: string;
  upgradeCost?: number;
  maxLevel?: number;
}

export interface PlayerWeapon {
  userId: string;
  weaponId: string;
  characterId?: string;
  slot?: EquipmentSlot;
  level: number;
  blessing?: string;
  obtainedAt: string;
  lastUpgradedAt?: string;
}

declare module '../../core/index.ts' {
  interface ServiceMap {
    weapons?: WeaponsApi;
  }
}

const DEFAULT_UPGRADE_COST = 100;

export default defineService({
  name: 'weapons',
  description: 'База оружия и инвентарь, экипировка, улучшение, разбор',
  init: async ({ db, logger }) => {
    const api: WeaponsApi = {
      async listAvailable(): Promise<WeaponDef[]> {
        return db.collection('weapons').find({ enabled: { $eq: true } }) as unknown as Promise<WeaponDef[]>;
      },

      async get(id: string): Promise<WeaponDef | null> {
        return db.collection('weapons').findOne({ id: { $eq: id } }) as unknown as Promise<WeaponDef | null>;
      },

      async getPlayerWeapon(userId: string, characterId: string, slot: EquipmentSlot): Promise<PlayerWeapon | null> {
        return db.collection('player_weapons').findOne({ userId: { $eq: userId }, characterId: { $eq: characterId }, slot: { $eq: slot } }) as unknown as Promise<PlayerWeapon | null>;
      },

      async equipWeapon(userId: string, characterId: string, slot: EquipmentSlot, weaponId: string) {
        const col = db.collection('player_weapons');
        const existing = await col.findOne({ userId: { $eq: userId }, characterId: { $eq: characterId }, slot: { $eq: slot } });

        const raw = await db.collection('wallet').findOne({ userId: { $eq: userId } });
        if (!raw) return { ok: false, error: 'Кошелек не найден' };
        const wallet = { astrite: Number((raw as any).astrite) };

        const weapon = await api.get(weaponId);
        if (!weapon) return { ok: false, error: 'Оружие не найдено' };

        const cost = weapon.upgradeCost ?? DEFAULT_UPGRADE_COST;
        if (wallet.astrite < cost) return { ok: false, error: `Недостаточно астрита (нужно ${cost})` };

        if (existing) {
          await col.update(
            { userId: { $eq: userId }, characterId: { $eq: characterId }, slot: { $eq: slot } },
            { ...existing, weaponId, level: 1, blessing: undefined },
          );
        } else {
          await col.insert({
            userId,
            weaponId,
            characterId,
            slot,
            level: 1,
            obtainedAt: new Date().toISOString(),
          });
        }

        wallet.astrite -= cost;
        await db.collection('wallet').update({ userId: { $eq: userId } }, wallet);
        return { ok: true };
      },

      async unequipWeapon(userId: string, characterId: string, slot: EquipmentSlot) {
        const col = db.collection('player_weapons');
        await col.delete({ userId: { $eq: userId }, characterId: { $eq: characterId }, slot: { $eq: slot } });
        return { ok: true };
      },

      async upgradeWeapon(userId: string, weaponId: string) {
        const pwCol = db.collection('player_weapons');
        const weaponCol = db.collection('weapons');

        const playerWeapon = await pwCol.findOne({ userId: { $eq: userId }, weaponId: { $eq: weaponId } }) as PlayerWeapon | null;
        if (!playerWeapon) return { ok: false, error: 'Оружие не найдено в инвентаре' };

        const weapon = await weaponCol.findOne({ id: { $eq: weaponId } }) as WeaponDef | null;
        if (!weapon) return { ok: false, error: 'Оружие не найдено в базе' };

        const currentLevel = playerWeapon.level || 1;
        const maxLevel = weapon.maxLevel ?? 6;
        if (currentLevel >= maxLevel) return { ok: false, error: 'Максимальный уровень достигнут' };

        const upgradeCost = weapon.upgradeCost ?? DEFAULT_UPGRADE_COST;
        const raw = await db.collection('wallet').findOne({ userId: { $eq: userId } });
        if (!raw) return { ok: false, error: 'Кошелек не найден' };
        const astrite = (raw as any).astrite as number;
        if (astrite < upgradeCost) return { ok: false, error: `Недостаточно астрита (нужно ${upgradeCost})` };

        const newLevel = currentLevel + 1;
        await pwCol.update(
          { userId: { $eq: userId }, weaponId: { $eq: weaponId } },
          { ...playerWeapon, level: newLevel, lastUpgradedAt: new Date().toISOString() },
        );

        const newAstrite = astrite - upgradeCost;
        await db.collection('wallet').update({ userId: { $eq: userId } }, { ...raw, astrite: newAstrite } as any);
        return { ok: true, level: newLevel };
      },

      async getPlayerWeapons(userId: string): Promise<PlayerWeapon[]> {
        return db.collection('player_weapons').find({ userId: { $eq: userId } }) as unknown as Promise<PlayerWeapon[]>;
      },

      async getCharacterWeapons(userId: string, characterId: string): Promise<PlayerWeapon[]> {
        return db.collection('player_weapons').find({ userId: { $eq: userId }, characterId: { $eq: characterId } }) as unknown as Promise<PlayerWeapon[]>;
      },

      async getWeapon(userId: string, weaponId: string): Promise<PlayerWeapon | null> {
        return db.collection('player_weapons').findOne({ userId: { $eq: userId }, weaponId: { $eq: weaponId } }) as unknown as Promise<PlayerWeapon | null>;
      },

      async discardWeapon(userId: string, weaponId: string) {
        const col = db.collection('player_weapons');
        await col.delete({ userId: { $eq: userId }, weaponId: { $eq: weaponId } });
        return { ok: true };
      },
    };

    logger.info('weapons: инициализирован');
    return api;
  },
});
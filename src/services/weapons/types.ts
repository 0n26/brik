export type UserWallet = {
  userId: string;
  astrite: number;
  tide: number;
  stellarGlitter: number;
};

export function utcDayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export interface WeaponDef {
  id: string;
  name: string;
  description: string;
  rarity: number;
  type: string;
  baseAttack: number;
  secondaryStat: {
    type: string;
    value: number;
  };
  passiveId?: string;
  enabled: boolean;
  imageUrl?: string;
  upgradeMaterials?: UpgradeMaterial[];
  upgradeCost?: number;
  maxLevel?: number;
  blessing?: string;
}

export interface UpgradeMaterial {
  id: string;
  name: string;
  iconUrl?: string;
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

export type EquipmentSlot = 'weapon' | 'head' | 'body' | 'leg' | 'accessory';
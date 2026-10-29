export type Rarity = 3 | 4 | 5;

export type EquipmentSlot = 'weapon' | 'head' | 'body' | 'leg' | 'accessory';

export interface CharacterStats {
  id: string;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  speed: number;
  critRate: number;
  critDmg: number;
  energy: number;
  maxEnergy: number;
  element: string;
  resistance: number;
}

export interface CharacterAbility {
  id: string;
  name: string;
  type: 'normal' | 'active' | 'ultimate' | 'passive' | 'talent';
  description: string;
  cost: number; // energy cost or cooldown
  effect: 'damage' | 'heal' | 'shield' | 'buff' | 'debuff' | 'energy' | 'cooldown' | 'status';
  target: 'single' | 'all' | 'enemy' | 'self';
  powerMultiplier: number;
}

export interface BattleState {
  turn: number;
  attackerId: string;
  defenderId: string | null;
  isPlayerTurn: boolean;
  playerChars: CharacterStats[];
  enemyChars: CharacterStats[];
  turnOrder: string[]; // character IDs in order of play
  activeEffects: Map<string, { type: string; duration: number; value: number }>;
}

export interface DamageInfo {
  baseDamage: number;
  finalDamage: number;
  damageType: 'physical' | 'elemental' | 'true';
  critical: boolean;
  absorbed: number;
}
export interface UserWallet {
  userId: string;
  astrite: number;
  tide: number;
  stellarGlitter: number;
}

export function utcDayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export interface MinigamesStats {
  userId: string;
  dayKey: string;
  loginStreak: number;
  gamesPlayed: number;
  lastLoginAt?: string;
}

export interface MinigamesApi {
  claimDailyLogin(userId: string): Promise<{ ok: true; streak: number } | { ok: false; error: string }>;
  getLoginStreak(userId: string): Promise<number>;
  canPlayToday(userId: string, gameType: string): Promise<{ canPlay: boolean; attemptsLeft: number; limit: number } | { error: string }>;
  playTreasureHunt(userId: string): Promise<{ ok: true; position: number; message: string } | { ok: false; error: string }>;
  playQuiz(userId: string): Promise<{ ok: true; correct: boolean; message: string } | { ok: false; error: string }>;
  playCodeBreaker(userId: string, guess: string): Promise<{ ok: true; solved: boolean; message: string } | { ok: false; error: string }>;
  playFishing(userId: string): Promise<{ ok: true; caught: string; value: number; message: string } | { ok: false; error: string }>;
  playResourceGather(userId: string, location: string): Promise<{ ok: true; reward: number; message: string } | { ok: false; error: string }>;
  playDice(userId: string): Promise<{ ok: true; diceValue: number; message: string } | { ok: false; error: string }>;
  getGameStats(userId: string): Promise<MinigamesStats | null>;
}

export interface UserCollectionEntry {
  userId: string;
  characterId: string;
  copies: number;
  awakening: number;
  firstObtainedAt: string;
  lastObtainedAt: string;
}

export type UserPity = {
  userId: string;
  pityBannerType: string;
  pullsSince5: number;
  pullsSince4: number;
  lost5050: boolean;
};

export type Rarity = 3 | 4 | 5;

export type BannerType = 'limited' | 'standard' | 'event';

export interface BannerDef {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  type: BannerType;
  startsAt: string;
  endsAt: string | null;
  poolCharacterIds: string[];
  featuredCharacterIds: string[];
  rateTable: { star4: number; star5: number };
  pityBannerType: string;
  acceptPullsAfterEnd: boolean;
}

export interface CharacterDef {
  id: string;
  name: string;
  rarity: Rarity;
  element: string;
  weapon: string;
  faction: string;
  description: string;
  imageUrl: string;
  available: boolean;
}

export interface GachaHistoryRow {
  id: string;
  userId: string;
  bannerId: string;
  characterId: string;
  rarity: Rarity;
  pulledAt: string;
  pullIndex: number;
  currencyUsed: 'astrite' | 'tide' | 'mixed';
  pityBefore: { pullsSince5: number; pullsSince4: number; lost5050: boolean; };
  pityAfter: { pullsSince5: number; pullsSince4: number; lost5050: boolean; };
  won5050: boolean | null;
}

export interface ShopItemDef {
  id: string;
  name: string;
  description: string;
  costStellar?: number;
  costAstrite?: number;
  grants: { tide?: number; astrite?: number };
  dailyLimit: number;
}

export interface QuestDef {
  id: string;
  description: string;
  period: 'daily' | 'weekly' | 'event';
  target: number;
  metric: 'pulls' | 'commands' | 'newCharacters';
  rewardAstrite: number;
  startsAt?: string;
  endsAt?: string;
}

export interface PullOutcome {
  characterId: string;
  rarity: Rarity;
  isNew: boolean;
  copiesAfter: number;
  awakening: number;
  duplicateCompensation: number;
  won5050: boolean | null;
  pityBefore: { pullsSince5: number; pullsSince4: number; lost5050: boolean; };
  pityAfter: { pullsSince5: number; pullsSince4: number; lost5050: boolean; };
  pullIndex: number;
  currencyUsed: 'astrite' | 'tide' | 'mixed';
}
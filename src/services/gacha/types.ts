export type Rarity = 3 | 4 | 5;

export type BannerType = 'limited' | 'standard' | 'event';

export type CurrencyKind = 'astrite' | 'tide' | 'mixed';

export interface GachaConfig {
  currency: {
    singlePullAstrite: number;
    tenPullAstrite: number;
    dailyAstrite: number;
    weeklyAstrite: number;
    questAstriteMin: number;
    questAstriteMax: number;
    /** Сначала тратить билеты прилива, затем астрит */
    spendTideFirst: boolean;
  };
  rates: {
    base5Star: number;
    base4Star: number;
    hardPity5: number;
    softPityStart: number;
    /** Добавка к шансу 5★ за каждый pull после softPityStart */
    softPityIncrement: number;
    guarantee4Every: number;
    limitedFeaturedRateOn5: number;
  };
  duplicate: {
    stellarGlitter3: number;
    stellarGlitter4: number;
    stellarGlitter5: number;
    maxAwakening: number;
    copiesPerAwakening: number[];
  };
  pity: {
    /** Переносить 50/50 между баннерами одного типа limited */
    transferLimited5050: boolean;
  };
  shop: {
    tideTicketAstrite: number;
    tideTicketStellar: number;
    dailyPurchaseLimit: number;
  };
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
  metadata?: Record<string, unknown>;
}

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

export interface UserWallet {
  userId: string;
  astrite: number;
  tide: number;
  stellarGlitter: number;
}

export interface UserPity {
  userId: string;
  pityBannerType: string;
  pullsSince5: number;
  pullsSince4: number;
  lost5050: boolean;
  lastBannerId?: string;
  lastPullAt?: string;
}

export interface UserCollectionEntry {
  userId: string;
  characterId: string;
  copies: number;
  awakening: number;
  firstObtainedAt: string;
  lastObtainedAt: string;
}

export interface PitySnapshot {
  pullsSince5: number;
  pullsSince4: number;
  lost5050: boolean;
}

export interface PullOutcome {
  characterId: string;
  rarity: Rarity;
  isNew: boolean;
  copiesAfter: number;
  awakening: number;
  duplicateCompensation: number;
  won5050: boolean | null;
  pityBefore: PitySnapshot;
  pityAfter: PitySnapshot;
  pullIndex: number;
  currencyUsed: CurrencyKind;
}

export interface PullBatchResult {
  bannerId: string;
  outcomes: PullOutcome[];
  spent: { astrite: number; tide: number };
  error?: string;
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

export interface GachaHistoryEntry {
  id: string;
  userId: string;
  bannerId: string;
  characterId: string;
  rarity: Rarity;
  pulledAt: string;
  pullIndex: number;
  currencyUsed: CurrencyKind;
  pityBefore: PitySnapshot;
  pityAfter: PitySnapshot;
  won5050: boolean | null;
}

export interface AdminAuditEntry {
  id: string;
  adminId: string;
  action: string;
  targetUserId?: string;
  details: Record<string, unknown>;
  reason: string;
  at: string;
}

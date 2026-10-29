import type { GachaConfig, QuestDef, ShopItemDef } from './types.ts';

export const DEFAULT_GACHA_CONFIG: GachaConfig = {
  currency: {
    singlePullAstrite: 160,
    tenPullAstrite: 1600,
    dailyAstrite: 60,
    weeklyAstrite: 300,
    questAstriteMin: 20,
    questAstriteMax: 100,
    spendTideFirst: true,
  },
  rates: {
    base5Star: 0.008,
    base4Star: 0.051,
    hardPity5: 80,
    softPityStart: 66,
    softPityIncrement: 0.066,
    guarantee4Every: 10,
    limitedFeaturedRateOn5: 0.5,
  },
  duplicate: {
    stellarGlitter3: 2,
    stellarGlitter4: 8,
    stellarGlitter5: 40,
    maxAwakening: 6,
    copiesPerAwakening: [1, 1, 2, 2, 3, 3],
  },
  pity: {
    transferLimited5050: true,
  },
  shop: {
    tideTicketAstrite: 160,
    tideTicketStellar: 20,
    dailyPurchaseLimit: 10,
  },
};

export const DEFAULT_SHOP_ITEMS: ShopItemDef[] = [
  {
    id: 'tide_astrite',
    name: 'Билет прилива',
    description: '1 крутка за астрит',
    costAstrite: 160,
    grants: { tide: 1 },
    dailyLimit: 10,
  },
  {
    id: 'tide_stellar',
    name: 'Билет прилива (блеск)',
    description: '1 крутка за звёздный блеск',
    costStellar: 20,
    grants: { tide: 1 },
    dailyLimit: 5,
  },
];

export const DEFAULT_QUESTS: QuestDef[] = [
  {
    id: 'daily_pull_1',
    description: 'Выполните 1 крутку',
    period: 'daily',
    target: 1,
    metric: 'pulls',
    rewardAstrite: 30,
  },
  {
    id: 'daily_pull_10',
    description: 'Выполните 10 круток',
    period: 'daily',
    target: 10,
    metric: 'pulls',
    rewardAstrite: 80,
  },
  {
    id: 'weekly_new_3',
    description: 'Получите 3 новых персонажа за неделю',
    period: 'weekly',
    target: 3,
    metric: 'newCharacters',
    rewardAstrite: 100,
  },
];

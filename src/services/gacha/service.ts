import { z } from 'zod';
import { defineService } from '../../core/index.ts';
import { DEFAULT_GACHA_CONFIG } from './config.ts';
import { GachaEngine } from './engine.ts';
import { loadGachaData } from './load-data.ts';
import type { BannerDef, CharacterDef, PullOutcome, UserCollectionEntry, UserPity, UserWallet } from './types.ts';
import type { RandomSource } from './rng.ts';

export interface GachaApi {
  seedCatalog(): Promise<void>;
  getWallet(userId: string): Promise<UserWallet>;
  getActiveBanners(now?: Date): BannerDef[];
  getBanner(id: string): BannerDef | undefined;
  getCharacter(id: string): CharacterDef | undefined;
  listCharacters(): CharacterDef[];
  pull(userId: string, bannerId: string, count: 1 | 10, now?: Date): Promise<
    | { ok: true; outcomes: PullOutcome[]; spent: { astrite: number; tide: number } }
    | { ok: false; error: string }
  >;
  getPity(userId: string, pityBannerType: string): Promise<UserPity>;
  getCollection(userId: string): Promise<UserCollectionEntry[]>;
  getHistory(userId: string, limit?: number, offset?: number): Promise<unknown[]>;
  getHistoryCount(userId: string): Promise<number>;
  claimDaily(userId: string): ReturnType<GachaEngine['claimDaily']>;
  claimWeekly(userId: string): ReturnType<GachaEngine['claimWeekly']>;
  listQuestProgress(userId: string): ReturnType<GachaEngine['listQuestProgress']>;
  claimQuest(userId: string, questId: string): ReturnType<GachaEngine['claimQuest']>;
  shopPurchase(userId: string, itemId: string): ReturnType<GachaEngine['shopPurchase']>;
  leaderboardUnique(limit?: number): ReturnType<GachaEngine['leaderboardUnique']>;
  adminGrantCurrency(
    adminId: string,
    targetUserId: string,
    patch: Partial<Pick<UserWallet, 'astrite' | 'tide' | 'stellarGlitter'>>,
    reason: string,
  ): ReturnType<GachaEngine['adminGrantCurrency']>;
  createBanner(banner: BannerDef): ReturnType<GachaEngine['createBanner']>;
  /** Только для тестов: подмена RNG */
  withRng(rng: RandomSource): GachaApi;
  config: typeof DEFAULT_GACHA_CONFIG;
}

declare module '../../core/index.ts' {
  interface ServiceMap {
    gacha?: GachaApi;
  }
}

const optionsSchema = z.object({
  startingAstrite: z.number().int().min(0).optional(),
});

export default defineService<{ startingAstrite?: number }>({
  name: 'gacha',
  description: 'Гача-система: баннеры, крутки, валюта, коллекция',
  optionsSchema,
  init: async ({ db, logger, options }) => {
    const data = loadGachaData();
    const config = { ...DEFAULT_GACHA_CONFIG };
    const engine = new GachaEngine({ db, logger, config, characters: data.characters, banners: data.banners });
    await engine.seedCatalog();

    const wrap = (eng: GachaEngine): GachaApi => ({
      config,
      seedCatalog: () => eng.seedCatalog(),
      getWallet: (userId) => eng.getWallet(userId),
      getActiveBanners: (now) => eng.getActiveBanners(now),
      getBanner: (id) => eng.getBanner(id),
      getCharacter: (id) => eng.getCharacter(id),
      listCharacters: () => eng.listCharacters(),
      pull: (userId, bannerId, count, now) => eng.pull(userId, bannerId, count, now),
      getPity: (userId, type) => eng.getPity(userId, type),
      getCollection: (userId) => eng.getCollection(userId),
      getHistory: (userId, limit, offset) => eng.getHistory(userId, limit, offset),
      getHistoryCount: (userId) => eng.getHistoryCount(userId),
      claimDaily: (userId) => eng.claimDaily(userId),
      claimWeekly: (userId) => eng.claimWeekly(userId),
      listQuestProgress: (userId) => eng.listQuestProgress(userId),
      claimQuest: (userId, questId) => eng.claimQuest(userId, questId),
      shopPurchase: (userId, itemId) => eng.shopPurchase(userId, itemId),
      leaderboardUnique: (limit) => eng.leaderboardUnique(limit),
      adminGrantCurrency: (adminId, targetUserId, patch, reason) =>
        eng.adminGrantCurrency(adminId, targetUserId, patch, reason),
      createBanner: (banner) => eng.createBanner(banner),
      withRng: (rng) => wrap(new GachaEngine({ db, logger, config, characters: data.characters, banners: data.banners, rng })),
    });

    if (options.startingAstrite !== undefined) {
      logger.info(`gacha: startingAstrite override=${options.startingAstrite}`);
    }

    logger.info(`gacha: загружено ${data.characters.size} персонажей, ${data.banners.size} баннеров`);
    return wrap(engine);
  },
});

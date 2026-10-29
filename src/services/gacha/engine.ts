import type { Database, Logger } from '../../core/index.ts';
import type { GachaConfig, BannerDef, CharacterDef, CurrencyKind, PitySnapshot, PullOutcome, Rarity, UserCollectionEntry, UserPity, UserWallet } from './types.ts';
import type { RandomSource } from './rng.ts';
import { pickWeighted, secureRandom } from './rng.ts';

const COL = {
  wallet: 'wallet',
  pity: 'pity',
  collection: 'collection',
  history: 'history',
  dailyClaim: 'daily_claim',
  weeklyClaim: 'weekly_claim',
  questProgress: 'quest_progress',
  questClaimed: 'quest_claimed',
  shopDaily: 'shop_daily',
  shopHistory: 'shop_history',
  audit: 'admin_audit',
  banners: 'banners',
  characters: 'characters',
} as const;

export interface GachaEngineDeps {
  db: Database;
  logger: Logger;
  config: GachaConfig;
  characters: Map<string, CharacterDef>;
  banners: Map<string, BannerDef>;
  rng?: RandomSource;
}

export class GachaEngine {
  private readonly db: Database;
  private readonly logger: Logger;
  private readonly config: GachaConfig;
  private readonly characters: Map<string, CharacterDef>;
  private readonly banners: Map<string, BannerDef>;
  private readonly rng: RandomSource;

  constructor(deps: GachaEngineDeps) {
    this.db = deps.db;
    this.logger = deps.logger;
    this.config = deps.config;
    this.characters = deps.characters;
    this.banners = deps.banners;
    this.rng = deps.rng ?? secureRandom;
  }

  async seedCatalog(): Promise<void> {
    const chars = this.db.collection<CharacterDef>(COL.characters);
    const count = await chars.count();
    if (count === 0) {
      await chars.insertMany([...this.characters.values()]);
    }
    const banners = this.db.collection<BannerDef>(COL.banners);
    const bCount = await banners.count();
    if (bCount === 0) {
      await banners.insertMany([...this.banners.values()]);
    }
  }

  getCharacter(id: string): CharacterDef | undefined {
    return this.characters.get(id);
  }

  listCharacters(): CharacterDef[] {
    return [...this.characters.values()].filter((c) => c.available);
  }

  getActiveBanners(now = new Date()): BannerDef[] {
    return [...this.banners.values()].filter((b) => this.isBannerActive(b, now));
  }

  getBanner(id: string): BannerDef | undefined {
    return this.banners.get(id);
  }

  isBannerActive(banner: BannerDef, now = new Date()): boolean {
    const start = new Date(banner.startsAt);
    if (now < start) return false;
    if (banner.endsAt === null) return true;
    const end = new Date(banner.endsAt);
    if (now > end) return banner.acceptPullsAfterEnd;
    return true;
  }

  canPullOnBanner(banner: BannerDef, now = new Date()): boolean {
    const start = new Date(banner.startsAt);
    if (now < start) return false;
    if (banner.endsAt === null) return true;
    const end = new Date(banner.endsAt);
    if (now <= end) return true;
    return banner.acceptPullsAfterEnd;
  }

  async getWallet(userId: string): Promise<UserWallet> {
    const col = this.db.collection<UserWallet>(COL.wallet);
    const existing = await col.findOne({ userId: { $eq: userId } });
    if (existing) return existing;
    const wallet: UserWallet = { userId, astrite: 1600, tide: 0, stellarGlitter: 0 };
    await col.insert(wallet);
    return wallet;
  }

  async getPity(userId: string, pityBannerType: string): Promise<UserPity> {
    const col = this.db.collection<UserPity>(COL.pity);
    const existing = await col.findOne({ userId: { $eq: userId }, pityBannerType: { $eq: pityBannerType } });
    if (existing) return existing;
    const pity: UserPity = {
      userId,
      pityBannerType,
      pullsSince5: 0,
      pullsSince4: 0,
      lost5050: false,
    };
    await col.insert(pity);
    return pity;
  }

  snapshotPity(p: UserPity): PitySnapshot {
    return { pullsSince5: p.pullsSince5, pullsSince4: p.pullsSince4, lost5050: p.lost5050 };
  }

  compute5StarRate(pullsSince5: number): number {
    const { base5Star, hardPity5, softPityStart, softPityIncrement } = this.config.rates;
    const pullNum = pullsSince5 + 1;
    if (pullNum >= hardPity5) return 1;
    let rate = base5Star;
    if (pullNum >= softPityStart) {
      rate += (pullNum - softPityStart + 1) * softPityIncrement;
    }
    const maxOther = this.config.rates.base4Star + 0.001;
    return Math.min(rate, 1 - maxOther);
  }

  rollRarity(pity: UserPity, banner: BannerDef): Rarity {
    const pull5 = pity.pullsSince5 + 1;
    const pull4 = pity.pullsSince4 + 1;
    const { hardPity5, guarantee4Every } = this.config.rates;

    if (pull5 >= hardPity5) return 5;

    const rate5 = this.compute5StarRate(pity.pullsSince5);
    const rate4 = banner.rateTable.star4;
    const u = this.rng.next();

    if (pull4 >= guarantee4Every) {
      if (u < rate5) return 5;
      return 4;
    }

    if (u < rate5) return 5;
    return 4;
  }

  poolByRarity(banner: BannerDef, rarity: Rarity): CharacterDef[] {
    return banner.poolCharacterIds
      .map((id) => this.characters.get(id))
      .filter((c): c is CharacterDef => !!c && c.available && c.rarity === rarity);
  }

  pickCharacter(banner: BannerDef, rarity: Rarity, pity: UserPity): { id: string; won5050: boolean | null } {
    const pool = this.poolByRarity(banner, rarity);
    if (pool.length === 0) throw new Error(`Пустой пул ${rarity}★ для баннера ${banner.id}`);

    if (rarity !== 5 || banner.type !== 'limited' || banner.featuredCharacterIds.length === 0) {
      const id = pool[this.rng.next() * pool.length | 0]!.id;
      return { id, won5050: null };
    }

    const featured = banner.featuredCharacterIds.filter((fid) => {
      const c = this.characters.get(fid);
      return c && c.rarity === 5;
    });
    if (featured.length === 0) {
      const id = pool[this.rng.next() * pool.length | 0]!.id;
      return { id, won5050: null };
    }

    const standard5 = pool.filter((c) => !featured.includes(c.id));
    const featuredId = featured[0]!;

    if (pity.lost5050) {
      return { id: featuredId, won5050: true };
    }

    const u = this.rng.next();
    if (u < this.config.rates.limitedFeaturedRateOn5) {
      return { id: featuredId, won5050: true };
    }

    if (standard5.length === 0) {
      return { id: featuredId, won5050: true };
    }
    const pick = standard5[this.rng.next() * standard5.length | 0]!;
    return { id: pick.id, won5050: false };
  }

  applyPityAfterPull(pity: UserPity, rarity: Rarity, banner: BannerDef, characterId: string, won5050: boolean | null): void {
    if (rarity >= 4) {
      pity.pullsSince4 = 0;
    } else {
      pity.pullsSince4 += 1;
    }

    if (rarity === 5) {
      pity.pullsSince5 = 0;
      if (banner.type === 'limited' && banner.featuredCharacterIds.includes(characterId)) {
        pity.lost5050 = false;
      } else if (banner.type === 'limited' && won5050 === false) {
        pity.lost5050 = true;
      } else if (banner.type === 'limited' && won5050 === true) {
        pity.lost5050 = false;
      }
    } else {
      pity.pullsSince5 += 1;
    }

    pity.lastBannerId = banner.id;
    pity.lastPullAt = new Date().toISOString();
  }

  duplicateGlitter(rarity: Rarity): number {
    const d = this.config.duplicate;
    if (rarity === 5) return d.stellarGlitter5;
    if (rarity === 4) return d.stellarGlitter4;
    return d.stellarGlitter3;
  }

  computeAwakening(copies: number): number {
    const { maxAwakening, copiesPerAwakening } = this.config.duplicate;
    let needed = 0;
    let level = 0;
    for (let i = 0; i < copiesPerAwakening.length && level < maxAwakening; i++) {
      needed += copiesPerAwakening[i]!;
      if (copies >= needed) level = i + 1;
    }
    return level;
  }

  async pull(userId: string, bannerId: string, count: 1 | 10, now = new Date()): Promise<{ ok: true; outcomes: PullOutcome[]; spent: { astrite: number; tide: number } } | { ok: false; error: string }> {
    const banner = this.banners.get(bannerId);
    if (!banner) return { ok: false, error: 'Баннер не найден' };
    if (!this.canPullOnBanner(banner, now)) return { ok: false, error: 'Баннер недоступен для круток' };

    const costAstrite = count === 10 ? this.config.currency.tenPullAstrite : this.config.currency.singlePullAstrite;
    const costTide = count;

    try {
      return await this.db.transaction(async (tx) => {
        const engine = new GachaEngine({
          db: tx,
          logger: this.logger,
          config: this.config,
          characters: this.characters,
          banners: this.banners,
          rng: this.rng,
        });

        const walletCol = tx.collection<UserWallet>(COL.wallet);
        let wallet = await walletCol.findOne({ userId: { $eq: userId } });
        if (!wallet) {
          wallet = { userId, astrite: 1600, tide: 0, stellarGlitter: 0 };
          await walletCol.insert(wallet);
        }

        let spentAstrite = 0;
        let spentTide = 0;
        const spend = engine.computeSpend(wallet, costTide, costAstrite);
        if (!spend.ok) return { ok: false as const, error: spend.error };
        spentAstrite = spend.astrite;
        spentTide = spend.tide;
        wallet = spend.wallet;

        await walletCol.update({ userId: { $eq: userId } }, wallet);

        const pityCol = tx.collection<UserPity>(COL.pity);
        let pity = await pityCol.findOne({
          userId: { $eq: userId },
          pityBannerType: { $eq: banner.pityBannerType },
        });
        if (!pity) {
          pity = {
            userId,
            pityBannerType: banner.pityBannerType,
            pullsSince5: 0,
            pullsSince4: 0,
            lost5050: false,
          };
          await pityCol.insert(pity);
        }

        const collectionCol = tx.collection<UserCollectionEntry>(COL.collection);
        const historyCol = tx.collection<GachaHistoryRow>(COL.history);
        const outcomes: PullOutcome[] = [];

        for (let i = 0; i < count; i++) {
          const pityBefore = engine.snapshotPity(pity);
          const rarity = engine.rollRarity(pity, banner);
          const { id: characterId, won5050 } = engine.pickCharacter(banner, rarity, pity);
          if (!engine.characters.has(characterId)) {
            throw new Error(`Несуществующий персонаж в результате: ${characterId}`);
          }

          engine.applyPityAfterPull(pity, rarity, banner, characterId, won5050);
          const pityAfter = engine.snapshotPity(pity);

          let entry = await collectionCol.findOne({ userId: { $eq: userId }, characterId: { $eq: characterId } });
          const isNew = !entry;
          let duplicateCompensation = 0;
          const nowIso = new Date().toISOString();

          if (!entry) {
            entry = {
              userId,
              characterId,
              copies: 1,
              awakening: 0,
              firstObtainedAt: nowIso,
              lastObtainedAt: nowIso,
            };
            await collectionCol.insert(entry);
          } else {
            entry.copies += 1;
            entry.lastObtainedAt = nowIso;
            entry.awakening = engine.computeAwakening(entry.copies);
            duplicateCompensation = engine.duplicateGlitter(rarity);
            wallet.stellarGlitter += duplicateCompensation;
            await collectionCol.update(
              { userId: { $eq: userId }, characterId: { $eq: characterId } },
              entry,
            );
          }

          const currencyUsed: CurrencyKind =
            spentTide > 0 && spentAstrite === 0 ? 'tide' : spentAstrite > 0 && spentTide === 0 ? 'astrite' : 'mixed';

          outcomes.push({
            characterId,
            rarity,
            isNew,
            copiesAfter: entry.copies,
            awakening: entry.awakening,
            duplicateCompensation,
            won5050,
            pityBefore,
            pityAfter,
            pullIndex: i + 1,
            currencyUsed,
          });

          await historyCol.insert({
            id: crypto.randomUUID(),
            userId,
            bannerId,
            characterId,
            rarity,
            pulledAt: nowIso,
            pullIndex: i + 1,
            currencyUsed,
            pityBefore,
            pityAfter,
            won5050,
          });
        }

        await pityCol.update(
          { userId: { $eq: userId }, pityBannerType: { $eq: banner.pityBannerType } },
          pity,
        );
        await walletCol.update({ userId: { $eq: userId } }, wallet);

        await engine.bumpQuestProgress(tx, userId, count, outcomes.filter((o) => o.isNew).length);

        return { ok: true as const, outcomes, spent: { astrite: spentAstrite, tide: spentTide } };
      });
    } catch (e) {
      this.logger.error('gacha pull failed', e);
      return { ok: false, error: 'Ошибка базы данных при крутке' };
    }
  }

  computeSpend(
    wallet: UserWallet,
    costTide: number,
    costAstrite: number,
  ): { ok: true; wallet: UserWallet; astrite: number; tide: number } | { ok: false; error: string } {
    const w = { ...wallet };
    const singlePullCost = this.config.currency.singlePullAstrite;

    if (this.config.currency.spendTideFirst) {
      const useTide = Math.min(w.tide, costTide);
      w.tide -= useTide;
      const remainingPulls = costTide - useTide;
      const astriteNeeded = remainingPulls * singlePullCost;
      if (w.astrite < astriteNeeded) {
        return { ok: false, error: `Недостаточно ресурсов (нужно ${astriteNeeded} астрита)` };
      }
      w.astrite -= astriteNeeded;
      return { ok: true, wallet: w, astrite: wallet.astrite - w.astrite, tide: wallet.tide - w.tide };
    }

    // spend astrite first, then tide
    const useAstrite = Math.min(w.astrite, costAstrite);
    const remainingAstrite = costAstrite - useAstrite;
    const tideNeeded = Math.ceil(remainingAstrite / singlePullCost);
    if (w.tide < tideNeeded) {
      return { ok: false, error: 'Недостаточно ресурсов' };
    }
    w.astrite -= useAstrite;
    w.tide -= tideNeeded;
    return { ok: true, wallet: w, astrite: wallet.astrite - w.astrite, tide: wallet.tide - w.tide };
  }

  async bumpQuestProgress(tx: Database, userId: string, pulls: number, newChars: number): Promise<void> {
    const col = tx.collection<{ userId: string; questId: string; periodKey: string; progress: number }>(COL.questProgress);
    const dayKey = utcDayKey();
    const weekKey = utcWeekKey();

    const updates: { questId: string; periodKey: string; delta: number }[] = [
      { questId: 'daily_pull_1', periodKey: dayKey, delta: pulls },
      { questId: 'daily_pull_10', periodKey: dayKey, delta: pulls },
      { questId: 'weekly_new_3', periodKey: weekKey, delta: newChars },
    ];

    for (const u of updates) {
      const row = await col.findOne({ userId: { $eq: userId }, questId: { $eq: u.questId }, periodKey: { $eq: u.periodKey } });
      if (!row) {
        await col.insert({ userId, questId: u.questId, periodKey: u.periodKey, progress: u.delta });
      } else {
        row.progress += u.delta;
        await col.update({ userId: { $eq: userId }, questId: { $eq: u.questId }, periodKey: { $eq: u.periodKey } }, row);
      }
    }
  }

  async claimDaily(userId: string): Promise<{ ok: true; astrite: number } | { ok: false; error: string }> {
    const key = utcDayKey();
    const col = this.db.collection<{ userId: string; day: string }>(COL.dailyClaim);
    const existing = await col.findOne({ userId: { $eq: userId }, day: { $eq: key } });
    if (existing) return { ok: false, error: 'Ежедневная награда уже получена' };

    return this.db.transaction(async (tx) => {
      const claimCol = tx.collection<{ userId: string; day: string }>(COL.dailyClaim);
      const again = await claimCol.findOne({ userId: { $eq: userId }, day: { $eq: key } });
      if (again) return { ok: false as const, error: 'Ежедневная награда уже получена' };
      await claimCol.insert({ userId, day: key });
      const walletCol = tx.collection<UserWallet>(COL.wallet);
      const wallet = await this.ensureWalletTx(tx, userId);
      wallet.astrite += this.config.currency.dailyAstrite;
      await walletCol.update({ userId: { $eq: userId } }, wallet);
      return { ok: true as const, astrite: this.config.currency.dailyAstrite };
    });
  }

  async claimWeekly(userId: string): Promise<{ ok: true; astrite: number } | { ok: false; error: string }> {
    const key = utcWeekKey();
    const col = this.db.collection<{ userId: string; week: string }>(COL.weeklyClaim);
    const existing = await col.findOne({ userId: { $eq: userId }, week: { $eq: key } });
    if (existing) return { ok: false, error: 'Еженедельная награда уже получена' };

    return this.db.transaction(async (tx) => {
      const claimCol = tx.collection<{ userId: string; week: string }>(COL.weeklyClaim);
      const again = await claimCol.findOne({ userId: { $eq: userId }, week: { $eq: key } });
      if (again) return { ok: false as const, error: 'Еженедельная награда уже получена' };
      await claimCol.insert({ userId, week: key });
      const walletCol = tx.collection<UserWallet>(COL.wallet);
      const wallet = await this.ensureWalletTx(tx, userId);
      wallet.astrite += this.config.currency.weeklyAstrite;
      await walletCol.update({ userId: { $eq: userId } }, wallet);
      return { ok: true as const, astrite: this.config.currency.weeklyAstrite };
    });
  }

  async ensureWalletTx(tx: Database, userId: string): Promise<UserWallet> {
    const walletCol = tx.collection<UserWallet>(COL.wallet);
    let wallet = await walletCol.findOne({ userId: { $eq: userId } });
    if (!wallet) {
      wallet = { userId, astrite: 1600, tide: 0, stellarGlitter: 0 };
      await walletCol.insert(wallet);
    }
    return wallet;
  }

  async getCollection(userId: string): Promise<UserCollectionEntry[]> {
    return this.db.collection<UserCollectionEntry>(COL.collection).find({ userId: { $eq: userId } });
  }

  async getHistory(userId: string, limit = 20, offset = 0): Promise<GachaHistoryRow[]> {
    return this.db
      .collection<GachaHistoryRow>(COL.history)
      .find({ userId: { $eq: userId } }, { limit, offset, orderBy: { pulledAt: 'desc' } });
  }

  async getHistoryCount(userId: string): Promise<number> {
    return this.db.collection<GachaHistoryRow>(COL.history).count({ userId: { $eq: userId } });
  }

  async shopPurchase(userId: string, itemId: string): Promise<{ ok: true } | { ok: false; error: string }> {
    const { DEFAULT_SHOP_ITEMS } = await import('./config.ts');
    const item = DEFAULT_SHOP_ITEMS.find((i) => i.id === itemId);
    if (!item) return { ok: false, error: 'Товар не найден' };

    const dayKey = utcDayKey();
    return this.db.transaction(async (tx) => {
      const dailyCol = tx.collection<{ userId: string; itemId: string; day: string; count: number }>(COL.shopDaily);
      const row = await dailyCol.findOne({ userId: { $eq: userId }, itemId: { $eq: itemId }, day: { $eq: dayKey } });
      const used = row?.count ?? 0;
      if (used >= item.dailyLimit) return { ok: false as const, error: 'Дневной лимит исчерпан' };

      const wallet = await this.ensureWalletTx(tx, userId);
      if (item.costAstrite && wallet.astrite < item.costAstrite) {
        return { ok: false as const, error: 'Недостаточно астрита' };
      }
      if (item.costStellar && wallet.stellarGlitter < item.costStellar) {
        return { ok: false as const, error: 'Недостаточно звёздного блеска' };
      }
      if (item.costAstrite) wallet.astrite -= item.costAstrite;
      if (item.costStellar) wallet.stellarGlitter -= item.costStellar;
      if (item.grants.tide) wallet.tide += item.grants.tide;
      if (item.grants.astrite) wallet.astrite += item.grants.astrite;

      await tx.collection<UserWallet>(COL.wallet).update({ userId: { $eq: userId } }, wallet);
      if (row) {
        row.count += 1;
        await dailyCol.update({ userId: { $eq: userId }, itemId: { $eq: itemId }, day: { $eq: dayKey } }, row);
      } else {
        await dailyCol.insert({ userId, itemId, day: dayKey, count: 1 });
      }
      await tx.collection(COL.shopHistory).insert({
        id: crypto.randomUUID(),
        userId,
        itemId,
        at: new Date().toISOString(),
      });

      return { ok: true as const };
    });
  }

  async adminGrantCurrency(
    adminId: string,
    targetUserId: string,
    patch: Partial<Pick<UserWallet, 'astrite' | 'tide' | 'stellarGlitter'>>,
    reason: string,
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    return this.db.transaction(async (tx) => {
      const wallet = await this.ensureWalletTx(tx, targetUserId);
      if (patch.astrite !== undefined) wallet.astrite = Math.max(0, wallet.astrite + patch.astrite);
      if (patch.tide !== undefined) wallet.tide = Math.max(0, wallet.tide + patch.tide);
      if (patch.stellarGlitter !== undefined) wallet.stellarGlitter = Math.max(0, wallet.stellarGlitter + patch.stellarGlitter);
      await tx.collection<UserWallet>(COL.wallet).update({ userId: { $eq: targetUserId } }, wallet);
      await tx.collection(COL.audit).insert({
        id: crypto.randomUUID(),
        adminId,
        action: 'grant_currency',
        targetUserId,
        details: patch,
        reason,
        at: new Date().toISOString(),
      });
      return { ok: true as const };
    });
  }

  async leaderboardUnique(limit = 10): Promise<{ userId: string; unique: number }[]> {
    const all = await this.db.collection<UserCollectionEntry>(COL.collection).find();
    const counts = new Map<string, number>();
    for (const entry of all) {
      counts.set(entry.userId, (counts.get(entry.userId) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([userId, unique]) => ({ userId, unique }))
      .sort((a, b) => b.unique - a.unique)
      .slice(0, limit);
  }

  async listQuestProgress(userId: string): Promise<
    { questId: string; description: string; progress: number; target: number; claimed: boolean; rewardAstrite: number }[]
  > {
    const { DEFAULT_QUESTS } = await import('./config.ts');
    const dayKey = utcDayKey();
    const weekKey = utcWeekKey();
    const progressCol = this.db.collection<{ userId: string; questId: string; periodKey: string; progress: number }>(
      COL.questProgress,
    );
    const claimedCol = this.db.collection<{ userId: string; questId: string; periodKey: string }>(COL.questClaimed);
    const out = [];
    for (const q of DEFAULT_QUESTS) {
      const periodKey = q.period === 'weekly' ? weekKey : dayKey;
      const prog = await progressCol.findOne({ userId: { $eq: userId }, questId: { $eq: q.id }, periodKey: { $eq: periodKey } });
      const claimed = !!(await claimedCol.findOne({ userId: { $eq: userId }, questId: { $eq: q.id }, periodKey: { $eq: periodKey } }));
      out.push({
        questId: q.id,
        description: q.description,
        progress: prog?.progress ?? 0,
        target: q.target,
        claimed,
        rewardAstrite: q.rewardAstrite,
      });
    }
    return out;
  }

  async claimQuest(userId: string, questId: string): Promise<{ ok: true; astrite: number } | { ok: false; error: string }> {
    const { DEFAULT_QUESTS } = await import('./config.ts');
    const quest = DEFAULT_QUESTS.find((q) => q.id === questId);
    if (!quest) return { ok: false, error: 'Задание не найдено' };
    const periodKey = quest.period === 'weekly' ? utcWeekKey() : utcDayKey();

    return this.db.transaction(async (tx) => {
      const claimedCol = tx.collection<{ userId: string; questId: string; periodKey: string }>(COL.questClaimed);
      if (await claimedCol.findOne({ userId: { $eq: userId }, questId: { $eq: questId }, periodKey: { $eq: periodKey } })) {
        return { ok: false as const, error: 'Награда уже получена' };
      }
      const progressCol = tx.collection<{ userId: string; questId: string; periodKey: string; progress: number }>(
        COL.questProgress,
      );
      const prog = await progressCol.findOne({ userId: { $eq: userId }, questId: { $eq: questId }, periodKey: { $eq: periodKey } });
      if ((prog?.progress ?? 0) < quest.target) {
        return { ok: false as const, error: 'Задание ещё не выполнено' };
      }
      await claimedCol.insert({ userId, questId, periodKey });
      const wallet = await this.ensureWalletTx(tx, userId);
      wallet.astrite += quest.rewardAstrite;
      await tx.collection<UserWallet>(COL.wallet).update({ userId: { $eq: userId } }, wallet);
      return { ok: true as const, astrite: quest.rewardAstrite };
    });
  }

  async createBanner(banner: BannerDef): Promise<{ ok: true } | { ok: false; error: string }> {
    try {
      const col = this.db.collection<BannerDef>(COL.banners);

      for (const charId of banner.poolCharacterIds) {
        if (!this.characters.has(charId)) {
          return { ok: false, error: `Неизвестный персонаж ${charId}` };
        }
      }
      for (const charId of banner.featuredCharacterIds) {
        if (!this.characters.has(charId)) {
          return { ok: false, error: `Неизвестный featured персонаж ${charId}` };
        }
      }

      const sum = banner.rateTable.star4 + banner.rateTable.star5;
      if (Math.abs(sum - 1) > 0.0001) {
        return { ok: false, error: `Сумма rateTable не равна 1 (${sum})` };
      }

      const existing = await col.findOne({ id: { $eq: banner.id } });
      if (existing) {
        return { ok: false, error: `Баннер с ID ${banner.id} уже существует` };
      }

      await col.insert(banner);
      this.banners.set(banner.id, banner);

      return { ok: true };
    } catch (e) {
      this.logger.error('createBanner failed', e);
      return { ok: false, error: 'Ошибка при создании баннера' };
    }
  }
}

interface GachaHistoryRow {
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

function utcDayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function utcWeekKey(d = new Date()): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${week}`;
}

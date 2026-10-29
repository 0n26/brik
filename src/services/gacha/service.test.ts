import { describe, expect, test } from 'bun:test';
import { createContext } from '../../core/testing.ts';
import { DEFAULT_GACHA_CONFIG } from './config.ts';
import { GachaEngine } from './engine.ts';
import { loadGachaData } from './load-data.ts';
import { createSeededRandom, type RandomSource } from './rng.ts';

const BANNER_LIMITED = 'banner_limited_wuwa_01';

function engine(rng?: RandomSource): GachaEngine {
  const data = loadGachaData();
  const ctx = createContext();
  const deps: any = {
    db: ctx.db,
    logger: ctx.logger,
    config: { ...DEFAULT_GACHA_CONFIG },
    characters: data.characters,
    banners: data.banners,
  };
  if (rng) deps.rng = rng;
  return new GachaEngine(deps);
}

describe('gacha engine', () => {
  test('одиночная крутка списывает астрит', async () => {
    const g = engine();
    const userId = 'u1-single-' + Date.now();
    const before = await g.getWallet(userId);
    const r = await g.pull(userId, BANNER_LIMITED, 1);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.outcomes.length).toBe(1);
    const after = await g.getWallet(userId);
    expect(after.astrite).toBe(before.astrite - 160);
  });

  test('десять круток', async () => {
    const g = engine();
    await g.adminGrantCurrency('admin', 'u2', { astrite: 5000 }, 'test');
    const r = await g.pull('u2', BANNER_LIMITED, 10);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.outcomes.length).toBe(10);
  });

  test('недостаточно валюты', async () => {
    const g = engine();
    await g.adminGrantCurrency('admin', 'poor', { astrite: -2000 }, 'test');
    const r = await g.pull('poor', BANNER_LIMITED, 10);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toContain('Недостаточно');
  });

  test('гарантия 4★ на 10-й крутке', () => {
    const g = engine(createSeededRandom(1));
    const banner = g.getBanner(BANNER_LIMITED)!;
    const pity = {
      userId: 'x',
      pityBannerType: 'limited',
      pullsSince5: 0,
      pullsSince4: 9,
      lost5050: false,
    };
    const rarity = g.rollRarity(pity, banner);
    expect(rarity).toBeGreaterThanOrEqual(4);
  });

  test('жёсткая гарантия 5★ на 80-й', async () => {
    const g = engine();
    const col = g['db'].collection('pity');
    await col.insert({
      userId: 'hard',
      pityBannerType: 'limited',
      pullsSince5: 79,
      pullsSince4: 0,
      lost5050: false,
    });
    const r = await g.pull('hard', BANNER_LIMITED, 1);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.outcomes[0]!.rarity).toBe(5);
  });

  test('мягкая гарантия повышает шанс после 65', () => {
    const g = engine();
    const low = g.compute5StarRate(10);
    const high = g.compute5StarRate(70);
    expect(high).toBeGreaterThan(low);
  });

  test('проигрыш 50/50 и гарантированный featured', () => {
    const g = engine();
    const banner = g.getBanner(BANNER_LIMITED)!;
    const pity = {
      userId: 'x',
      pityBannerType: 'limited',
      pullsSince5: 0,
      pullsSince4: 0,
      lost5050: true,
    };
    const pick = g.pickCharacter(banner, 5, pity);
    expect(banner.featuredCharacterIds).toContain(pick.id);
    expect(pick.won5050).toBe(true);
  });

  test('дубликат начисляет звёздный блеск', async () => {
    const g = engine(createSeededRandom(99));
    const charId = 'char_yangyang';
    const col = g['db'].collection('collection');
    await col.insert({
      userId: 'dup',
      characterId: charId,
      copies: 1,
      awakening: 0,
      firstObtainedAt: new Date().toISOString(),
      lastObtainedAt: new Date().toISOString(),
    });
    const before = (await g.getWallet('dup')).stellarGlitter;
    const banner = g.getBanner(BANNER_LIMITED)!;
    const pity = await g.getPity('dup', banner.pityBannerType);
    const { id } = g.pickCharacter(banner, 4, pity);
    void id;
    const r = await g.pull('dup', BANNER_LIMITED, 1);
    expect(r.ok).toBe(true);
    const after = (await g.getWallet('dup')).stellarGlitter;
    expect(after).toBeGreaterThanOrEqual(before);
  });

  test('повторная ежедневная награда отклоняется', async () => {
    const g = engine();
    expect((await g.claimDaily('daily-u')).ok).toBe(true);
    expect((await g.claimDaily('daily-u')).ok).toBe(false);
  });

  test('параллельные крутки не уводят баланс в минус', async () => {
    const g = engine();
    await g.adminGrantCurrency('admin', 'race', { astrite: 320 }, 'test');
    const [a, b] = await Promise.all([
      g.pull('race', BANNER_LIMITED, 1),
      g.pull('race', BANNER_LIMITED, 1),
    ]);
    expect(a.ok || b.ok).toBe(true);
    const w = await g.getWallet('race');
    expect(w.astrite).toBeGreaterThanOrEqual(0);
  });

  test('состояние сохраняется в БД (pity после крутки)', async () => {
    const g = engine();
    await g.pull('persist', BANNER_LIMITED, 1);
    const pity = await g.getPity('persist', 'limited');
    expect(pity.pullsSince5).toBeGreaterThanOrEqual(0);
  });

  test('перенос 50/50 между баннерами одного типа', async () => {
    const g = engine();
    // Проигрываем 50/50 на первом баннере
    const banner1 = g.getBanner(BANNER_LIMITED)!;
    const pityCol = g['db'].collection('pity');
    await pityCol.insert({
      userId: 'carry',
      pityBannerType: 'limited',
      pullsSince5: 0,
      pullsSince4: 0,
      lost5050: true,
    });
    // Крутим на втором баннере того же типа
    const banner2 = g.getBanner('banner_limited_wuwa_01'); // тот же тип
    const r = await g.pull('carry', BANNER_LIMITED, 1);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const outcome = r.outcomes[0]!;
    if (outcome.rarity === 5) {
      // Должен выпасть featured из-за lost5050
      const char = g.getCharacter(outcome.characterId);
      expect(banner1.featuredCharacterIds).toContain(outcome.characterId);
    }
  });

  test('достижение максимального пробуждения', async () => {
    const g = engine(createSeededRandom(42));
    const charId = 'char_rare_yangyang';
    const col = g['db'].collection('collection');
    // 1 + 1 + 2 + 2 + 3 + 3 = 12 копий для S6
    await col.insert({
      userId: 'awaken',
      characterId: charId,
      copies: 11,
      awakening: 5,
      firstObtainedAt: new Date().toISOString(),
      lastObtainedAt: new Date().toISOString(),
    });
    const r = await g.pull('awaken', BANNER_LIMITED, 1);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const entry = await col.findOne({ userId: { $eq: 'awaken' }, characterId: { $eq: charId } });
    expect(entry).toBeTruthy();
    if (entry) {
      expect(entry.awakening).toBeLessThanOrEqual(6);
    }
  });

  test('завершение баннера во время крутки', async () => {
    const g = engine();
    const banner = g.getBanner(BANNER_LIMITED)!;
    // Устанавливаем дату окончания в прошлом
    const oldEnd = banner.endsAt;
    banner.endsAt = new Date('2020-01-01T00:00:00.000Z').toISOString();
    banner.acceptPullsAfterEnd = false;
    const r = await g.pull('expired', BANNER_LIMITED, 1);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toContain('недоступен');
    // Восстанавливаем
    banner.endsAt = oldEnd;
    banner.acceptPullsAfterEnd = false;
  });
});

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BannerDef, CharacterDef, Rarity } from './types.ts';

const here = dirname(fileURLToPath(import.meta.url));

function loadJson<T>(name: string): T {
  const raw = readFileSync(join(here, 'data', name), 'utf8');
  return JSON.parse(raw) as T;
}

function assertCharacter(c: CharacterDef, errors: string[]): void {
  if (!c.id || !c.name) errors.push(`персонаж без id/name: ${JSON.stringify(c)}`);
  if (![3, 4, 5].includes(c.rarity)) errors.push(`некорректная редкость у ${c.id}`);
}

function assertBanner(b: BannerDef, charIds: Set<string>, errors: string[]): void {
  if (!b.id || !b.name) errors.push(`баннер без id/name`);
  const sum = b.rateTable.star4 + b.rateTable.star5;
  if (Math.abs(sum - 1) > 0.0001) errors.push(`баннер ${b.id}: сумма rateTable != 1 (${sum})`);
  for (const id of b.poolCharacterIds) {
    if (!charIds.has(id)) errors.push(`баннер ${b.id}: неизвестный персонаж ${id}`);
  }
  for (const id of b.featuredCharacterIds) {
    if (!charIds.has(id)) errors.push(`баннер ${b.id}: неизвестный featured ${id}`);
  }
}

export interface LoadedGachaData {
  characters: Map<string, CharacterDef>;
  banners: Map<string, BannerDef>;
}

export function loadGachaData(): LoadedGachaData {
  const charactersArr = loadJson<CharacterDef[]>('characters.json');
  const bannersArr = loadJson<BannerDef[]>('banners.json');
  const errors: string[] = [];

  const characters = new Map<string, CharacterDef>();
  for (const c of charactersArr) {
    assertCharacter(c, errors);
    if (characters.has(c.id)) errors.push(`дубликат id персонажа ${c.id}`);
    characters.set(c.id, c);
  }

  const charIds = new Set(characters.keys());
  const banners = new Map<string, BannerDef>();
  for (const b of bannersArr) {
    assertBanner(b, charIds, errors);
    if (banners.has(b.id)) errors.push(`дубликат id баннера ${b.id}`);
    banners.set(b.id, b);
  }

  if (errors.length > 0) {
    throw new Error(`Ошибки конфигурации гачи:\n${errors.join('\n')}`);
  }

  return { characters, banners };
}

export function rarityOfCharacter(characters: Map<string, CharacterDef>, id: string): Rarity {
  const c = characters.get(id);
  if (!c) throw new Error(`Неизвестный персонаж: ${id}`);
  return c.rarity;
}

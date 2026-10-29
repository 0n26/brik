
import type { ComponentRow } from '../../core/index.ts';

export interface WalletView {
  astrite: number;
  tide: number;
  stellarGlitter: number;
}

export interface BannerView {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  type: string;
  endsAt: string | null;
  featuredCharacterIds: string[];
  featuredCharacterNames?: string[];
  rateTable?: { star4: number; star5: number };
  pityBannerType?: string;
}

export interface PityView {
  pullsSince5: number;
  pullsSince4: number;
  lost5050: boolean;
}

export interface PullLine {
  characterId: string;
  name: string;
  rarity: 3 | 4 | 5;
  isNew: boolean;
  copiesAfter: number;
  duplicateCompensation: number;
}

export interface CharacterView {
  id: string;
  name: string;
  rarity: 3 | 4 | 5;
  element: string;
  weapon: string;
  faction: string;
  description: string;
  imageUrl: string;
}

export const RARITY_LABEL: Record<3 | 4 | 5, string> = {
  3: '3★ · Редкий',
  4: '4★ · Эпический',
  5: '5★ · Легендарный',
};

const RARITY_COLOR: Record<3 | 4 | 5, number> = {
  3: 0x6479b8,
  4: 0x9b59b6,
  5: 0xf1c40f,
};

const RARITY_EMOJI: Record<3 | 4 | 5, string> = {
  3: '💎',
  4: '💜',
  5: '🌟',
};

const ELEMENT_EMOJI: Record<string, string> = {
  Spectro: '⚪',
  Havoc: '🔴',
  Aero: '🟢',
  Electro: '🟣',
  Fusion: '🔥',
  Glacio: '❄️',
};

const number = (value: number): string =>
  Math.max(0, value).toLocaleString('ru-RU');

const validDate = (value: string | null): Date | null => {
  if (!value) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatPercent = (value: number): string =>
  `${(value * 100).toLocaleString('ru-RU', {
    maximumFractionDigits: 2,
  })}%`;

const progressBar = (current: number, max: number, size = 12): string => {
  const safeCurrent = Math.max(0, current);
  const progress = Math.min(1, safeCurrent / max);
  const filled = Math.round(progress * size);

  return `${'▰'.repeat(filled)}${'▱'.repeat(size - filled)}`;
};

const bannerType = (type: string) => {
  switch (type) {
    case 'limited':
      return { emoji: '🎯', label: 'Лимитированный', color: 0xe67e22 };
    case 'standard':
      return { emoji: '⭐', label: 'Постоянный', color: 0x3498db };
    default:
      return { emoji: '🎪', label: 'Событийный', color: 0x9b59b6 };
  }
};

export const formatWallet = (wallet: WalletView): string =>
  [
    `💎 **Астрит**  \`${number(wallet.astrite)}\``,
    `🎫 **Прилив**  \`${number(wallet.tide)}\``,
    `✨ **Звёздный блеск**  \`${number(wallet.stellarGlitter)}\``,
  ].join('\n');

export const bannerEmbed = (
  banner: BannerView,
  wallet: WalletView,
  pity?: PityView,
) => {
  const type = bannerType(banner.type);
  const ends = validDate(banner.endsAt);

  const timeText = !ends
    ? '♾️ Без ограничения по времени'
    : ends.getTime() <= Date.now()
      ? '⏹️ Баннер завершён'
      : `⏳ Завершится <t:${Math.floor(ends.getTime() / 1000)}:R>`;

  const featuredName =
    banner.featuredCharacterNames?.[0] ??
    banner.featuredCharacterIds?.[0] ??
    'Не указан';

  const rates = banner.rateTable ?? {
    star4: 0.992,
    star5: 0.008,
  };

  const pityFields = pity
    ? [
        {
          name: '🌟 Гарантия 5★',
          value:
            `${progressBar(pity.pullsSince5, 80)}\n` +
            `\`${Math.min(pity.pullsSince5, 80)}/80\` · Осталось **${Math.max(0, 80 - pity.pullsSince5)}**`,
          inline: true,
        },
        {
          name: '💜 Гарантия 4★',
          value:
            `${progressBar(pity.pullsSince4, 10)}\n` +
            `\`${Math.min(pity.pullsSince4, 10)}/10\` · Осталось **${Math.max(0, 10 - pity.pullsSince4)}**`,
          inline: true,
        },
        {
          name: '⚖️ Гарантия персонажа',
          value: pity.lost5050
            ? '🔒 **Гарантирован**\nСледующий 5★ — персонаж баннера'
            : '🎲 **50/50**\nЛимитированный персонаж не гарантирован',
          inline: false,
        },
      ]
    : [];

  return {
    title: `${type.emoji} ${banner.name}`,
    description:
      `${banner.description}\n\n` +
      `${type.emoji} **${type.label} баннер**\n` +
      `${timeText}`,
    color: type.color,
    ...(banner.imageUrl ? { image: { url: banner.imageUrl } } : {}),
    fields: [
      {
        name: '🌟 Персонаж баннера',
        value: `**${featuredName}** · 5★`,
        inline: true,
      },
      {
        name: '🎰 Шанс 5★',
        value: `**${formatPercent(rates.star5)}**`,
        inline: true,
      },
      {
        name: '🛡️ Гарантия',
        value: '**80 круток**',
        inline: true,
      },
      ...pityFields,
      {
        name: '💰 Твои ресурсы',
        value: formatWallet(wallet),
        inline: false,
      },
    ],
    footer: {
      text: '1 крутка — 160 астрита • 10 круток — 1600 астрита',
    },
  };
};

export const pullResultEmbed = (lines: PullLine[]) => {
  if (lines.length === 0) {
    return {
      title: '🎰 Результаты крутки',
      description: 'Не удалось получить результаты. Попробуй ещё раз.',
      color: 0x747f8d,
    };
  }

  const best = lines.reduce<3 | 4 | 5>(
    (max, line) => (line.rarity > max ? line.rarity : max),
    3,
  );

  const has5Star = lines.some((line) => line.rarity === 5);
  const hasNew = lines.some((line) => line.isNew);
  const totalCompensation = lines.reduce(
    (sum, line) => sum + line.duplicateCompensation,
    0,
  );

  const byRarity: Record<3 | 4 | 5, string[]> = {
    5: [],
    4: [],
    3: [],
  };

  for (const line of lines) {
    const emoji = RARITY_EMOJI[line.rarity];
    const ownership = line.isNew
      ? '🆕 Новый персонаж'
      : `🔁 Копия №${line.copiesAfter}`;

    const compensation =
      line.duplicateCompensation > 0
        ? ` · +${number(line.duplicateCompensation)} ✨`
        : '';

    byRarity[line.rarity].push(
      `${emoji} **${line.name}**\n└ ${ownership}${compensation}`,
    );
  }

  const sections = [
    { rarity: 5 as const, title: '🌟 ЛЕГЕНДАРНЫЕ · 5★' },
    { rarity: 4 as const, title: '💜 ЭПИЧЕСКИЕ · 4★' },
    { rarity: 3 as const, title: '💎 РЕДКИЕ · 3★' },
  ]
    .filter(({ rarity }) => byRarity[rarity].length > 0)
    .map(
      ({ rarity, title }) =>
        `**${title}**\n${byRarity[rarity].join('\n')}`,
    );

  const title = has5Star
    ? '🌟 Великолепно! Получен персонаж 5★'
    : lines.length > 1
      ? '🎰 Результаты десяти круток'
      : '🎰 Результат крутки';

  return {
    title,
    description: sections.join('\n\n'),
    color: RARITY_COLOR[best],
    fields: [
      {
        name: '📊 Результат',
        value:
          `Всего круток: **${lines.length}**\n` +
          `Новых персонажей: **${lines.filter((line) => line.isNew).length}**`,
        inline: true,
      },
      ...(totalCompensation > 0
        ? [
            {
              name: '✨ Компенсация',
              value: `**+${number(totalCompensation)}** звёздного блеска`,
              inline: true,
            },
          ]
        : []),
    ],
    ...(hasNew
      ? { footer: { text: '🆕 Новые персонажи добавлены в коллекцию!' } }
      : {}),
  };
};

export const characterEmbed = (
  character: CharacterView,
  entry?: { copies: number; awakening: number },
) => {
  const elementEmoji = ELEMENT_EMOJI[character.element] ?? '◻️';

  return {
    title: `${RARITY_EMOJI[character.rarity]} ${character.name}`,
    description:
      `${character.description || 'Описание пока отсутствует.'}\n\n` +
      `**${RARITY_LABEL[character.rarity]}**`,
    color: RARITY_COLOR[character.rarity],
    ...(character.imageUrl ? { image: { url: character.imageUrl } } : {}),
    fields: [
      {
        name: '🔮 Элемент',
        value: `${elementEmoji} ${character.element || 'Неизвестен'}`,
        inline: true,
      },
      {
        name: '⚔️ Оружие',
        value: character.weapon || 'Неизвестно',
        inline: true,
      },
      {
        name: '🏛️ Фракция',
        value: character.faction || 'Неизвестна',
        inline: true,
      },
      ...(entry
        ? [
            {
              name: '📚 Коллекция',
              value: `Копий: **${entry.copies}**`,
              inline: true,
            },
            {
              name: '🌟 Пробуждение',
              value: `**S${Math.min(6, Math.max(0, entry.awakening))} / S6**`,
              inline: true,
            },
          ]
        : []),
    ],
    ...(!entry
      ? {
          footer: {
            text: '💡 Получи персонажа через гачу, чтобы добавить его в коллекцию',
          },
        }
      : {}),
  };
};

export const pullRows = (bannerId: string): ComponentRow[] => [
  {
    buttons: [
      {
        id: `pull:${bannerId}:1`,
        label: '🎫 1 крутка',
        style: 'primary',
      },
      {
        id: `pull:${bannerId}:10`,
        label: '✨ 10 круток',
        style: 'success',
      },
    ],
  },
  {
    buttons: [
      {
        id: 'nav:collection',
        label: '📚 Коллекция',
        style: 'secondary',
      },
      {
        id: 'nav:history',
        label: '📜 История',
        style: 'secondary',
      },
      {
        id: 'nav:rates',
        label: '📊 Шансы',
        style: 'secondary',
      },
    ],
  },
];

export const mainMenuRows = (
  banners: BannerView[],
): ComponentRow[] => {
  const bannerButtons = banners.slice(0, 4).map((banner) => {
    const type = bannerType(banner.type);

    return {
      id: `view:${banner.id}`,
      label: `${type.emoji} ${banner.name}`.slice(0, 80),
      style: 'primary' as const,
    };
  });

  const rows: ComponentRow[] = [];

  // Discord разрешает максимум 5 кнопок в одном ряду.
  if (bannerButtons.length > 0) {
    rows.push({ buttons: bannerButtons });
  }

  rows.push({
    buttons: [
      {
        id: 'nav:collection',
        label: '📚 Коллекция',
        style: 'secondary',
      },
      {
        id: 'nav:history',
        label: '📜 История',
        style: 'secondary',
      },
      {
        id: 'nav:inventory',
        label: '🎒 Инвентарь',
        style: 'secondary',
      },
    ],
  });

  return rows;
};

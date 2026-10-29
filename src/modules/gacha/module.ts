import { arg, defineHandler, defineModule } from '../../core/index.ts';
import type { BannerDef } from '../../services/gacha/types.ts';
import {
  bannerEmbed,
  characterEmbed,
  formatWallet,
  mainMenuRows,
  pullResultEmbed,
  pullRows,
  RARITY_LABEL,
  type PullLine,
} from './ui.ts';

const guildCaps = ['SendMessages', 'EmbedLinks'] as const;

type PullOutcome = {
  characterId: string;
  rarity: 3 | 4 | 5;
  isNew: boolean;
  copiesAfter: number;
  duplicateCompensation: number;
};

const toPullLines = (
  outcomes: PullOutcome[],
  nameOf: (id: string) => string,
): PullLine[] =>
  outcomes.map((outcome) => ({
    ...outcome,
    name: nameOf(outcome.characterId),
  }));

const rarityEmoji = (rarity: number): string =>
  rarity === 5 ? '🌟' : rarity === 4 ? '💜' : '💎';

const truncate = (value: string, maxLength: number): string =>
  value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;

export default defineModule({
  name: 'gacha',
  description: 'Гача-система: баннеры, крутки, коллекция и награды',
  services: ['gacha'],
  handlers: [
    // Главный экран гачи. Если баннеры есть, сразу открываем первый активный.
    defineHandler({
      name: 'gacha',
      description: 'Главное меню гачи: баннеры, баланс и навигация',
      capabilities: [...guildCaps],
      preconditions: [{ type: 'guildOnly' }],
      run: async ({ input, services }) => {
        const g = services.gacha!;
        const wallet = await g.getWallet(input.author.id);
        const banners = g.getActiveBanners();

        if (banners.length === 0) {
          return {
            kind: 'embed',
            embed: {
              title: '🎰 Anihub Gacha',
              description: '📭 Сейчас нет активных баннеров.\nЗагляни позже!',
              color: 0x747f8d,
              fields: [
                {
                  name: '💰 Твои ресурсы',
                  value: formatWallet(wallet),
                  inline: false,
                },
              ],
              footer: { text: 'Anihub Gacha' },
            },
          };
        }

        const banner = banners[0]!;
        const pity = await g.getPity(input.author.id, banner.pityBannerType);

        // Три ряда максимум для этого экрана: крутки, выбор баннера, навигация.
        const bannerButtons = mainMenuRows(banners)[0];

        return {
          kind: 'multiple',
          results: [
            {
              kind: 'embed',
              embed: bannerEmbed(banner, wallet, pity) as any,
            },
            {
              kind: 'component',
              content: 'Выбери крутку или открой другой раздел:',
              rows: [
                pullRows(banner.id)[0]!,
                ...(banners.length > 1 && bannerButtons
                  ? [bannerButtons]
                  : []),
                {
                  buttons: [
                    { id: 'nav:collection', label: '📚 Коллекция', style: 'secondary' },
                    { id: 'nav:history', label: '📜 История', style: 'secondary' },
                    { id: 'nav:stats', label: '📊 Статистика', style: 'secondary' },
                  ],
                },
              ],
            },
          ],
        };
      },
      components: [
        {
          id: 'view',
          description: 'Открыть баннер',
          run: async ({ payload, input, services }) => {
            const g = services.gacha!;
            const banner = g.getBanner(payload);

            if (!banner) {
              return {
                kind: 'message',
                content: 'Баннер не найден или больше не существует.',
                ephemeral: true,
              };
            }

            const activeBannerIds = new Set(g.getActiveBanners().map((item) => item.id));
            if (!activeBannerIds.has(banner.id)) {
              return {
                kind: 'message',
                content: 'Этот баннер сейчас не активен.',
                ephemeral: true,
              };
            }

            const wallet = await g.getWallet(input.author.id);
            const pity = await g.getPity(input.author.id, banner.pityBannerType);

            return {
              kind: 'update',
              result: {
                kind: 'multiple',
                results: [
                  {
                    kind: 'embed',
                    embed: bannerEmbed(banner, wallet, pity) as any,
                  },
                  {
                    kind: 'component',
                    content: 'Выбери количество круток:',
                    rows: [
                      pullRows(banner.id)[0]!,
                      ...(g.getActiveBanners().length > 1
                        ? [mainMenuRows(g.getActiveBanners())[0]!]
                        : []),
                      {
                        buttons: [
                          { id: 'nav:collection', label: '📚 Коллекция', style: 'secondary' },
                          { id: 'nav:history', label: '📜 История', style: 'secondary' },
                          { id: 'nav:stats', label: '📊 Статистика', style: 'secondary' },
                        ],
                      },
                    ],
                  },
                ],
              },
            } as any;
          },
        },
        {
          id: 'pull',
          description: 'Выполнить крутку с экрана баннера',
          run: async ({ payload, input, services }) => {
            const [bannerId, countText] = payload.split(':');
            const count = Number(countText) === 10 ? 10 : 1;

            if (!bannerId) {
              return {
                kind: 'message',
                content: 'Не удалось определить баннер. Открой меню гачи заново.',
                ephemeral: true,
              };
            }

            const g = services.gacha!;
            const banner = g.getBanner(bannerId);

            if (!banner || !g.getActiveBanners().some((item) => item.id === bannerId)) {
              return {
                kind: 'message',
                content: 'Этот баннер больше не активен. Открой `/gacha`, чтобы выбрать актуальный баннер.',
                ephemeral: true,
              };
            }

            const result = await g.pull(input.author.id, bannerId, count as 1 | 10);

            if (!result.ok) {
              return {
                kind: 'message',
                content: result.error,
                ephemeral: true,
              };
            }

            const lines = toPullLines(
              result.outcomes,
              (id) => g.getCharacter(id)?.name ?? id,
            );
            const wallet = await g.getWallet(input.author.id);
            const pity = await g.getPity(input.author.id, banner.pityBannerType);

            return {
              kind: 'update',
              result: {
                kind: 'multiple',
                results: [
                  {
                    kind: 'embed',
                    embed: pullResultEmbed(lines) as any,
                  },
                  {
                    kind: 'component',
                    content:
                      `**${banner.name}**\n` +
                      `Списано: **${result.spent.astrite.toLocaleString('ru-RU')}** астрита, ` +
                      `**${result.spent.tide.toLocaleString('ru-RU')}** билетов\n\n` +
                      `${formatWallet(wallet)}\n\n` +
                      `🌟 До гарантии 5★: **${Math.max(0, 80 - pity.pullsSince5)}** круток · ` +
                      `💜 До 4★+: **${Math.max(0, 10 - pity.pullsSince4)}** круток\n` +
                      `⚖️ 50/50: **${pity.lost5050 ? 'Следующий 5★ гарантирован' : 'Не гарантирован'}**`,
                    rows: [
                      pullRows(banner.id)[0]!,
                      ...(g.getActiveBanners().length > 1
                        ? [mainMenuRows(g.getActiveBanners())[0]!]
                        : []),
                      {
                        buttons: [
                          { id: 'nav:collection', label: '📚 Коллекция', style: 'secondary' },
                          { id: 'nav:history', label: '📜 История', style: 'secondary' },
                          { id: 'nav:stats', label: '📊 Статистика', style: 'secondary' },
                        ],
                      },
                    ],
                  },
                ],
              },
            } as any;
          },
        },
        {
          id: 'nav',
          description: 'Навигация по разделам гачи',
          run: async ({ payload, input, services }) => {
            const g = services.gacha!;

            if (payload === 'collection') {
              const items = await g.getCollection(input.author.id);

              const lines = items
                .sort((a, b) => {
                  const ca = g.getCharacter(a.characterId);
                  const cb = g.getCharacter(b.characterId);
                  return (cb?.rarity ?? 0) - (ca?.rarity ?? 0);
                })
                .slice(0, 40)
                .map((entry) => {
                  const character = g.getCharacter(entry.characterId);
                  const rarity = character?.rarity ?? 3;
                  return `${rarityEmoji(rarity)} **${character?.name ?? entry.characterId}** · ×${entry.copies} · S${entry.awakening}/6`;
                });

              return {
                kind: 'embed',
                embed: {
                  title: '📚 Твоя коллекция',
                  description: lines.length > 0
                    ? lines.join('\n')
                    : '📭 Коллекция пока пуста.\nИспользуй крутки, чтобы получить первых персонажей.',
                  color: 0x8e44ad,
                  footer: { text: `Уникальных персонажей: ${items.length}` },
                },
                ephemeral: true,
              };
            }

            if (payload === 'history') {
              const rows = await g.getHistory(input.author.id, 20, 0);
              const lines = rows.map((item) => {
                const row = item as {
                  characterId: string;
                  rarity: number;
                  pulledAt: string;
                  bannerId?: string;
                };
                const character = g.getCharacter(row.characterId);
                const date = new Date(row.pulledAt);
                const dateText = Number.isNaN(date.getTime())
                  ? row.pulledAt.slice(0, 10)
                  : date.toLocaleDateString('ru-RU');
                return `${rarityEmoji(row.rarity)} \`${dateText}\` **${character?.name ?? row.characterId}**`;
              });

              return {
                kind: 'embed',
                embed: {
                  title: '📜 Последние крутки',
                  description: lines.length > 0 ? lines.join('\n') : '📭 История круток пуста.',
                  color: 0x34495e,
                  footer: { text: 'Показаны последние 20 записей' },
                },
                ephemeral: true,
              };
            }

            if (payload === 'inventory') {
              const wallet = await g.getWallet(input.author.id);
              return {
                kind: 'embed',
                embed: {
                  title: '🎒 Инвентарь',
                  description: formatWallet(wallet),
                  color: 0x2980b9,
                },
                ephemeral: true,
              };
            }

            if (payload === 'rates' || payload === 'stats') {
              const cfg = g.config.rates;
              return {
                kind: 'embed',
                embed: {
                  title: '📊 Шансы и правила гачи',
                  color: 0x1abc9c,
                  fields: [
                    {
                      name: '🌟 Персонаж 5★',
                      value:
                        `Базовый шанс: **${(cfg.base5Star * 100).toLocaleString('ru-RU', { maximumFractionDigits: 2 })}%**\n` +
                        `Мягкая гарантия: с **${cfg.softPityStart}**-й крутки\n` +
                        `Жёсткая гарантия: **${cfg.hardPity5}**-я крутка`,
                      inline: false,
                    },
                    {
                      name: '💜 Персонаж 4★ или выше',
                      value:
                        `Базовый шанс: **${(cfg.base4Star * 100).toLocaleString('ru-RU', { maximumFractionDigits: 2 })}%**\n` +
                        `Гарантия: каждые **${cfg.guarantee4Every}** круток`,
                      inline: false,
                    },
                    {
                      name: '⚖️ Лимитированный персонаж',
                      value:
                        `Шанс выиграть 50/50: **${(cfg.limitedFeaturedRateOn5 * 100).toFixed(0)}%**\n` +
                        'При проигрыше следующая 5★ гарантированно будет лимитированным персонажем.',
                      inline: false,
                    },
                  ],
                  footer: {
                    text: 'Точные параметры берутся из конфигурации гача-сервиса.',
                  },
                },
                ephemeral: true,
              };
            }

            return {
              kind: 'message',
              content: 'Неизвестное действие меню.',
              ephemeral: true,
            };
          },
        },
      ],
    }),

    defineHandler({
      name: 'banner',
      description: 'Активные баннеры и условия выпадения',
      capabilities: [...guildCaps],
      preconditions: [{ type: 'guildOnly' }],
      run: async ({ services }) => {
        const g = services.gacha!;
        const banners = g.getActiveBanners();

        if (banners.length === 0) {
          return {
            kind: 'embed',
            embed: {
              title: '🎰 Активные баннеры',
              description: '📭 Сейчас нет активных баннеров.',
              color: 0x7f8c8d,
            },
          };
        }

        const description = banners
          .map((banner) => {
            const emoji =
              banner.type === 'limited' ? '🎯' :
              banner.type === 'standard' ? '⭐' : '🎪';
            return (
              `**${emoji} ${banner.name}**\n` +
              `ID: \`${banner.id}\`\n` +
              `Тип: ${banner.type}\n` +
              `${banner.description || 'Описание отсутствует.'}`
            );
          })
          .join('\n\n');

        return {
          kind: 'embed',
          embed: {
            title: '🎰 Активные баннеры',
            description: truncate(description, 4000),
            color: 0x3498db,
            footer: { text: `Активных баннеров: ${banners.length}` },
          },
        };
      },
    }),

    defineHandler({
      name: 'pull',
      description: 'Выполнить крутку на баннере',
      capabilities: [...guildCaps],
      preconditions: [{ type: 'guildOnly' }],
      args: {
        banner: arg.string('ID баннера'),
        count: arg.enum('Количество', ['1', '10']).default('1'),
      },
      run: async ({ args, input, services }) => {
        const g = services.gacha!;
        const count = args.count === '10' ? 10 : 1;
        const banner = g.getBanner(args.banner);

        if (!banner || !g.getActiveBanners().some((item) => item.id === args.banner)) {
          return {
            kind: 'message',
            content: 'Баннер не найден или не активен.',
            ephemeral: true,
          };
        }

        const result = await g.pull(input.author.id, args.banner, count as 1 | 10);

        if (!result.ok) {
          return { kind: 'message', content: result.error, ephemeral: true };
        }

        const lines = toPullLines(
          result.outcomes,
          (id) => g.getCharacter(id)?.name ?? id,
        );

        const wallet = await g.getWallet(input.author.id);
        const pity = await g.getPity(input.author.id, banner.pityBannerType);

        return {
          kind: 'multiple',
          results: [
            { kind: 'embed', embed: pullResultEmbed(lines) as any },
            {
              kind: 'message',
              content:
                `Баннер: **${banner.name}**\n` +
                `Списано: ${result.spent.astrite.toLocaleString('ru-RU')} астрита, ` +
                `${result.spent.tide.toLocaleString('ru-RU')} билетов\n\n` +
                `${formatWallet(wallet)}\n` +
                `До гарантии 5★: ${Math.max(0, 80 - pity.pullsSince5)} круток`,
            },
          ],
        };
      },
    }),

    defineHandler({
      name: 'collection',
      description: 'Коллекция персонажей',
      capabilities: [...guildCaps],
      preconditions: [{ type: 'guildOnly' }],
      args: {
        sort: arg.enum('Сортировка', ['rarity', 'name', 'date', 'copies']).default('rarity'),
        page: arg.integer('Страница').default(1),
      },
      run: async ({ args, input, services }) => {
        const g = services.gacha!;
        const pageSize = 10;
        let items = [...await g.getCollection(input.author.id)];

        items.sort((a, b) => {
          const ca = g.getCharacter(a.characterId);
          const cb = g.getCharacter(b.characterId);

          if (args.sort === 'name') {
            return (ca?.name ?? '').localeCompare(cb?.name ?? '', 'ru');
          }
          if (args.sort === 'date') {
            return b.firstObtainedAt.localeCompare(a.firstObtainedAt);
          }
          if (args.sort === 'copies') return b.copies - a.copies;
          return (cb?.rarity ?? 0) - (ca?.rarity ?? 0);
        });

        const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
        const page = Math.min(Math.max(1, args.page), totalPages);
        const slice = items.slice((page - 1) * pageSize, page * pageSize);

        const description = slice.length === 0
          ? '📭 Коллекция пока пуста.\nИспользуй `/gacha`, чтобы начать крутки.'
          : slice.map((entry) => {
              const character = g.getCharacter(entry.characterId);
              const rarity = character?.rarity ?? 3;
              return `${rarityEmoji(rarity)} **${character?.name ?? entry.characterId}** · ${RARITY_LABEL[rarity]} · ×${entry.copies} · S${entry.awakening}/6`;
            }).join('\n');

        return {
          kind: 'embed',
          embed: {
            title: `📚 Коллекция персонажей · ${page}/${totalPages}`,
            description,
            color: 0x8e44ad,
            footer: {
              text: `${items.length} уникальных персонажей · Сортировка: ${args.sort}`,
            },
          },
        };
      },
    }),

    defineHandler({
      name: 'character',
      description: 'Информация о персонаже',
      capabilities: [...guildCaps],
      preconditions: [{ type: 'guildOnly' }],
      args: {
        query: arg.string('Имя или ID персонажа'),
      },
      run: async ({ args, input, services }) => {
        const g = services.gacha!;
        const query = args.query.trim().toLocaleLowerCase('ru');
        const characters = g.listCharacters();
        const found =
          characters.find((character) => character.id === args.query) ??
          characters.find((character) => character.name.toLocaleLowerCase('ru') === query);

        if (!found) {
          return {
            kind: 'message',
            content: 'Персонаж не найден. Проверь имя или ID.',
            ephemeral: true,
          };
        }

        const collection = await g.getCollection(input.author.id);
        const entry = collection.find((item) => item.characterId === found.id);

        return {
          kind: 'embed',
          embed: characterEmbed(
            found,
            entry ? { copies: entry.copies, awakening: entry.awakening } : undefined,
          ) as any,
        };
      },
    }),

    defineHandler({
      name: 'pity',
      description: 'Прогресс гарантий',
      capabilities: [...guildCaps],
      preconditions: [{ type: 'guildOnly' }],
      args: {
        banner: arg.string('ID баннера').optional(),
      },
      run: async ({ args, input, services }) => {
        const g = services.gacha!;
        const banner =
          (args.banner ? g.getBanner(args.banner) : undefined) ??
          g.getActiveBanners()[0];

        if (!banner) {
          return { kind: 'message', content: 'Не удалось найти баннер для проверки гарантии.' };
        }

        const pity = await g.getPity(input.author.id, banner.pityBannerType);
        const left5 = Math.max(0, 80 - pity.pullsSince5);
        const left4 = Math.max(0, 10 - pity.pullsSince4);

        return {
          kind: 'embed',
          embed: {
            title: `📈 Гарантии · ${banner.name}`,
            color: 0xe67e22,
            fields: [
              {
                name: '🌟 Гарантия 5★',
                value: `\`${pity.pullsSince5}/80\`\nОсталось: **${left5}** круток`,
                inline: true,
              },
              {
                name: '💜 Гарантия 4★+',
                value: `\`${pity.pullsSince4}/10\`\nОсталось: **${left4}** круток`,
                inline: true,
              },
              {
                name: '⚖️ 50/50',
                value: pity.lost5050
                  ? '🔒 Следующий 5★ гарантированно будет лимитированным.'
                  : '🎲 Лимитированный персонаж не гарантирован.',
                inline: false,
              },
              {
                name: '📊 Тип гарантии',
                value: `\`${banner.pityBannerType}\``,
                inline: false,
              },
            ],
            footer: { text: 'Прогресс зависит от типа баннера и сохраняется согласно настройкам системы.' },
          },
        };
      },
    }),

    defineHandler({
      name: 'history',
      description: 'История круток',
      capabilities: [...guildCaps],
      preconditions: [{ type: 'guildOnly' }],
      args: {
        page: arg.integer('Страница').default(1),
      },
      run: async ({ args, input, services }) => {
        const g = services.gacha!;
        const limit = 20;
        const page = Math.max(1, args.page);
        const total = await g.getHistoryCount(input.author.id);
        const rows = await g.getHistory(input.author.id, limit, (page - 1) * limit);

        const lines = rows.map((item) => {
          const row = item as {
            pulledAt: string;
            rarity: number;
            characterId: string;
            bannerId: string;
          };
          const character = g.getCharacter(row.characterId);
          const date = new Date(row.pulledAt);
          const dateText = Number.isNaN(date.getTime())
            ? row.pulledAt.slice(0, 10)
            : date.toLocaleString('ru-RU');
          return `\`${dateText}\` ${rarityEmoji(row.rarity)} **${character?.name ?? row.characterId}** · \`${row.bannerId}\``;
        });

        return {
          kind: 'embed',
          embed: {
            title: `📜 История круток · страница ${page}`,
            description: lines.length > 0 ? truncate(lines.join('\n'), 4000) : '📭 История круток пуста.',
            color: 0x34495e,
            footer: { text: `Всего записей: ${total}` },
          },
        };
      },
    }),

    defineHandler({
      name: 'daily',
      description: 'Ежедневная награда (UTC)',
      preconditions: [{ type: 'guildOnly' }],
      run: async ({ input, services }) => {
        const result = await services.gacha!.claimDaily(input.author.id);
        if (!result.ok) {
          return { kind: 'message', content: result.error, ephemeral: true };
        }
        return {
          kind: 'embed',
          embed: {
            title: '🎁 Ежедневная награда',
            description: `Награда получена!\n\n💎 **+${result.astrite.toLocaleString('ru-RU')} астрита**`,
            color: 0x27ae60,
          },
          ephemeral: true,
        };
      },
    }),

    defineHandler({
      name: 'weekly',
      description: 'Еженедельная награда (UTC)',
      preconditions: [{ type: 'guildOnly' }],
      run: async ({ input, services }) => {
        const result = await services.gacha!.claimWeekly(input.author.id);
        if (!result.ok) {
          return { kind: 'message', content: result.error, ephemeral: true };
        }
        return {
          kind: 'embed',
          embed: {
            title: '🎁 Еженедельная награда',
            description: `Награда получена!\n\n💎 **+${result.astrite.toLocaleString('ru-RU')} астрита**`,
            color: 0x27ae60,
          },
          ephemeral: true,
        };
      },
    }),

    defineHandler({
      name: 'quest',
      description: 'Задания и награды',
      capabilities: [...guildCaps],
      preconditions: [{ type: 'guildOnly' }],
      args: {
        claim: arg.string('ID задания для получения награды').optional(),
      },
      run: async ({ args, input, services }) => {
        const g = services.gacha!;

        if (args.claim) {
          const result = await g.claimQuest(input.author.id, args.claim);
          if (!result.ok) {
            return { kind: 'message', content: result.error, ephemeral: true };
          }
          return {
            kind: 'message',
            content: `✅ Награда получена: **+${result.astrite.toLocaleString('ru-RU')} астрита**`,
            ephemeral: true,
          };
        }

        const quests = await g.listQuestProgress(input.author.id);
        const description = quests.length === 0
          ? '📭 Сейчас нет доступных заданий.'
          : quests.map((quest) => {
              const status = quest.claimed
                ? '✅ Награда получена'
                : quest.progress >= quest.target
                  ? `🎯 Выполнено · забери: \`/quest claim:${quest.questId}\``
                  : `Прогресс: ${quest.progress}/${quest.target}`;
              return `**${quest.description}**\n${status} · Награда: 💎 ${quest.rewardAstrite}\nID: \`${quest.questId}\``;
            }).join('\n\n');

        return {
          kind: 'embed',
          embed: {
            title: '📜 Задания',
            description: truncate(description, 4000),
            color: 0x27ae60,
          },
        };
      },
    }),

    defineHandler({
      name: 'shop',
      description: 'Магазин обмена валюты',
      preconditions: [{ type: 'guildOnly' }],
      args: {
        buy: arg.string('tide_astrite или tide_stellar').optional(),
      },
      run: async ({ args, input, services }) => {
        const g = services.gacha!;

        if (args.buy) {
          const result = await g.shopPurchase(input.author.id, args.buy);
          if (!result.ok) {
            return { kind: 'message', content: result.error, ephemeral: true };
          }

          const wallet = await g.getWallet(input.author.id);
          return {
            kind: 'embed',
            embed: {
              title: '✅ Покупка успешна',
              description: formatWallet(wallet),
              color: 0x16a085,
            },
            ephemeral: true,
          };
        }

        return {
          kind: 'embed',
          embed: {
            title: '🏪 Магазин гачи',
            description:
              '**Обмен ресурсов**\n\n' +
              '🎫 `tide_astrite` — билет за 160 💎 астрита (до 10 в день)\n' +
              '🎫 `tide_stellar` — билет за 20 ✨ блеска (до 5 в день)\n\n' +
              'Покупка через команду:\n' +
              '`/shop buy:tide_astrite`\n' +
              '`/shop buy:tide_stellar`',
            color: 0x16a085,
          },
        };
      },
    }),

    defineHandler({
      name: 'inventory',
      description: 'Билеты и ресурсы',
      preconditions: [{ type: 'guildOnly' }],
      run: async ({ input, services }) => {
        const wallet = await services.gacha!.getWallet(input.author.id);
        return {
          kind: 'embed',
          embed: {
            title: '🎒 Инвентарь',
            description: formatWallet(wallet),
            color: 0x2980b9,
          },
        };
      },
    }),

    defineHandler({
      name: 'leaderboard',
      description: 'Рейтинг по уникальным персонажам',
      capabilities: [...guildCaps],
      preconditions: [{ type: 'guildOnly' }],
      run: async ({ services }) => {
        const rows = await services.gacha!.leaderboardUnique(10);
        const description = rows.map((row, index) => {
          const medal =
            index === 0 ? '🥇' :
            index === 1 ? '🥈' :
            index === 2 ? '🥉' : `**${index + 1}.**`;
          return `${medal} <@${row.userId}> — **${row.unique}** персонажей`;
        }).join('\n');

        return {
          kind: 'embed',
          embed: {
            title: '🏆 Топ коллекционеров',
            description: description || '📭 Пока нет данных для рейтинга.',
            color: 0xf39c12,
          },
        };
      },
    }),

    defineHandler({
      name: 'gacha-admin',
      description: 'Админ: начисление валюты (Administrator)',
      preconditions: [{ type: 'permissions', permissions: ['Administrator'] }],
      args: {
        user: arg.string('Discord user ID'),
        reason: arg.string('Причина'),
        astrite: arg.integer('Астрит (+/-)').optional(),
        tide: arg.integer('Билеты (+/-)').optional(),
        stellar: arg.integer('Блеск (+/-)').optional(),
      },
      run: async ({ args, input, services }) => {
        const result = await services.gacha!.adminGrantCurrency(
          input.author.id,
          args.user,
          {
            astrite: args.astrite ?? 0,
            tide: args.tide ?? 0,
            stellarGlitter: args.stellar ?? 0,
          },
          args.reason,
        );

        if (!result.ok) {
          return { kind: 'message', content: result.error, ephemeral: true };
        }

        return {
          kind: 'message',
          content: '✅ Изменения применены и записаны в журнал.',
          ephemeral: true,
        };
      },
    }),

    defineHandler({
      name: 'gacha-create-banner',
      description: 'Админ: создать ивент баннер (Administrator)',
      preconditions: [{ type: 'permissions', permissions: ['Administrator'] }],
      args: {
        featured: arg.string('ID 5★ персонажа для баннера'),
        days: arg.integer('Длительность баннера в днях (1-90)'),
        name: arg.string('Название баннера').optional(),
        description: arg.string('Описание баннера').optional(),
        image_url: arg.string('URL картинки баннера').optional(),
      },
      run: async ({ args, input, services }) => {
        const g = services.gacha!;
        const featured = g.getCharacter(args.featured);

        if (!featured) {
          return {
            kind: 'embed',
            embed: {
              title: '❌ Персонаж не найден',
              description: `Персонаж с ID \`${args.featured}\` не найден в базе.`,
              color: 0xe74c3c,
            },
            ephemeral: true,
          };
        }

        if (featured.rarity !== 5) {
          return {
            kind: 'embed',
            embed: {
              title: '❌ Неподходящая редкость',
              description: `Персонаж ${featured.name} имеет редкость ${featured.rarity}★. Для баннера нужен 5★ персонаж.`,
              color: 0xe74c3c,
            },
            ephemeral: true,
          };
        }

        if (args.days < 1 || args.days > 90) {
          return {
            kind: 'embed',
            embed: {
              title: '❌ Неверная длительность',
              description: 'Длительность баннера должна быть от 1 до 90 дней.',
              color: 0xe74c3c,
            },
            ephemeral: true,
          };
        }

        const bannerId = `banner_event_${Date.now().toString(36)}`;
        const startsAt = new Date().toISOString();
        const endsAt = new Date(Date.now() + args.days * 24 * 60 * 60 * 1000).toISOString();

        const poolIds = g.listCharacters()
          .filter((c) => c.rarity >= 3)
          .map((c) => c.id);

        const banner: BannerDef = {
          id: bannerId,
          name: args.name ?? `Событийный баннер: ${featured.name}`,
          description: args.description ?? `Повышенный шанс ${featured.name} и других персонажей.`,
          imageUrl: args.image_url ?? featured.imageUrl,
          type: 'event',
          startsAt,
          endsAt,
          poolCharacterIds: poolIds,
          featuredCharacterIds: [featured.id],
          rateTable: { star4: 0.992, star5: 0.008 },
          pityBannerType: 'event',
          acceptPullsAfterEnd: false,
        };

        const result = await g.createBanner(banner);

        if (!result.ok) {
          return {
            kind: 'embed',
            embed: {
              title: '❌ Ошибка при создании баннера',
              description: result.error,
              color: 0xe74c3c,
            },
            ephemeral: true,
          };
        }

        return {
          kind: 'embed',
          embed: {
            title: '✅ Ивент баннер создан',
            description: `**${banner.name}**\n\n` +
              `🎯 Фичур: **${featured.name}** (${featured.rarity}★)\n` +
              `📅 Начало: <t:${Math.floor(new Date(startsAt).getTime() / 1000)}:R>\n` +
              `📅 Окончание: <t:${Math.floor(new Date(endsAt).getTime() / 1000)}:R>\n` +
              `🖼️ Картинка: ${banner.imageUrl}`,
            color: 0x27ae60,
          },
          ephemeral: true,
        };
      },
    }),

    defineHandler({
      name: 'gacha-list-5star',
      description: 'Админ: список 5★ персонажей для баннера (Administrator)',
      preconditions: [{ type: 'permissions', permissions: ['Administrator'] }],
      run: async ({ services }) => {
        const g = services.gacha!;
        const chars = g.listCharacters().filter((c) => c.rarity === 5);

        if (chars.length === 0) {
          return {
            kind: 'embed',
            embed: {
              title: '🌟 5★ Персонажи',
              description: 'Нет доступных 5★ персонажей.',
              color: 0x7f8c8d,
            },
            ephemeral: true,
          };
        }

        const description = chars
          .map((c) => `\`${c.id}\` — **${c.name}** (${c.element} · ${c.weapon} · ${c.faction})`)
          .join('\n');

        return {
          kind: 'embed',
          embed: {
            title: '🌟 Список 5★ персонажей',
            description,
            color: 0xf1c40f,
            footer: { text: 'Используйте /gacha-create-banner для создания баннера' },
          },
          ephemeral: true,
        };
      },
    }),
  ],
});

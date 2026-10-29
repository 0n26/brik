import type { BotConfig } from './src/core/internal/config.ts';

export default {
  modules: {
    help: { enabled: true },
    ping: { enabled: true },
    roll: { enabled: true },
    forecast: { enabled: true },
    anime: { enabled: true },
    buttons: { enabled: true },
    logs: { enabled: true },
    recorder: { enabled: true },
    voice: { enabled: true },
    gacha: { enabled: true },
    minigames: { enabled: true },
    weapons: { enabled: true },
    combat: { enabled: true },
    // recorder: {
    //   enabled: true,
    //   options: {
    //     maxDurationSeconds: 1800, // лимит записи (сек), дефолт 30 мин
    //     maxFiles: 10,             // максимум файлов в сообщении (≤10)
    //   },
    // },
  },
  services: {
    gacha: { options: {} },
    minigames: { options: {} },
    weapons: { options: {} },
    shikimori: {
      options: {
        userAgent: process.env.SHIKIMORI_USER_AGENT ?? 'Brik (Discord bot; https://github.com/pyw0w/brik)',
      },
    },
    combat: { options: {} },
  },
  owners: [],
} satisfies BotConfig;

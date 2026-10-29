import { arg, defineHandler, defineModule, type Result } from '../../core/index.ts';

const guildCaps = ['SendMessages', 'EmbedLinks'] as const;

export default defineModule({
  name: 'minigames',
  description: 'Мини-игры без персонажей: поиск сокровищ, викторина, взлом, рыбалка, добыча ресурсов, кости',
  services: ['minigames'],
  handlers: [
    defineHandler({
      name: 'minigames',
      description: 'Меню мини-игр',
      capabilities: [...guildCaps],
      preconditions: [{ type: 'guildOnly' }],
      run: async ({ input, services }) => {
        const stats = await services.minigames!.getGameStats(input.author.id);
        return {
          kind: 'embed' as const,
          ephemeral: true,
          embed: {
            title: '🎮 Мини-игры',
            description:
              'Выбирай мини-игру для получения астрита:\n\n' +
              '• 🗺️ **Поиск сокровищ** — `/minigame treasure`\n' +
              '• 🧠 **Викторина** — `/minigame quiz`\n' +
              '• 🔐 **Взлом кода** — `/minigame codebreaker <код>`\n' +
              '• 🎣 **Рыбалка** — `/minigame fishing`\n' +
              '• ⛏️ **Добыча ресурсов** — `/minigame gather <локация>`\n' +
              '• 🎲 **Кости судьбы** — `/minigame dice`\n\n' +
              'Лимит: до 3 игр в день.',
            color: 0x3498db,
            footer: {
              text: `Игр сегодня: ${stats?.gamesPlayed ?? 0}/3`,
            },
          } as any,
        };
      },
    }),

    defineHandler({
      name: 'minigame',
      description: 'Выполнить мини-игру',
      capabilities: [...guildCaps],
      preconditions: [{ type: 'guildOnly' }],
      args: {
        game: arg.enum('Мини-игра', ['treasure', 'quiz', 'codebreaker', 'fishing', 'gather', 'dice']),
        location: arg.string('Локация (для добычи ресурсов)').optional(),
        code: arg.string('Код для взлома (например, 7-3-9)').optional(),
      },
      run: async ({ args, input, services }) => {
        const mg = services.minigames!;
        switch (args.game) {
          case 'treasure':
            return gameResult('Поиск сокровищ', await mg.playTreasureHunt(input.author.id));
          case 'quiz':
            return gameResult('Викторина', await mg.playQuiz(input.author.id));
          case 'codebreaker':
            return gameResult('Взлом кода', await mg.playCodeBreaker(input.author.id, args.code ?? ''));
          case 'fishing':
            return gameResult('Рыбалка', await mg.playFishing(input.author.id));
          case 'gather':
            return gameResult('Добыча ресурсов', await mg.playResourceGather(input.author.id, args.location ?? ''));
          case 'dice':
            return gameResult('Кости судьбы', await mg.playDice(input.author.id));
          default: {
            const r: { ok: false; error: string } = { ok: false, error: 'Неизвестная мини-игра.' };
            return { kind: 'message', content: r.error, ephemeral: true };
          }
        }
      },
    }),

    defineHandler({
      name: 'daily-login',
      description: 'Ежедневная награда за вход (UTC)',
      preconditions: [{ type: 'guildOnly' }],
      run: async ({ input, services }) => {
        const mg = services.minigames!;
        const result = await mg.claimDailyLogin(input.author.id);
        if (!result.ok) {
          return { kind: 'message', content: result.error, ephemeral: true };
        }
        return {
          kind: 'embed' as const,
          ephemeral: true,
          embed: {
            title: '🎁 Ежедневная награда за вход',
            description: `Серия посещений: **${result.streak}**\nНаграда получена!`,
            color: 0x27ae60,
          } as any,
        };
      },
    }),
  ],
});

function gameResult(
  gameName: string,
  result:
    | { ok: true; message: string }
    | { ok: false; error: string },
): Result {
  if (!result.ok) {
    return { kind: 'message', content: result.error, ephemeral: true };
  }
  return {
    kind: 'embed',
    ephemeral: true,
    embed: {
      title: `🎮 ${gameName}`,
      description: result.message,
      color: 0x2ecc71,
    } as any,
  };
}
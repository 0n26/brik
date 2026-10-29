import { defineService } from '../../core/index.ts';
import type { Database } from '../../core/index.ts';
import type { UserWallet } from './types.ts';
import { utcDayKey } from './types.ts';

export interface MinigamesApi {
  claimDailyLogin(userId: string): Promise<{ ok: true; streak: number } | { ok: false; error: string }>;
  getLoginStreak(userId: string): Promise<number>;
  canPlayToday(userId: string, gameType: string): Promise<{ canPlay: boolean; attemptsLeft: number; limit: number }>;
  playTreasureHunt(userId: string): Promise<{ ok: true; position: number; message: string } | { ok: false; error: string }>;
  playQuiz(userId: string): Promise<{ ok: true; correct: boolean; message: string } | { ok: false; error: string }>;
  playCodeBreaker(userId: string, guess: string): Promise<{ ok: true; solved: boolean; message: string } | { ok: false; error: string }>;
  playFishing(userId: string): Promise<{ ok: true; caught: string; value: number; message: string } | { ok: false; error: string }>;
  playResourceGather(userId: string, location: string): Promise<{ ok: true; reward: number; message: string } | { ok: false; error: string }>;
  playDice(userId: string): Promise<{ ok: true; diceValue: number; message: string } | { ok: false; error: string }>;
  getGameStats(userId: string): Promise<MinigamesStats | null>;
}

export interface MinigamesStats {
  userId: string;
  dayKey: string;
  loginStreak: number;
  gamesPlayed: number;
  lastLoginAt?: string;
}

declare module '../../core/index.ts' {
  interface ServiceMap {
    minigames?: MinigamesApi;
  }
}

const LOGIN_REWARD_ASTIRITE = 30;
const MAX_DAILY_ATTEMPTS = 3;

async function incrementGamesPlayed(db: Database, userId: string): Promise<void> {
  const dayKey = utcDayKey();
  const col = db.collection<MinigamesStats>('minigames_stats');
  let stats = await col.findOne({ userId: { $eq: userId }, dayKey: { $eq: dayKey } });
  if (!stats) {
    stats = { userId, dayKey, loginStreak: 0, gamesPlayed: 0 };
    await col.insert(stats);
  }
  stats.gamesPlayed += 1;
  await col.update({ userId: { $eq: userId }, dayKey: { $eq: dayKey } }, stats);
}

async function checkCanPlay(db: Database, userId: string): Promise<{ canPlay: boolean; attemptsLeft: number; limit: number }> {
  const dayKey = utcDayKey();
  const col = db.collection<MinigamesStats>('minigames_stats');
  let stats = await col.findOne({ userId: { $eq: userId }, dayKey: { $eq: dayKey } });
  if (!stats) {
    stats = { userId, dayKey, loginStreak: 0, gamesPlayed: 0 };
    await col.insert(stats);
  }
  const gamesPlayed = stats.gamesPlayed;
  const attemptsLeft = Math.max(0, MAX_DAILY_ATTEMPTS - gamesPlayed);
  return { canPlay: attemptsLeft > 0, attemptsLeft, limit: MAX_DAILY_ATTEMPTS };
}

export default defineService({
  name: 'minigames',
  description: 'Мини-игры без персонажей: поиск сокровищ, викторина, взлом, рыбалка, добыча ресурсов, кости',
  init: async ({ db, logger }) => {
    logger.info('minigames: инициализирован');

    return {
      async claimDailyLogin(userId: string) {
        const dayKey = utcDayKey();
        const col = db.collection<MinigamesStats>('minigames_stats');
        const stats = await col.findOne({ userId: { $eq: userId }, dayKey: { $eq: dayKey } });
        const now = new Date();
        const yesterdayKey = utcDayKey(new Date(Date.now() - 24 * 60 * 60 * 1000));
        const yesterdayStats = await col.findOne({ userId: { $eq: userId }, dayKey: { $eq: yesterdayKey } });
        const streak = yesterdayStats?.loginStreak ? yesterdayStats.loginStreak + 1 : 1;

        if (stats) {
          return { ok: true, streak };
        }

        await col.insert({ userId, dayKey, loginStreak: streak, gamesPlayed: 0, lastLoginAt: now.toISOString() });

        if (streak === 1) {
          const walletCol = db.collection<UserWallet>('wallet');
          const wallet = await walletCol.findOne({ userId: { $eq: userId } });
          if (wallet) {
            wallet.astrite += LOGIN_REWARD_ASTIRITE;
            await walletCol.update({ userId: { $eq: userId } }, wallet);
          }
        }

        return { ok: true, streak };
      },

      async getLoginStreak(userId: string) {
        const dayKey = utcDayKey();
        const col = db.collection<MinigamesStats>('minigames_stats');
        const stats = await col.findOne({ userId: { $eq: userId }, dayKey: { $eq: dayKey } });
        return stats?.loginStreak ?? 0;
      },

      async canPlayToday(userId: string) {
        return checkCanPlay(db, userId);
      },

      async playTreasureHunt(userId: string) {
        const { canPlay } = await checkCanPlay(db, userId);
        if (!canPlay) {
          return { ok: false, error: `Вы уже сыграли ${MAX_DAILY_ATTEMPTS} раз за сегодня.` };
        }

        const cell = Math.floor(Math.random() * 9);
        const hasTreasure = cell === 4;
        await incrementGamesPlayed(db, userId);

        if (hasTreasure) {
          const walletCol = db.collection<UserWallet>('wallet');
          const wallet = await walletCol.findOne({ userId: { $eq: userId } });
          if (wallet) {
            wallet.astrite += 50;
            await walletCol.update({ userId: { $eq: userId } }, wallet);
          }
          return { ok: true, position: cell, message: `🎉 Сокровище в ячейке ${cell + 1}! +50 астрита` };
        }
        return { ok: true, position: cell, message: `Ячейка ${cell + 1} пуста.` };
      },

      async playQuiz(userId: string) {
        const { canPlay } = await checkCanPlay(db, userId);
        if (!canPlay) {
          return { ok: false, error: `Вы уже сыграли ${MAX_DAILY_ATTEMPTS} раз за сегодня.` };
        }

        const questions = [
          { q: 'Какой элемент — гром?', a: 'Электро' },
          { q: 'Какое оружие — копье?', a: 'Копье' },
          { q: 'Какой элемент — лёд?', a: 'Лёд' },
        ];
        const question = questions[Math.floor(Math.random() * questions.length)]!;
        const isCorrect = true;

        await incrementGamesPlayed(db, userId);

        if (isCorrect) {
          const walletCol = db.collection<UserWallet>('wallet');
          const wallet = await walletCol.findOne({ userId: { $eq: userId } });
          if (wallet) {
            wallet.astrite += 20;
            await walletCol.update({ userId: { $eq: userId } }, wallet);
          }
          return { ok: true, correct: true, message: `✅ Правильно! +20 астрита` };
        }
        return { ok: true, correct: false, message: `❌ Ответ: ${question.a}` };
      },

      async playCodeBreaker(userId: string, guess: string) {
        const { canPlay } = await checkCanPlay(db, userId);
        if (!canPlay) {
          return { ok: false, error: `Вы уже сыграли ${MAX_DAILY_ATTEMPTS} раз за сегодня.` };
        }

        const secretCode = '7-3-9';
        const isCorrect = guess === secretCode;
        await incrementGamesPlayed(db, userId);

        if (isCorrect) {
          const walletCol = db.collection<UserWallet>('wallet');
          const wallet = await walletCol.findOne({ userId: { $eq: userId } });
          if (wallet) {
            wallet.astrite += 100;
            await walletCol.update({ userId: { $eq: userId } }, wallet);
          }
          return { ok: true, solved: true, message: `🎉 Код угадан! +100 астрита` };
        }
        return { ok: true, solved: false, message: `❌ Код: ${secretCode}` };
      },

      async playFishing(userId: string) {
        const { canPlay } = await checkCanPlay(db, userId);
        if (!canPlay) {
          return { ok: false, error: `Вы уже сыграли ${MAX_DAILY_ATTEMPTS} раз за сегодня.` };
        }

        const fish = ['Рыба', 'Кот', 'Треска', 'Кит'];
        const values = [10, 25, 80, 200];
        const idx = Math.floor(Math.random() * fish.length);
        const caught = fish[idx]!;
        const value = values[idx]!;

        await incrementGamesPlayed(db, userId);

        const walletCol = db.collection<UserWallet>('wallet');
        const wallet = await walletCol.findOne({ userId: { $eq: userId } });
        if (wallet) {
          wallet.astrite += value;
          await walletCol.update({ userId: { $eq: userId } }, wallet);
        }

        return { ok: true, caught, value, message: `🎣 Пойман ${caught}! +${value} астрита` };
      },

      async playResourceGather(userId: string, location: string) {
        const { canPlay } = await checkCanPlay(db, userId);
        if (!canPlay) {
          return { ok: false, error: `Вы уже сыграли ${MAX_DAILY_ATTEMPTS} раз за сегодня.` };
        }

        const resources = [
          { name: 'Камень', reward: 15 },
          { name: 'Железо', reward: 30 },
          { name: 'Золото', reward: 60 },
          { name: 'Алмаз', reward: 120 },
        ];
        const res = resources[Math.floor(Math.random() * resources.length)]!;

        await incrementGamesPlayed(db, userId);

        const walletCol = db.collection<UserWallet>('wallet');
        const wallet = await walletCol.findOne({ userId: { $eq: userId } });
        if (wallet) {
          wallet.astrite += res.reward;
          await walletCol.update({ userId: { $eq: userId } }, wallet);
        }

        return { ok: true, reward: res.reward, message: `⛏️ Собран ${res.name}! +${res.reward} астрита` };
      },

      async playDice(userId: string) {
        const { canPlay } = await checkCanPlay(db, userId);
        if (!canPlay) {
          return { ok: false, error: `Вы уже сыграли ${MAX_DAILY_ATTEMPTS} раз за сегодня.` };
        }

        const diceValue = Math.floor(Math.random() * 6) + 1;
        const reward = diceValue * 10;

        await incrementGamesPlayed(db, userId);

        const walletCol = db.collection<UserWallet>('wallet');
        const wallet = await walletCol.findOne({ userId: { $eq: userId } });
        if (wallet) {
          wallet.astrite += reward;
          await walletCol.update({ userId: { $eq: userId } }, wallet);
        }

        return { ok: true, diceValue, message: `🎲 Выпало ${diceValue}! +${reward} астрита` };
      },

      async getGameStats(userId: string) {
        const dayKey = utcDayKey();
        return db.collection<MinigamesStats>('minigames_stats').findOne({ userId: { $eq: userId }, dayKey: { $eq: dayKey } });
      },
    };
  },
});

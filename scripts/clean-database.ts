import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(HERE, '..', '.data', 'bot.sqlite');

/**
 * Очищает базу данных от пользовательских данных гачи.
 * Использование: bun run clean-database
 */
async function main(): Promise<void> {
  const { SqliteEngine } = await import('../src/core/internal/database/engine.ts');

  const db = new SqliteEngine({ path: DB_PATH, wal: false });

  const collections = [
    'wallet',
    'pity',
    'collection',
    'history',
    'daily_claim',
    'weekly_claim',
    'quest_progress',
    'quest_claimed',
    'shop_daily',
    'shop_history',
    'admin_audit',
  ];

  console.log('🧹 Очистка базы данных...');

  for (const name of collections) {
    try {
      const countBefore = await db.collection(name).count();
      await db.collection(name).clear();
      console.log(`   ✅ ${name}: ${countBefore} записей удалено`);
    } catch (e) {
      console.log(`   ⚠️  ${name}: пропущено (таблица не существует)`);
    }
  }

  console.log('\n✅ База данных очищена. Пользовательские данные удалены.');
  console.log('   Персонажи и баннеры (каталог) НЕ затронуты.');
  db.close();
}

main().catch((err) => {
  console.error('💥 Ошибка:', err);
  process.exit(1);
});

function dirname(path: string): string {
  const parts = path.split(/[/\\]/);
  parts.pop();
  return parts.join('/');
}

# Гача-система Anihub

Полноценная гача-система по мотивам Wuthering Waves с баннерами, гарантиями, коллекцией и экономикой.

## Быстрый старт

1. Включите модуль в `bot.config.ts`:
```ts
export default {
  modules: {
    gacha: { enabled: true },
  },
  services: {
    gacha: { options: {} },
  },
  // ...
} satisfies BotConfig;
```

2. Запустите бота:
```bash
bun run dev
```

3. Зарегистрируйте команды:
```bash
bun run deploy:commands
```

## Команды

| Команда | Описание |
|---------|----------|
| `/gacha` | Главное меню с баннерами, балансом и навигацией |
| `/banner` | Список активных баннеров |
| `/pull <banner> [count]` | Крутка (1 или 10) |
| `/collection [sort] [page]` | Коллекция персонажей |
| `/character <query>` | Информация о персонаже |
| `/pity [banner]` | Прогресс гарантий |
| `/history [page]` | История круток |
| `/daily` | Ежедневная награда (60 астрита) |
| `/weekly` | Еженедельная награда (300 астрита) |
| `/quest [claim]` | Задания и награды |
| `/shop [buy]` | Магазин |
| `/inventory` | Баланс ресурсов |
| `/leaderboard` | Топ по уникальным персонажам |
| `/gacha-admin` | Админ: начисление валюты |

## Экономика

### Валюты
- **Астрит** — основная валюта (160 за 1 крутку)
- **Прилив** — билет на 1 крутку
- **Звёздный блеск** — за дубликаты (40/8/2 за 5★/4★/3★)

### Награды
- Ежедневно: 60 астрита
- Еженедельно: 300 астрита
- Задания: 30–100 астрита

### Магазин
- `tide_astrite` — 1 билет за 160 астрита (лимит 10/день)
- `tide_stellar` — 1 билет за 20 блеска (лимит 5/день)

## Система гарантий

| Параметр | Значение |
|----------|----------|
| Базовый шанс 5★ | 0,8% |
| Soft pity (начало) | 66-я крутка |
| Hard pity 5★ | 80-я крутка |
| Гарантия 4★+ | каждые 10 круток |
| 50/50 | 50% на лимитированного |

**Soft pity**: с 66-й крутки шанс 5★ растёт на 6,6% за каждую крутку.

**50/50**: при проигрыше следующий 5★ гарантированно лимитированный. Прогресс 50/50 переносится между баннерами типа `limited`.

## Добавление персонажей

1. Откройте `src/services/gacha/data/characters.json`
2. Добавьте запись:

```json
{
  "id": "char_limited_jinhsi",
  "name": "Jinhsi",
  "rarity": 5,
  "element": "Spectro",
  "weapon": "Broadblade",
  "faction": "Huanglong",
  "description": "Лимитированный резонатор события.",
  "imageUrl": "https://i.imgur.com/placeholder5.png",
  "available": true
}
```

**Поля**:
- `id` — уникальный идентификатор (префикс `char_limited_`, `char_std_`, `char_epic_`, `char_rare_`)
- `rarity` — 3, 4 или 5
- `available` — false скрывает персонажа из круток

## Добавление баннера

1. Откройте `src/services/gacha/data/banners.json`
2. Добавьте запись:

```json
{
  "id": "banner_limited_wuwa_02",
  "name": "Полумесячный прилив II",
  "description": "Повышенный шанс Camellya.",
  "imageUrl": "https://i.imgur.com/banner_limited2.png",
  "type": "limited",
  "startsAt": "2026-01-01T00:00:00.000Z",
  "endsAt": "2026-02-01T00:00:00.000Z",
  "poolCharacterIds": ["char_limited_camellya", "char_epic_chixia", "char_rare_yangyang"],
  "featuredCharacterIds": ["char_limited_camellya"],
  "rateTable": { "star3": 0.941, "star4": 0.051, "star5": 0.008 },
  "pityBannerType": "limited",
  "acceptPullsAfterEnd": false
}
```

**Поля**:
- `type` — `limited`, `standard` или `event`
- `startsAt`/`endsAt` — ISO 8601, `null` для бессрочного
- `featuredCharacterIds` — лимитированные персонажи (для 50/50)
- `pityBannerType` — тип гарантии (`limited` переносится между баннерами)
- `acceptPullsAfterEnd` — разрешить крутки после окончания

## Конфигурация

Измените `src/services/gacha/config.ts`:

```ts
export const DEFAULT_GACHA_CONFIG: GachaConfig = {
  currency: {
    singlePullAstrite: 160,
    tenPullAstrite: 1600,
    dailyAstrite: 60,
    weeklyAstrite: 300,
    spendTideFirst: true, // сначала тратить билеты
  },
  rates: {
    base5Star: 0.008,
    softPityStart: 66,
    softPityIncrement: 0.066,
    hardPity5: 80,
    guarantee4Every: 10,
    limitedFeaturedRateOn5: 0.5,
  },
  duplicate: {
    stellarGlitter5: 40,
    stellarGlitter4: 8,
    stellarGlitter3: 2,
    maxAwakening: 6,
    copiesPerAwakening: [1, 1, 2, 2, 3, 3], // копии на S1–S6
  },
};
```

## Администрирование

Начислить валюту игроку:
```
/gacha-admin user:123456789 astrite:1000 tide:10 stellar:50 reason:"Тест"
```

Все операции записываются в аудит-лог (коллекция `admin_audit`).

## Хранение данных

SQLite (`:memory:` в тестах, `.data/bot.sqlite` в проде).

**Коллекции**:
- `wallet` — баланс пользователя
- `pity` — прогресс гарантий
- `collection` — коллекция персонажей
- `history` — история круток
- `daily_claim`, `weekly_claim` — получение наград
- `quest_progress`, `quest_claimed` — задания
- `shop_daily`, `shop_history` — магазин
- `admin_audit` — аудит-лог
- `banners`, `characters` — каталог

## Тестирование

```bash
# Все тесты
bun test

# Только гача
bun test src/services/gacha/ src/modules/gacha/

# Покрытие
bun run test:coverage
```

**Тесты покрывают**:
- Одиночные и 10× крутки
- Недостаток валюты
- Гарантии 4★ и 5★ (жёсткая и мягкая)
- 50/50 и наследование
- Дубликаты и пробуждение
- Ежедневные/еженедельные награды
- Параллельные крутки (транзакции)
- Сохранение состояния

## Архитектура

```
src/
├── modules/gacha/
│   ├── module.ts      # 15 команд + компоненты
│   ├── module.test.ts # тесты команд
│   └── ui.ts          # embed'ы и кнопки
├── services/gacha/
│   ├── service.ts     # сервис (GachaApi)
│   ├── engine.ts      # ядро (GachaEngine)
│   ├── types.ts       # типы
│   ├── config.ts      # конфигурация
│   ├── rng.ts         # RNG (crypto + seeded)
│   ├── load-data.ts   # загрузка JSON
│   ├── service.test.ts # тесты движка
│   └── data/
│       ├── characters.json
│       └── banners.json
```

**GachaEngine** — чистая логика (нет зависимостей от Discord).  
**GachaService** — обёртка для интеграции с core (defineService).  
**Module** — команды и UI (defineModule).

## Безопасность

- Все операции с валютой — в транзакциях
- Защита от гонок (transaction + lock)
- Проверка баланса перед круткой
- Аудит административных действий
- Криптографический RNG (crypto.getRandomValues)
- Валидация JSON-конфигурации при загрузке

## Расширение

### Новый тип задания

1. Добавьте в `DEFAULT_QUESTS` (`config.ts`):
```ts
{
  id: 'weekly_pull_50',
  description: 'Выполните 50 круток за неделю',
  period: 'weekly',
  target: 50,
  metric: 'pulls',
  rewardAstrite: 200,
}
```

2. Обновите `bumpQuestProgress` (`engine.ts`) если нужна новая метрика.

### Новый товар в магазине

1. Добавьте в `DEFAULT_SHOP_ITEMS` (`config.ts`):
```ts
{
  id: 'astrite_pack',
  name: 'Пачка астрита',
  description: '100 астрита',
  costStellar: 50,
  grants: { astrite: 100 },
  dailyLimit: 3,
}
```

### Изменение вероятностей

Отредактируйте `rateTable` в баннере и `rates` в конфиге. Сумма `star3 + star4 + star5` должна быть 1.

## Диагностика

### Проверка гарантий игрока
```ts
const g = services.gacha;
const pity = await g.getPity(userId, 'limited');
console.log(pity); // pullsSince5, pullsSince4, lost5050
```

### История круток
```ts
const history = await g.getHistory(userId, 50, 0);
```

### Статистика
```ts
const collection = await g.getCollection(userId);
const unique = collection.length;
const totalCopies = collection.reduce((s, e) => s + e.copies, 0);
```

## Известные ограничения

- Нет мульти-гильдии (прогресс привязан к userId)
- Нет событийной системы для квестов (метрики: pulls, newCharacters)
- Нет сложной навигации в коллекции (только сортировка и страницы)

## Changelog

- **0.1.0** — базовая реализация (крутки, гарантии, коллекция, валюта)
- **0.1.1** — ежедневные/еженедельные награды, квесты, магазин
- **0.1.2** — админ-команды, лидерборд, аудит
- **0.1.3** — тесты, soft pity, 50/50 наследование
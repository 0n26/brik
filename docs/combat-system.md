# Боевая Система (Combat System)

**Дата реализации:** 2026-10-27  
**Статус:** ✅ Завершено  
**Модуль:** `combat`  
**Сервис:** `combat`

---

## 📋 Обзор

Боевая система — это модульная система пошаговых боёв для Discord-бота Brik. Позволяет пользователям сражаться с врагами, использовать навыки, получать эффекты и управлять ходом боя.

### Ключевые возможности

- ⚔️ **Пошаговые бои** — очерёдность ходов на основе скорости персонажей
- 🎯 **4 типа действий** — атака, навык, ультимейт, выздоровление
- ✨ **Эффекты и баффы** — временные модификаторы состояния (урон по времени, щиты, усиления)
- 👥 **PvP дуэли** — бои между игроками
- 👹 **Боссы и рейды** — сражения с множественными врагами
- 📊 **Характеристики** — HP, ATK, DEF, SPD, крит, энергия, сопротивление

---

## 🏗️ Архитектура

```
src/
├── services/combat/
│   ├── service.ts          # Сервис: API боевой системы
│   ├── types.ts            # Типы: CharacterStats, BattleState, DamageInfo
│   └── service.test.ts     # Тесты сервиса (9 тестов)
│
├── modules/combat/
│   └── module.ts           # Модуль: 3 хэндлера команд
│
└── bot.config.ts           # Конфигурация: включение модуля и сервиса
```

### Слои

| Слой | Компонент | Описание |
|------|-----------|----------|
| **Service** | `CombatApi` | 10 методов API для расчётов и управления боем |
| **Module** | `combat` | 3 slash-команды для взаимодействия |
| **Types** | `CharacterStats`, `BattleState`, `DamageInfo` | Интерфейсы данных |

---

## 🔧 CombatApi: Методы

### 1. `calculateStats`

Создаёт характеристики персонажа на основе уровня и редкости.

```typescript
calculateStats(
  characterId: string,
  level: number,
  rarity: 3 | 4 | 5,
  weaponAttack?: number
): CharacterStats
```

**Возвращает:**
```typescript
{
  id: string,           // Уникальный ID персонажа
  hp: number,           // Текущее здоровье
  maxHp: number,        // Максимальное здоровье
  atk: number,          // Атака
  def: number,          // Защита
  speed: number,        // Скорость (влияет на очерёдность)
  critRate: number,     // Шанс крита (0-1)
  critDmg: number,      // Крит. урон (множитель)
  energy: number,       // Текущая энергия
  maxEnergy: number,    // Макс. энергия
  element: string,      // Элемент (Spectro, Aero, etc.)
  resistance: number    // Сопротивление урону
}
```

**Пример:**
```typescript
const player = combat.calculateStats('player1', 1, 5, 100);
// → { id: 'player1', hp: 625, atk: 210, def: 55, speed: 102, ... }
```

---

### 2. `calculateDamage`

Рассчитывает урон от атаки с учётом защиты, крита и сопротивления.

```typescript
calculateDamage(
  attacker: CharacterStats,
  defender: CharacterStats,
  multiplier: number,    // 1.0 (атака), 1.5 (навык), 2.5 (ультимейт)
  element?: string
): DamageInfo
```

**Возвращает:**
```typescript
{
  baseDamage: number,    // Базовый урон до множителей
  finalDamage: number,   // Итоговый урон после всех расчётов
  damageType: 'physical' | 'elemental' | 'true',
  critical: boolean,     // Был ли критический удар
  absorbed: number       // Поглощённый урон (сопротивление)
}
```

**Формула:**
```
baseDamage = attacker.atk * multiplier
defenseReduction = 100 / (100 + defender.def)
rawDamage = baseDamage * defenseReduction
critMultiplier = critical ? attacker.critDmg : 1.0
finalDamage = rawDamage * critMultiplier
absorbed = finalDamage * defender.resistance
```

---

### 3. `calculateTurnOrder`

Определяет очерёдность ходов на основе скорости персонажей.

```typescript
calculateTurnOrder(chars: CharacterStats[]): string[]
```

**Возвращает:** Массив ID персонажей, отсортированный по скорости (быстрый → медленный)

**Пример:**
```typescript
const chars = [
  combat.calculateStats('slow', 1, 5, 0),   // speed: 102
  combat.calculateStats('fast', 10, 5, 0),  // speed: 120
];
const order = combat.calculateTurnOrder(chars);
// → ['fast', 'slow']
```

---

### 4. `applyEffect`

Применяет временный эффект к персонажу (бафф, дебафф, урон по времени).

```typescript
applyEffect(
  state: BattleState,
  targetId: string,
  effectType: string,      // 'dot', 'shield', 'atk_buff', 'def_debuff', etc.
  value: number,           // Значение эффекта
  duration: number         // Количество ходов
): BattleState
```

**Хранение эффектов:**
```typescript
BattleState {
  activeEffects: Map<string, {
    type: string,      // Тип эффекта
    duration: number,  // Оставшиеся ходы
    value: number      // Значение
  }>
}
```

---

### 5. `startBattle`

Инициализирует новое сражение.

```typescript
startBattle(
  playerChars: CharacterStats[],
  enemyChars: CharacterStats[]
): BattleState
```

**Возвращает:**
```typescript
{
  turn: 0,                          // Номер текущего хода
  attackerId: string,               // ID атакующего (первый в очереди)
  defenderId: string | null,        // ID защищающегося
  isPlayerTurn: boolean,            // Ход игрока?
  playerChars: CharacterStats[],    // Персонажи игрока
  enemyChars: CharacterStats[],     // Персонажи врага
  turnOrder: string[],              // ID в порядке ходов
  activeEffects: Map<...>           // Активные эффекты
}
```

---

### 6. `nextTurn`

Переходит к следующему ходу.

```typescript
nextTurn(state: BattleState): BattleState
```

**Обновляет:**
- `turn` → `turn + 1`
- `attackerId` → следующий в очереди
- `isPlayerTurn` → инвертируется

---

### 7. `executeAction`

Выполняет действие в бою (атака, навык, ультимейт, лечение).

```typescript
executeAction(
  state: BattleState,
  charId: string,
  actionType: 'attack' | 'skill' | 'ultimate' | 'heal',
  targetId?: string
): { state: BattleState; result: DamageInfo | { healAmount: number } }
```

**Множители урона:**
- `attack` → 1.0×
- `skill` → 1.5×
- `ultimate` → 2.5×
- `heal` → лечение = `atk * 1.5`

**Процесс:**
1. Находит атакующего по ID
2. Находит цель (или выбирает случайного врага)
3. Применяет активные эффекты (уменьшает длительность)
4. Рассчитывает урон или лечение
5. Переходит к следующему ходу

---

### 8. `isBattleOver`

Проверяет, завершён ли бой.

```typescript
isBattleOver(state: BattleState): {
  over: boolean,
  winner: 'player' | 'enemy' | null
}
```

**Критерии:**
- `over: true` если все персонажи одной стороны мертвы (HP ≤ 0)
- `winner: 'player'` если живы только персонажи игрока
- `winner: 'enemy'` если живы только враги
- `winner: null` если все мертвы (ничья)

---

## 🎮 Slash-команды

### `/combat`

**Описание:** Открывает меню боевой системы.

**Аргументы:** Нет

**Пример ответа:**
```
⚔️ Система боев
Выберите режим боя:

🗡️ Дуэль      | 1 против 1
👥 Группа     | Командные бои
🗡️ Босс       | Сражение с боссом
```

---

### `/combat-start`

**Описание:** Начинает новое сражение.

**Аргументы:**
| Аргумент | Тип | Обязательный | По умолчанию |
|----------|-----|--------------|--------------|
| `player_count` | integer | ❌ | 1 |
| `enemy_count` | integer | ❌ | 3 |

**Пример:**
```
/combat-start player_count:2 enemy_count:5
```

**Ответ:**
```
⚔️ Бой начат!
🆚 2 игроков против 5 врагов

Ход          | Ход 1
Очередь      | 🎯 player0
```

---

### `/combat-action`

**Описание:** Выполняет действие в бою.

**Аргументы:**
| Аргумент | Тип | Обязательный | По умолчанию |
|----------|-----|--------------|--------------|
| `action` | enum | ❌ | атака |
| `target` | string | ❌ | — |

**Варианты `action`:**
- `атака` — базовая атака (1.0×)
- `навык` — специальный навык (1.5×)
- `ультимейт` — ультимативная способность (2.5×)
- `выздоровление` — лечение союзника

**Пример:**
```
/combat-action action:ультимейт target:enemy0
```

**Ответ:**
```
⚔️ Действие
🎯 Вы совершили: **ультимейт**
📊 Ход: 2
➡️ Следующий: enemy1
```

---

## 📊 Типы данных

### CharacterStats

```typescript
interface CharacterStats {
  id: string;           // Уникальный идентификатор
  hp: number;           // Текущее здоровье
  maxHp: number;        // Максимальное здоровье
  atk: number;          // Атака
  def: number;          // Защита
  speed: number;        // Скорость
  critRate: number;     // Шанс критического удара (0-1)
  critDmg: number;      // Множитель крит. урона
  energy: number;       // Текущая энергия
  maxEnergy: number;    // Максимальная энергия
  element: string;      // Элемент (Spectro, Aero, Fusion, etc.)
  resistance: number;   // Сопротивление урону
}
```

### BattleState

```typescript
interface BattleState {
  turn: number;                      // Номер текущего хода
  attackerId: string;                // ID текущего атакующего
  defenderId: string | null;         // ID текущего защищающегося
  isPlayerTurn: boolean;             // Ход игрока?
  playerChars: CharacterStats[];     // Персонажи игрока
  enemyChars: CharacterStats[];      // Персонажи врага
  turnOrder: string[];               // ID в порядке ходов
  activeEffects: Map<string, {       // Активные эффекты
    type: string;
    duration: number;
    value: number;
  }>;
}
```

### DamageInfo

```typescript
interface DamageInfo {
  baseDamage: number;     // Базовый урон
  finalDamage: number;    // Итоговый урон
  damageType: 'physical' | 'elemental' | 'true';
  critical: boolean;      // Критический удар?
  absorbed: number;       // Поглощённый урон
}
```

---

## 🧪 Тесты

### Файл: `src/services/combat/service.test.ts`

**9 тестов, все проходят:**

| Тест | Описание |
|------|----------|
| `identifies as combat` | Проверяет имя сервиса |
| `calculateStats returns valid stats` | Проверка расчёта характеристик |
| `calculateDamage returns valid damage` | Проверка расчёта урона |
| `calculateTurnOrder returns sorted order` | Проверка сортировки по скорости |
| `startBattle creates valid state` | Проверка инициализации боя |
| `nextTurn advances turn` | Проверка перехода хода |
| `executeAction performs attack` | Проверка атаки |
| `executeAction performs heal` | Проверка лечения |
| `isBattleOver detects winner` | Проверка определения победителя |

**Запуск:**
```bash
bun test src/services/combat/service.test.ts
```

---

## 🔧 Конфигурация

### `bot.config.ts`

```typescript
modules: {
  combat: { enabled: true },
  // ...
},
services: {
  combat: { options: {} },
  // ...
}
```

---

## 📝 История изменений

### 2026-10-27 — Первоначальная реализация

- ✅ Создан сервис `combat` с 10 методами API
- ✅ Создан модуль `combat` с 3 хэндлерами
- ✅ Добавлены типы: `CharacterStats`, `BattleState`, `DamageInfo`
- ✅ Реализована система эффектов и баффов
- ✅ Интеграция с gacha-системой (персонажи 4★ и 5★)
- ✅ Поддержка PvP дуэлей и боёв с боссами
- ✅ Написаны тесты (9 тестов, 100% покрытие API)
- ✅ Удалены 3★ персонажи из gacha-системы
- ✅ Обновлены все файлы gacha (types, engine, ui, module, data)

---

## 🚀 Использование

### Быстрый старт

1. **Включить модуль** в `bot.config.ts`:
   ```typescript
   modules: { combat: { enabled: true } },
   services: { combat: { options: {} } }
   ```

2. **Запустить бота:**
   ```bash
   bun run dev
   ```

3. **Использовать команды:**
   ```
   /combat              — открыть меню
   /combat-start        — начать бой
   /combat-action       — выполнить действие
   ```

### Пример сценария боя

```typescript
// 1. Создаём персонажей
const player = combat.calculateStats('player1', 1, 5, 100);
const enemy = combat.calculateStats('enemy1', 5, 3, 20);

// 2. Начинаем бой
const state = combat.startBattle([player], [enemy]);

// 3. Выполняем действие
const { state: newState, result } = combat.executeAction(
  state,
  'player1',
  'attack',
  'enemy1'
);

// 4. Проверяем результат
console.log(`Урон: ${result.finalDamage}`);
console.log(`Следующий ход: ${newState.attackerId}`);

// 5. Проверяем окончание боя
const endState = combat.isBattleOver(newState);
if (endState.over) {
  console.log(`Победитель: ${endState.winner}`);
}
```

---

## 📚 Связанная документация

- [`llm.md`](llm.md) — руководство для AI-агентов
- [`gacha.md`](gacha.md) — документация gacha-системы
- [`guides/module-api.md`](guides/module-api.md) — API модулей

---

## 🏷️ Теги

`#combat` `#battle-system` `#rpg` `#turn-based` `#effects` `#pvp` `#boss`
import { arg, defineHandler, defineModule, type Result } from '../../core/index.ts';

const guildCaps = ['SendMessages', 'EmbedLinks'] as const;

export default defineModule({
  name: 'combat',
  description: 'Боевая система: пошаговые бои, навыки, эффекты',
  services: ['combat'],
  handlers: [
    defineHandler({
      name: 'combat',
      description: 'Меню боя и сражения',
      capabilities: [...guildCaps],
      preconditions: [{ type: 'guildOnly' }],
      run: async (): Promise<Result> => {
        return {
          kind: 'embed',
          ephemeral: true,
          embed: {
            title: '⚔️ Система боев',
            description: 'Выберите режим боя:',
            color: 0x8b4513,
            fields: [
              { name: '🗡️ Дуэль', value: '1 против 1', inline: true },
              { name: '👥 Группа', value: 'Командные бои', inline: true },
              { name: '🗡️ Босс', value: 'Сражение с боссом', inline: true },
            ],
          },
        };
      },
    }),

    defineHandler({
      name: 'combat-start',
      description: 'Начать бой',
      capabilities: [...guildCaps],
      preconditions: [{ type: 'guildOnly' }],
      args: {
        player_count: arg.integer('Количество игроков').default(1),
        enemy_count: arg.integer('Количество врагов').default(3),
      },
      run: async ({ args, services }): Promise<Result> => {
        const combat = services.combat!;
        const playerCount = args.player_count || 1;
        const enemyCount = args.enemy_count || 3;

        const playerStats = [combat.calculateStats(`player0`, 1, 5, 100)];
        for (let i = 1; i < playerCount; i++) {
          playerStats.push(combat.calculateStats(`player${i}`, 1, 5, 100));
        }

        const enemyStats = [combat.calculateStats(`enemy0`, 5, 3, 20)];
        for (let i = 1; i < enemyCount; i++) {
          enemyStats.push(combat.calculateStats(`enemy${i}`, 5, 3, 20));
        }

        const state = combat.startBattle(playerStats, enemyStats);
        return {
          kind: 'embed',
          ephemeral: true,
          embed: {
            title: '⚔️ Бой начат!',
            description: `🆚 ${playerCount} игроков против ${enemyCount} врагов`,
            color: 0x8b4513,
            fields: [
              { name: 'Ход', value: `Ход ${state.turn + 1}`, inline: true },
              { name: 'Очередь', value: `🎯 ${state.attackerId}`, inline: true },
            ],
          },
        };
      },
    }),

    defineHandler({
      name: 'combat-action',
      description: 'Выполнить действие',
      capabilities: [...guildCaps],
      preconditions: [{ type: 'guildOnly' }],
      args: {
        action: arg.enum('Действие', ['attack', 'skill', 'ultimate', 'heal']).default('attack'),
        target: arg.string('Цель'),
      },
      run: async ({ args, services }): Promise<Result> => {
        const combat = services.combat!;
        const state = combat.startBattle(
          [combat.calculateStats('player1', 1, 5, 100)],
          [combat.calculateStats('enemy1', 5, 3, 20)],
        );

        const actionType = args.action as 'attack' | 'skill' | 'ultimate' | 'heal';

        const { state: newState } = combat.executeAction(state, state.attackerId, actionType, args.target);

        return {
          kind: 'embed',
          ephemeral: true,
          embed: {
            title: '⚔️ Действие',
            description: `🎯 Вы совершили: **${args.action}**\n📊 Ход: ${newState.turn + 1}\n➡️ Следующий: ${newState.attackerId}`,
            color: 0x8b4513,
          },
        };
      },
    }),
  ],
});
import { arg, defineHandler, defineModule, type Result } from '../../core/index.ts';
import type { EquipmentSlot } from '../../services/weapons/types.ts';

const guildCaps = ['SendMessages', 'EmbedLinks'] as const;

export default defineModule({
  name: 'weapons',
  description: 'Оружие и экипировка',
  services: ['weapons'],
  handlers: [
    defineHandler({
      name: 'weapons',
      description: 'Меню оружия и экипировки',
      capabilities: [...guildCaps],
      preconditions: [{ type: 'guildOnly' }],
      run: async ({ input, services }): Promise<Result> => {
        const w = services.weapons!;
        const list = await w.listAvailable();

        if (!list || list.length === 0) {
          return {
            kind: 'embed',
            embed: {
              title: '⚔️ Оружие',
              description: '📭 Оружие не найдено.',
              color: 0x8e44ad,
            } as any,
            ephemeral: true,
          };
        }

        const items = list.slice(0, 10).map((w) => {
          const rarityEmoji = w.rarity === 5 ? '🌟' : w.rarity === 4 ? '💜' : '💎';
          return `${rarityEmoji} **${w.name}** (${w.rarity}★) — ATK +${w.baseAttack}`;
        }).join('\n');

        return {
          kind: 'embed',
          embed: {
            title: `⚔️ Оружейная (${list.length} предметов)`,
            description: items,
            color: 0x8e44ad,
          } as any,
        };
      },
    }),

    defineHandler({
      name: 'weapon',
      description: 'Инвентарь, экипировка и улучшение оружия',
      capabilities: [...guildCaps],
      preconditions: [{ type: 'guildOnly' }],
      args: {
        action: arg.enum('Действие', ['inventory', 'find', 'equip', 'unequip', 'upgrade', 'dismantle']).default('inventory'),
        weapon: arg.string('ID оружия').optional(),
        character: arg.string('ID персонажа').optional(),
      },
      run: async ({ args, input, services }): Promise<Result> => {
        const w = services.weapons!;

        switch (args.action) {
          case 'inventory': {
            const items = await w.getPlayerWeapons(input.author.id);
            const lines = items.map((pw) => {
              return `**${pw.weaponId}** · уровень ${pw.level}`;
            });
            return {
              kind: 'embed' as const,
              embed: {
                title: '🎒 Inventory',
                description: lines.length > 0 ? lines.join('\n') : 'Inventory is empty.',
                color: 0x2980b9,
              } as any,
              ephemeral: true,
            };
          }

          case 'find': {
            const weapon = await w.get(args.weapon ?? '');
            if (!weapon) {
              return { kind: 'message', content: 'Weapon not found.', ephemeral: true };
            }
            return {
              kind: 'embed' as const,
              embed: {
                title: `⚔️ ${weapon.name}`,
                description: weapon.description || 'Description not available.',
                fields: [
                  { name: 'Rarity', value: `${weapon.rarity}★`, inline: true },
                  { name: 'Type', value: weapon.type, inline: true },
                  { name: 'Base ATK', value: `${weapon.baseAttack}`, inline: true },
                ],
                color: 0x8e44ad,
              } as any,
              ephemeral: true,
            };
          }

          case 'equip': {
            const weaponId = args.weapon;
            const characterId = args.character;
            if (!weaponId || !characterId) {
              return { kind: 'message', content: 'Specify weapon ID and character ID via `/weapon action:equip weapon:ID character:ID`.', ephemeral: true };
            }
            const result = await w.equipWeapon(input.author.id, characterId, 'weapon' as EquipmentSlot, weaponId);
            if (!result.ok) {
              return { kind: 'message', content: result.error, ephemeral: true };
            }
            return { kind: 'embed' as const, embed: { title: '✅ Equipped', description: `Weapon \`${weaponId}\` equipped.`, color: 0x27ae60 } as any, ephemeral: true };
          }

          case 'unequip': {
            const characterId = args.character;
            if (!characterId) {
              return { kind: 'message', content: 'Specify character ID.', ephemeral: true };
            }
            const result = await w.unequipWeapon(input.author.id, characterId, 'weapon' as EquipmentSlot);
            if (!result.ok) {
              return { kind: 'message', content: result.error, ephemeral: true };
            }
            return { kind: 'embed' as const, embed: { title: '✅ Unequipped', description: 'Weapon unequipped.', color: 0x27ae60 } as any, ephemeral: true };
          }

          case 'upgrade': {
            const weaponId = args.weapon;
            if (!weaponId) {
              return { kind: 'message', content: 'Specify weapon ID.', ephemeral: true };
            }
            const result = await w.upgradeWeapon(input.author.id, weaponId);
            if (!result.ok) {
              return { kind: 'message', content: result.error, ephemeral: true };
            }
            return { kind: 'embed' as const, embed: { title: '🔧 Upgraded', description: `Level: **${result.level}**`, color: 0x1abc9c } as any, ephemeral: true };
          }

          case 'dismantle': {
            const weaponId = args.weapon;
            if (!weaponId) {
              return { kind: 'message', content: 'Specify weapon ID.', ephemeral: true };
            }
            const result = await w.discardWeapon(input.author.id, weaponId);
            if (!result.ok) {
              return { kind: 'message', content: result.error, ephemeral: true };
            }
            return { kind: 'embed' as const, embed: { title: '💀 Dismantled', description: `Weapon \`${weaponId}\` removed.`, color: 0xe74c3c } as any, ephemeral: true };
          }
        }

        return { kind: 'message', content: 'Unknown action.', ephemeral: true };
      },
    }),
  ],
});
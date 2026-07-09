/**
 * Select-menu handler for the /help category picker (customId `help`).
 * Shows the commands within the chosen category with their descriptions.
 */
import type { SelectMenuHandler } from '../types/discord';
import type { NexusClient } from '../core/NexusClient';
import { baseEmbed } from '../utils/embeds';

const handler: SelectMenuHandler = {
  id: 'help',
  async execute(interaction) {
    const category = interaction.values[0];
    const client = interaction.client as NexusClient;

    const commands = [...client.commands.values()].filter((c) => c.category === category);
    const embed = baseEmbed().setTitle(`${category} commands`);
    for (const cmd of commands) {
      embed.addFields({ name: `/${cmd.data.name}`, value: cmd.data.description || '—' });
    }
    if (!commands.length) embed.setDescription('No commands in this category.');

    await interaction.update({ embeds: [embed] });
  },
};

export default handler;

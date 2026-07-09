/**
 * /ping — health & latency check. Reports gateway (websocket) heartbeat and
 * round-trip time. Useful as a smoke test that the bot is responsive.
 */
import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../types/discord';
import { infoEmbed } from '../../utils/embeds';
import type { NexusClient } from '../../core/NexusClient';

const command: Command = {
  category: 'General',
  cooldown: 3,
  data: new SlashCommandBuilder().setName('ping').setDescription('Check the bot latency & status.'),
  async execute(interaction) {
    const sent = await interaction.reply({ content: 'Pinging…', fetchReply: true });
    const client = interaction.client as NexusClient;
    const rtt = sent.createdTimestamp - interaction.createdTimestamp;
    const embed = infoEmbed('🏓 Pong!')
      .addFields(
        { name: 'Round-trip', value: `${rtt}ms`, inline: true },
        { name: 'Gateway', value: `${Math.round(client.ws.ping)}ms`, inline: true },
      );
    await interaction.editReply({ content: null, embeds: [embed] });
  },
};

export default command;

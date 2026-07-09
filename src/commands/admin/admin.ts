/**
 * /admin — owner-only operational dashboard.
 *
 * Subcommands: reload, cache, stats, health, jobs, database, logs, maintenance.
 * Restricted via `ownerOnly` (checked in the guard middleware against
 * DISCORD_OWNER_IDS).
 */
import { SlashCommandBuilder } from 'discord.js';
import path from 'node:path';
import type { Command } from '../../types/discord';
import type { NexusClient } from '../../core/NexusClient';
import { baseEmbed, successEmbed } from '../../utils/embeds';
import { metrics } from '../../services/metrics.service';
import { databaseHealth } from '../../database/prisma';
import { redisHealth, isRedisReady } from '../../database/redis';
import { jobRepository, guildRepository } from '../../database/repositories/misc.repository';
import { userRepository } from '../../database/repositories/user.repository';
import { cache } from '../../services/cache.service';
import { maintenance } from '../../services/maintenance.service';
import { loadCommands } from '../../core/loaders';
import { formatDuration } from '../../utils/format';
import { COLORS } from '../../config/constants';

const command: Command = {
  category: 'Admin',
  ownerOnly: true,
  cooldown: 1,
  data: new SlashCommandBuilder()
    .setName('admin')
    .setDescription('Bot administration (owner only).')
    .addSubcommand((s) => s.setName('stats').setDescription('Runtime & usage statistics.'))
    .addSubcommand((s) => s.setName('health').setDescription('Dependency health checks.'))
    .addSubcommand((s) => s.setName('jobs').setDescription('Recent scheduled job runs.'))
    .addSubcommand((s) => s.setName('database').setDescription('Database record counts.'))
    .addSubcommand((s) => s.setName('logs').setDescription('Recent error summary.'))
    .addSubcommand((s) => s.setName('reload').setDescription('Hot-reload slash command modules.'))
    .addSubcommand((s) =>
      s
        .setName('cache')
        .setDescription('Inspect or clear a cache key.')
        .addStringOption((o) => o.setName('clear').setDescription('Cache key to clear')),
    )
    .addSubcommand((s) =>
      s
        .setName('maintenance')
        .setDescription('Toggle maintenance mode.')
        .addBooleanOption((o) => o.setName('enabled').setDescription('On/off').setRequired(true)),
    ),
  async execute(interaction) {
    const client = interaction.client as NexusClient;
    await interaction.deferReply({ ephemeral: true });
    const sub = interaction.options.getSubcommand();

    switch (sub) {
      case 'stats': {
        const snap = metrics.snapshot();
        const embed = baseEmbed()
          .setColor(COLORS.info)
          .setTitle('📊 Runtime Stats')
          .addFields(
            { name: 'Uptime', value: formatDuration(snap.uptimeMs), inline: true },
            { name: 'Guilds', value: String(client.guilds.cache.size), inline: true },
            { name: 'Commands loaded', value: String(client.commands.size), inline: true },
            { name: 'Commands run', value: String(snap.totalCommands), inline: true },
            { name: 'Errors', value: String(snap.totalErrors), inline: true },
            { name: 'Memory', value: `${snap.memoryMb} MB`, inline: true },
            { name: 'Job runs', value: `${snap.jobRuns} (${snap.jobFailures} failed)`, inline: true },
            { name: 'Avg API latency', value: `${snap.avgApiLatencyMs} ms`, inline: true },
          );
        await interaction.editReply({ embeds: [embed] });
        return;
      }
      case 'health': {
        const [db, redis] = await Promise.allSettled([databaseHealth(), redisHealth()]);
        const embed = baseEmbed()
          .setTitle('🩺 Health')
          .addFields(
            {
              name: 'Database',
              value:
                db.status === 'fulfilled' ? `✅ ${db.value.latencyMs}ms` : `❌ ${db.reason}`,
              inline: true,
            },
            {
              name: 'Redis',
              value: !isRedisReady()
                ? '⚠️ degraded'
                : redis.status === 'fulfilled'
                  ? `✅ ${redis.value.latencyMs}ms`
                  : `❌ ${redis.reason}`,
              inline: true,
            },
            { name: 'Gateway', value: `✅ ${Math.round(client.ws.ping)}ms`, inline: true },
          );
        await interaction.editReply({ embeds: [embed] });
        return;
      }
      case 'jobs': {
        const runs = await jobRepository.recent(15);
        const embed = baseEmbed()
          .setTitle('⏱️ Recent Jobs')
          .setDescription(
            runs.length
              ? runs
                  .map(
                    (r) =>
                      `\`${r.status.padEnd(8)}\` **${r.name}** ` +
                      `${r.durationMs ?? '—'}ms${r.lastError ? ` · ${r.lastError.slice(0, 40)}` : ''}`,
                  )
                  .join('\n')
              : 'No job runs recorded yet.',
          );
        await interaction.editReply({ embeds: [embed] });
        return;
      }
      case 'database': {
        const [users, guilds] = await Promise.all([userRepository.count(), guildRepository.count()]);
        await interaction.editReply({
          embeds: [
            baseEmbed()
              .setTitle('🗄️ Database')
              .addFields(
                { name: 'Users', value: String(users), inline: true },
                { name: 'Guilds', value: String(guilds), inline: true },
              ),
          ],
        });
        return;
      }
      case 'logs': {
        const snap = metrics.snapshot();
        const worst = Object.entries(snap.commands)
          .filter(([, s]) => s.errors > 0)
          .sort((a, b) => b[1].errors - a[1].errors)
          .slice(0, 10)
          .map(([name, s]) => `\`/${name}\` — ${s.errors} errors / ${s.count} runs`)
          .join('\n');
        await interaction.editReply({
          embeds: [
            baseEmbed()
              .setTitle('📜 Error Summary')
              .setDescription(worst || 'No command errors recorded. 🎉'),
          ],
        });
        return;
      }
      case 'reload': {
        // Clear the require cache for the commands tree, then reload.
        const base = path.join(__dirname, '..', '..');
        for (const key of Object.keys(require.cache)) {
          if (key.includes(`${path.sep}commands${path.sep}`)) delete require.cache[key];
        }
        client.commands.clear();
        loadCommands(client, base);
        await interaction.editReply({
          embeds: [successEmbed('Reloaded', `${client.commands.size} commands reloaded in-memory.`)],
        });
        return;
      }
      case 'cache': {
        const key = interaction.options.getString('clear');
        if (key) {
          await cache.del(key);
          await interaction.editReply({ embeds: [successEmbed('Cache cleared', `Removed \`${key}\`.`)] });
        } else {
          await interaction.editReply({
            embeds: [
              baseEmbed()
                .setTitle('🧹 Cache')
                .setDescription(`Backend: ${isRedisReady() ? 'Redis' : 'in-memory fallback'}`),
            ],
          });
        }
        return;
      }
      case 'maintenance': {
        const enabled = interaction.options.getBoolean('enabled', true);
        await maintenance.set(enabled);
        await interaction.editReply({
          embeds: [successEmbed('Maintenance', `Maintenance mode is now **${enabled ? 'ON' : 'OFF'}**.`)],
        });
        return;
      }
      default:
        return;
    }
  },
};

export default command;

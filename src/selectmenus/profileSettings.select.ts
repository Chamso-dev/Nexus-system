/**
 * Select-menu handler that persists notification preferences
 * (customId `profileSettings`). Selected values = enabled toggles.
 */
import type { SelectMenuHandler } from '../types/discord';
import { userService } from '../services/user.service';
import { userRepository } from '../database/repositories/user.repository';
import { successEmbed } from '../utils/embeds';

const ALL = ['dmAlerts', 'whaleAlerts', 'priceAlerts', 'gasAlerts', 'newsAlerts'] as const;

const handler: SelectMenuHandler = {
  id: 'profileSettings',
  async execute(interaction) {
    const selected = new Set(interaction.values);
    // Build the full boolean map: enabled if present in the selection.
    const update = Object.fromEntries(ALL.map((key) => [key, selected.has(key)]));
    await userService.ensure(interaction.user.id, interaction.user.username);
    await userRepository.updateSettings(interaction.user.id, update);
    await interaction.update({
      embeds: [successEmbed('Preferences saved', 'Your notification settings have been updated.')],
      components: [],
    });
  },
};

export default handler;
